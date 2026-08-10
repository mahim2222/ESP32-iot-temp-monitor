#include <WiFi.h>
#include <WebSocketsClient.h>
#include <DHT.h>
#include <Preferences.h>
#include <WebServer.h>

// =====================================================
// DHT SETUP
// =====================================================

#define DHTPIN 4
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);

// =====================================================
// BUILTIN LED
// =====================================================

#define LED_PIN 2

// =====================================================
// WEBSOCKET SETTINGS
// =====================================================

// Local backend (same WiFi as PC): plain ws on 4000
#define WEBSOCKET_PORT_LOCAL 4000

// ngrok / any https public URL: wss on 443
#define WEBSOCKET_PORT_SSL 443

// =====================================================
// ACCESS POINT
// =====================================================

const char* AP_NAME = "ESP32-Monitor";
const char* AP_PASSWORD = "12345678";

// =====================================================
// STORAGE
// =====================================================

Preferences preferences;

// =====================================================
// WEBSOCKET
// =====================================================

WebSocketsClient webSocket;
WebServer server(80);

// =====================================================
// STATE VARIABLES
// =====================================================

unsigned long sendInterval = 3000;
unsigned long lastUpdate = 0;

bool sendEnabled = true;
bool wsConnected = false;

// =====================================================
// SAVED CONFIGURATION
// =====================================================

String wifiSSID = "";
String wifiPassword = "";

String deviceId = "";
String deviceSecret = "";

String websocketHost = "";
String websocketPath = "";

// =====================================================
// HOST HELPERS
// =====================================================

// True for ngrok / domain hosts → use WSS:443
// False for raw IPv4 → use WS:4000 on LAN
bool hostNeedsSsl(const String& host) {
  // IPv4 like 192.168.1.10
  int dots = 0;
  bool onlyDigitsAndDots = true;

  for (unsigned int i = 0; i < host.length(); i++) {
    char c = host.charAt(i);
    if (c == '.') {
      dots++;
    } else if (c < '0' || c > '9') {
      onlyDigitsAndDots = false;
      break;
    }
  }

  if (onlyDigitsAndDots && dots == 3) {
    return false;
  }

  return true;
}

String sanitizeHost(String host) {
  host.trim();
  host.replace("wss://", "");
  host.replace("ws://", "");
  host.replace("http://", "");
  host.replace("https://", "");

  int slashIndex = host.indexOf('/');
  if (slashIndex != -1) {
    host = host.substring(0, slashIndex);
  }

  // Strip accidental :port — sketch chooses 443 or 4000 itself
  int colonIndex = host.indexOf(':');
  if (colonIndex != -1) {
    host = host.substring(0, colonIndex);
  }

  host.trim();
  return host;
}

// =====================================================
// LOAD SETTINGS
// =====================================================

void loadSettings() {

  preferences.begin("config", true);

  wifiSSID = preferences.getString("ssid", "");
  wifiPassword = preferences.getString("pass", "");

  deviceId = preferences.getString("deviceId", "");
  deviceSecret = preferences.getString("secret", "");

  websocketHost = preferences.getString("host", "");
  websocketHost = sanitizeHost(websocketHost);

  sendInterval = preferences.getUInt("interval", 3000);
  sendEnabled = preferences.getBool("enabled", true);

  preferences.end();

  // Minimum interval = 3 seconds
  if (sendInterval < 3000) {
    sendInterval = 3000;
  }

  Serial.println();
  Serial.println("========== LOADED SETTINGS ==========");

  Serial.println("SSID: " + wifiSSID);
  Serial.println("Device ID: " + deviceId);

  // Do NOT print the secret/token
  Serial.println("Device Secret: ********");

  Serial.println("WebSocket Host: " + websocketHost);

  Serial.println(
    "Send Interval: " +
    String(sendInterval) +
    " ms"
  );

  Serial.println(
    "Send Enabled: " +
    String(sendEnabled ? "YES" : "NO")
  );

  Serial.println("=====================================");
  Serial.println();
}

// =====================================================
// SAVE CONFIGURATION
// =====================================================

void saveConfig(
  String ssid,
  String pass,
  String id,
  String secret,
  String host
) {

  preferences.begin("config", false);

  preferences.putString("ssid", ssid);
  preferences.putString("pass", pass);

  preferences.putString("deviceId", id);
  preferences.putString("secret", secret);

  preferences.putString("host", host);

  preferences.end();

  Serial.println("Configuration saved.");
}

// =====================================================
// SAVE INTERVAL
// =====================================================

void saveInterval(unsigned long interval) {

  if (interval < 3000) {
    interval = 3000;
  }

  preferences.begin("config", false);

  preferences.putUInt(
    "interval",
    interval
  );

  preferences.end();
}

// =====================================================
// SAVE ENABLED STATE
// =====================================================

void saveState(bool enabled) {

  preferences.begin("config", false);

  preferences.putBool(
    "enabled",
    enabled
  );

  preferences.end();
}

// =====================================================
// CHECK CONFIGURATION
// =====================================================

bool isConfigured() {

  return
    wifiSSID.length() > 0 &&
    wifiPassword.length() > 0 &&
    deviceId.length() > 0 &&
    deviceSecret.length() > 0 &&
    websocketHost.length() > 0;
}

// =====================================================
// URL ENCODE
// =====================================================

String urlEncode(String value) {

  String encoded = "";

  const char* hex =
    "0123456789ABCDEF";

  for (
    unsigned int i = 0;
    i < value.length();
    i++
  ) {

    char c = value.charAt(i);

    if (
      (c >= 'a' && c <= 'z') ||
      (c >= 'A' && c <= 'Z') ||
      (c >= '0' && c <= '9') ||
      c == '-' ||
      c == '_' ||
      c == '.' ||
      c == '~'
    ) {

      encoded += c;

    } else {

      encoded += '%';

      encoded +=
        hex[(c >> 4) & 0x0F];

      encoded +=
        hex[c & 0x0F];
    }
  }

  return encoded;
}

// =====================================================
// CREATE WEBSOCKET PATH
// =====================================================

void createWebSocketPath() {

  // Backend expects: /socket?token=<deviceToken>
  // deviceSecret in the config portal = the token from the dashboard.
  websocketPath =
    "/socket?token=" +
    urlEncode(deviceSecret);

  // Do not print the complete path because
  // it contains the device secret/token.

  Serial.println();
  Serial.println("WebSocket Path created: /socket?token=********");
  Serial.println();
}

// =====================================================
// CONNECT WIFI
// =====================================================

void connectWiFi() {

  WiFi.mode(WIFI_AP_STA);

  Serial.println();
  Serial.println("Connecting to WiFi...");
  Serial.println("SSID: " + wifiSSID);

  WiFi.begin(
    wifiSSID.c_str(),
    wifiPassword.c_str()
  );

  unsigned long startTime =
    millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - startTime < 15000
  ) {

    delay(500);

    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("WiFi Connected!");

    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());

    Serial.print("Gateway: ");
    Serial.println(WiFi.gatewayIP());

  } else {

    Serial.println(
      "WiFi connection failed."
    );
  }

  // Keep configuration AP available
  WiFi.softAP(
    AP_NAME,
    AP_PASSWORD
  );

  Serial.print(
    "Configuration AP IP: "
  );

  Serial.println(
    WiFi.softAPIP()
  );
}

// =====================================================
// WEBSOCKET EVENT
// =====================================================

void webSocketEvent(
  WStype_t type,
  uint8_t* payload,
  size_t length
) {

  switch (type) {

    // -------------------------------------------------
    // DISCONNECTED
    // -------------------------------------------------

    case WStype_DISCONNECTED:

      wsConnected = false;

      digitalWrite(
        LED_PIN,
        LOW
      );

      Serial.println(
        "WebSocket disconnected."
      );

      break;

    // -------------------------------------------------
    // CONNECTED
    // -------------------------------------------------

    case WStype_CONNECTED:

      wsConnected = true;

      digitalWrite(
        LED_PIN,
        HIGH
      );

      Serial.println();
      Serial.println(
        "================================"
      );
      Serial.println(
        "WebSocket CONNECTED"
      );
      Serial.println(
        "================================"
      );
      Serial.println();

      break;

    // -------------------------------------------------
    // TEXT MESSAGE
    // -------------------------------------------------

    case WStype_TEXT: {

      String msg =
        String((char*)payload);

      Serial.println(
        "WebSocket message:"
      );

      Serial.println(msg);

      // -----------------------------------------------
      // DELAY COMMAND
      // -----------------------------------------------

      if (
        msg.indexOf(
          "\"type\":\"delay\""
        ) != -1
      ) {

        int valueIndex =
          msg.indexOf(
            "\"value\":"
          );

        if (valueIndex != -1) {

          String valueString =
            msg.substring(
              valueIndex + 8
            );

          int value =
            valueString.toInt();

          if (value >= 3000) {

            sendInterval =
              value;

            saveInterval(
              value
            );

            Serial.print(
              "Send interval changed to: "
            );

            Serial.print(value);

            Serial.println(
              " ms"
            );

          } else {

            Serial.println(
              "Delay ignored. Minimum is 3000 ms."
            );
          }
        }
      }

      // -----------------------------------------------
      // DATA TRANSFER COMMAND
      // Backend sends:
      // {"type":"data_transfer","value":"start"|"stop"}
      // -----------------------------------------------

      if (
        msg.indexOf(
          "\"type\":\"data_transfer\""
        ) != -1
      ) {

        if (
          msg.indexOf(
            "\"value\":\"start\""
          ) != -1
        ) {

          sendEnabled = true;
          saveState(true);
          Serial.println(
            "Sending ENABLED."
          );

        } else if (
          msg.indexOf(
            "\"value\":\"stop\""
          ) != -1
        ) {

          sendEnabled = false;
          saveState(false);
          Serial.println(
            "Sending DISABLED."
          );
        }
      }

      break;
    }

    // -------------------------------------------------
    // OTHER EVENTS
    // -------------------------------------------------

    case WStype_ERROR:
      Serial.println("WebSocket ERROR event.");
      break;

    case WStype_PING:
      // library handles pong automatically
      break;

    case WStype_PONG:
      break;

    default:
      Serial.printf("WebSocket event type: %d\n", (int)type);
      break;
  }
}

// =====================================================
// START WEBSOCKET
// =====================================================

void startWebSocket() {

  if (!isConfigured()) {

    Serial.println(
      "Cannot start WebSocket: "
      "configuration incomplete."
    );

    return;
  }

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println(
      "Cannot start WebSocket: "
      "WiFi not connected."
    );

    return;
  }

  createWebSocketPath();

  // Sanitize again in case flash still has an old https:// value
  websocketHost = sanitizeHost(websocketHost);

  bool useSsl = hostNeedsSsl(websocketHost);
  uint16_t port = useSsl ? WEBSOCKET_PORT_SSL : WEBSOCKET_PORT_LOCAL;

  Serial.println();
  Serial.println(
    useSsl
      ? "Starting secure WebSocket (wss)..."
      : "Starting plain WebSocket (ws)..."
  );

  Serial.print("Host: ");
  Serial.println(websocketHost);

  Serial.print("Port: ");
  Serial.println(port);

  Serial.print("URL form: ");
  Serial.print(useSsl ? "wss://" : "ws://");
  Serial.print(websocketHost);
  Serial.print(":");
  Serial.print(port);
  Serial.println("/socket?token=********");

  if (useSsl) {
    // ngrok / public HTTPS → WSS on 443
    // Note: older WebSockets libraries do not have setInsecure().
    // beginSSL() is enough for many ESP32 + ngrok setups.
    webSocket.beginSSL(
      websocketHost.c_str(),
      port,
      websocketPath.c_str()
    );

    // Free ngrok interstitial can block some clients without this header
    if (websocketHost.indexOf("ngrok") != -1) {
      webSocket.setExtraHeaders(
        "ngrok-skip-browser-warning: true\r\n"
      );
    }
  } else {
    // Same LAN as PC → plain WS to local backend port
    webSocket.begin(
      websocketHost.c_str(),
      port,
      websocketPath.c_str()
    );
  }

  webSocket.onEvent(
    webSocketEvent
  );

  // Reconnect automatically every 5 seconds
  webSocket.setReconnectInterval(
    5000
  );

  // Keepalive helps through NAT / ngrok
  webSocket.enableHeartbeat(15000, 3000, 2);

  Serial.println(
    "WebSocket client started."
  );
}

// =====================================================
// TOGGLE CONNECTION
// =====================================================

void handleToggleConnection() {

  if (wsConnected) {

    // Stop sending
    sendEnabled = false;

    saveState(false);

    webSocket.disconnect();

    wsConnected = false;

    digitalWrite(
      LED_PIN,
      LOW
    );

    Serial.println(
      "WebSocket manually disconnected."
    );

  } else {

    if (!isConfigured()) {

      server.send(
        400,
        "text/html",
        "<html>"
        "<body>"
        "<h2>Device is not configured.</h2>"
        "<a href='/'>Go Back</a>"
        "</body>"
        "</html>"
      );

      return;
    }

    if (
      WiFi.status() != WL_CONNECTED
    ) {

      server.send(
        400,
        "text/html",
        "<html>"
        "<body>"
        "<h2>WiFi is not connected.</h2>"
        "<a href='/'>Go Back</a>"
        "</body>"
        "</html>"
      );

      return;
    }

    sendEnabled = true;

    saveState(true);

    startWebSocket();
  }

  server.sendHeader(
    "Location",
    "/"
  );

  server.send(
    302,
    "text/plain",
    ""
  );
}

// =====================================================
// SAVE CONFIGURATION
// =====================================================

void handleSaveConfig() {

  bool alreadyConfigured =
    isConfigured();

  String ssid =
    server.arg("ssid");

  String pass =
    server.arg("password");

  String id =
    server.arg("deviceId");

  String secret =
    server.arg("deviceSecret");

  String host =
    server.arg("deviceHost");

  // Remove accidental spaces
  ssid.trim();
  pass.trim();
  id.trim();
  secret.trim();
  host = sanitizeHost(host);

  // ===================================================
  // DURING RECONFIGURATION
  //
  // Empty password = keep existing password
  // Empty secret   = keep existing secret
  // ===================================================

  if (alreadyConfigured) {

    if (pass.length() == 0) {

      pass =
        wifiPassword;
    }

    if (secret.length() == 0) {

      secret =
        deviceSecret;
    }
  }

  // ===================================================
  // VALIDATE
  // ===================================================

  if (
    ssid == "" ||
    pass == "" ||
    id == "" ||
    secret == "" ||
    host == ""
  ) {

    server.send(
      400,
      "text/html",
      "<html>"
      "<head>"
      "<meta name='viewport' "
      "content='width=device-width,initial-scale=1'>"
      "</head>"
      "<body>"
      "<h2>All fields are required.</h2>"
      "<a href='/'>Go Back</a>"
      "</body>"
      "</html>"
    );

    return;
  }

  // ===================================================
  // DISCONNECT EXISTING WEBSOCKET
  // ===================================================

  if (wsConnected) {

    webSocket.disconnect();

    wsConnected = false;

    digitalWrite(
      LED_PIN,
      LOW
    );

    Serial.println(
      "Existing WebSocket disconnected."
    );
  }

  // ===================================================
  // SAVE NEW CONFIGURATION
  // ===================================================

  saveConfig(
    ssid,
    pass,
    id,
    secret,
    host
  );

  // Update RAM variables too
  wifiSSID = ssid;
  wifiPassword = pass;

  deviceId = id;
  deviceSecret = secret;

  websocketHost = host;

  // ===================================================
  // SHOW SUCCESS
  // ===================================================

  server.send(
    200,
    "text/html",
    "<!DOCTYPE html>"
    "<html>"
    "<head>"
    "<meta name='viewport' "
    "content='width=device-width,initial-scale=1'>"
    "<meta http-equiv='refresh' "
    "content='2;url=/'>"
    "</head>"
    "<body style='font-family:Arial;"
    "text-align:center;padding:40px'>"
    "<h2>Configuration Saved!</h2>"
    "<p>Restarting ESP32...</p>"
    "</body>"
    "</html>"
  );

  delay(1200);

  ESP.restart();
}

// =====================================================
// RECONFIGURE PAGE
// =====================================================

void handleReconfigure() {

  if (!isConfigured()) {

    server.sendHeader(
      "Location",
      "/"
    );

    server.send(
      302,
      "text/plain",
      ""
    );

    return;
  }

  String page = R"rawliteral(
<!DOCTYPE html>
<html>

<head>

<meta name="viewport"
      content="width=device-width,initial-scale=1">

<title>Reconfigure ESP32</title>

<style>

body {
  font-family: Arial, sans-serif;
  background: #f4f6f8;
  padding: 20px;
  margin: 0;
}

.container {
  max-width: 500px;
  margin: 20px auto;
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 3px 15px rgba(0,0,0,.1);
}

h2 {
  margin-top: 0;
  color: #333;
}

.info {
  background: #fff3cd;
  color: #856404;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 20px;
}

label {
  display: block;
  margin-top: 15px;
  font-weight: bold;
}

input {
  width: 100%;
  padding: 12px;
  margin-top: 6px;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 15px;
}

button {
  width: 100%;
  padding: 13px;
  margin-top: 20px;
  border: none;
  border-radius: 6px;
  background: #007bff;
  color: white;
  font-size: 16px;
  cursor: pointer;
}

button:hover {
  background: #0069d9;
}

.cancel {
  display: block;
  text-align: center;
  margin-top: 15px;
  color: #555;
  text-decoration: none;
}

</style>

</head>

<body>

<div class="container">

<h2>Reconfigure Device</h2>

<div class="info">

<strong>Note:</strong><br>

Leave WiFi Password or Device Secret
empty if you want to keep the existing value.

</div>

<form method="POST"
      action="/save">

<label>
WiFi SSID
</label>

<input
  type="text"
  name="ssid"
  value="%SSID%"
  required
>

<label>
WiFi Password
</label>

<input
  type="password"
  name="password"
  placeholder="Leave empty to keep existing"
>

<label>
Device ID
</label>

<input
  type="text"
  name="deviceId"
  value="%DEVICEID%"
  required
>

<label>
Device Secret / Token
</label>

<input
  type="password"
  name="deviceSecret"
  placeholder="Leave empty to keep existing"
>

<label>
Server Host (ngrok domain or PC IP)
</label>

<input
  type="text"
  name="deviceHost"
  value="%HOST%"
  placeholder="xxxx.ngrok-free.app"
  required
>

<p>
<strong>For ngrok (recommended):</strong><br>
Paste only the host, example:<br>
<code>c1f1-....ngrok-free.app</code><br>
ESP32 will connect with<br>
<code>wss://HOST:443/socket?token=...</code>
<br><br>
<strong>For local WiFi only:</strong><br>
Enter PC IP like <code>192.168.1.10</code><br>
ESP32 will use <code>ws://IP:4000/...</code>
<br><br>
<strong>Device Secret</strong> = token from dashboard.
</p>

<button type="submit">
Save New Configuration
</button>

</form>

<a class="cancel"
   href="/">
Cancel
</a>

</div>

</body>
</html>
)rawliteral";

  page.replace(
    "%SSID%",
    wifiSSID
  );

  page.replace(
    "%DEVICEID%",
    deviceId
  );

  page.replace(
    "%HOST%",
    websocketHost
  );

  server.send(
    200,
    "text/html",
    page
  );
}

// =====================================================
// ROOT PAGE
// =====================================================

void handleRoot() {

  // ===================================================
  // SETUP PAGE
  // ===================================================

  if (!isConfigured()) {

    String setupPage = R"rawliteral(
<!DOCTYPE html>
<html>

<head>

<meta name="viewport"
      content="width=device-width,initial-scale=1">

<title>ESP32 Monitor Setup</title>

<style>

body {
  font-family: Arial, sans-serif;
  background: #f4f6f8;
  padding: 20px;
  margin: 0;
}

.container {
  max-width: 500px;
  margin: 20px auto;
  background: white;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 3px 15px rgba(0,0,0,.1);
}

h2 {
  margin-top: 0;
}

label {
  display: block;
  margin-top: 15px;
  font-weight: bold;
}

input {
  width: 100%;
  padding: 12px;
  margin-top: 6px;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 15px;
}

button {
  width: 100%;
  padding: 13px;
  margin-top: 20px;
  border: none;
  border-radius: 6px;
  background: #007bff;
  color: white;
  font-size: 16px;
}

.info {
  background: #e9f5ff;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 20px;
}

</style>

</head>

<body>

<div class="container">

<h2>ESP32 Monitor Setup</h2>

<div class="info">

Connect this ESP32 to your WiFi and
configure the WebSocket connection.

</div>

<form method="POST"
      action="/save">

<label>
WiFi SSID
</label>

<input
  type="text"
  name="ssid"
  placeholder="Your WiFi name"
  required
>

<label>
WiFi Password
</label>

<input
  type="password"
  name="password"
  placeholder="Your WiFi password"
  required
>

<label>
Device ID
</label>

<input
  type="text"
  name="deviceId"
  placeholder="Device ID"
  required
>

<label>
Device Secret / Token
</label>

<input
  type="password"
  name="deviceSecret"
  placeholder="Device Secret"
  required
>

<label>
Server Host (ngrok domain or PC IP)
</label>

<input
  type="text"
  name="deviceHost"
  placeholder="xxxx.ngrok-free.app"
  required
>

<p>

<strong>For ngrok:</strong><br>
Enter only:<br>
<code>c1f1-....ngrok-free.app</code><br>
ESP32 uses<br>
<code>wss://HOST:443/socket?token=...</code>

<br><br>

Do not paste
<code>https://</code>
or the port.

<br><br>

<strong>Device Secret</strong> = token
copied from the dashboard device page.

</p>

<button type="submit">
Save Configuration
</button>

</form>

</div>

</body>
</html>
)rawliteral";

    server.send(
      200,
      "text/html",
      setupPage
    );

    return;
  }

  // ===================================================
  // READ SENSOR
  // ===================================================

  float temperature =
    dht.readTemperature();

  float humidity =
    dht.readHumidity();

  String tempText =
    isnan(temperature)
      ? "N/A"
      : String(
          temperature,
          1
        );

  String humText =
    isnan(humidity)
      ? "N/A"
      : String(
          humidity,
          1
        );

  // ===================================================
  // STATUS
  // ===================================================

  String wsStatus =
    wsConnected
      ? "Connected"
      : "Disconnected";

  String wsColor =
    wsConnected
      ? "#28a745"
      : "#dc3545";

  String sendingStatus =
    sendEnabled
      ? "Enabled"
      : "Disabled";

  String sendingColor =
    sendEnabled
      ? "#28a745"
      : "#dc3545";

  String buttonText =
    wsConnected
      ? "Disconnect WebSocket"
      : "Connect WebSocket";

  String buttonColor =
    wsConnected
      ? "#dc3545"
      : "#007bff";

  // ===================================================
  // DASHBOARD HTML
  // ===================================================

  String html = R"rawliteral(
<!DOCTYPE html>
<html>

<head>

<meta name="viewport"
      content="width=device-width,initial-scale=1">

<meta http-equiv="refresh"
      content="10">

<title>ESP32 Monitor</title>

<style>

body {
  font-family: Arial, sans-serif;
  background: #f4f6f8;
  padding: 20px;
  margin: 0;
}

.container {
  max-width: 650px;
  margin: auto;
}

.title {
  text-align: center;
  margin-bottom: 20px;
}

.card {
  background: white;
  padding: 20px;
  margin-bottom: 15px;
  border-radius: 12px;
  box-shadow: 0 3px 12px rgba(0,0,0,.08);
}

.sensor-container {
  display: flex;
  gap: 15px;
}

.sensor {
  flex: 1;
  text-align: center;
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 3px 12px rgba(0,0,0,.08);
}

.sensor-title {
  color: #666;
  font-size: 15px;
}

.sensor-value {
  font-size: 32px;
  font-weight: bold;
  margin-top: 10px;
}

.status {
  font-weight: bold;
}

.green {
  color: #28a745;
}

.red {
  color: #dc3545;
}

.info-row {
  margin: 9px 0;
  word-break: break-word;
}

button {
  width: 100%;
  padding: 13px;
  border: none;
  border-radius: 7px;
  color: white;
  font-size: 16px;
  cursor: pointer;
}

.reconfigure {
  background: #ffc107;
  color: #000;
  margin-top: 10px;
}

.small {
  color: #777;
  font-size: 13px;
  margin-top: 15px;
}

@media(max-width:500px) {

  .sensor-container {
    flex-direction: column;
  }

}

</style>

</head>

<body>

<div class="container">

<div class="title">

<h2>ESP32 Monitor</h2>

</div>

<div class="sensor-container">

<div class="sensor">

<div class="sensor-title">
Temperature
</div>

<div class="sensor-value">
%TEMP% &deg;C
</div>

</div>

<div class="sensor">

<div class="sensor-title">
Humidity
</div>

<div class="sensor-value">
%HUM% %
</div>

</div>

</div>

<br>

<div class="card">

<h3>Device Information</h3>

<div class="info-row">
<strong>Device ID:</strong>
%DEVICEID%
</div>

<div class="info-row">
<strong>WebSocket Host:</strong>
%HOST%
</div>

<div class="info-row">
<strong>WebSocket Port:</strong>
4000
</div>

<div class="info-row">
<strong>WebSocket Status:</strong>

<span
  class="status"
  style="color:%WSCOLOR%"
>
%WSSTATUS%
</span>

</div>

<div class="info-row">
<strong>Send Interval:</strong>
%INT% ms
</div>

<div class="info-row">
<strong>Sending:</strong>

<span
  class="status"
  style="color:%SENDCOLOR%"
>
%SENDSTATUS%
</span>

</div>

</div>

<div class="card">

<form method="POST"
      action="/toggle">

<button
  type="submit"
  style="background:%BUTTONCOLOR%"
>
%BUTTON%
</button>

</form>

<a href="/reconfigure"
   style="text-decoration:none">

<button
  type="button"
  class="reconfigure"
>
Reconfigure Device
</button>

</a>

<div class="small">

The ESP32 will restart after saving a new
configuration.

</div>

</div>

</div>

</body>
</html>
)rawliteral";

  // ===================================================
  // REPLACE VARIABLES
  // ===================================================

  html.replace(
    "%TEMP%",
    tempText
  );

  html.replace(
    "%HUM%",
    humText
  );

  html.replace(
    "%INT%",
    String(sendInterval)
  );

  html.replace(
    "%WSCOLOR%",
    wsColor
  );

  html.replace(
    "%WSSTATUS%",
    wsStatus
  );

  html.replace(
    "%DEVICEID%",
    deviceId
  );

  html.replace(
    "%HOST%",
    websocketHost
  );

  html.replace(
    "%SENDSTATUS%",
    sendingStatus
  );

  html.replace(
    "%SENDCOLOR%",
    sendingColor
  );

  html.replace(
    "%BUTTON%",
    buttonText
  );

  html.replace(
    "%BUTTONCOLOR%",
    buttonColor
  );

  server.send(
    200,
    "text/html",
    html
  );
}

// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(115200);

  delay(500);

  Serial.println();
  Serial.println(
    "================================"
  );

  Serial.println(
    "ESP32 MONITOR STARTING"
  );

  Serial.println(
    "================================"
  );

  // ===================================================
  // DHT
  // ===================================================

  dht.begin();

  // ===================================================
  // LED
  // ===================================================

  pinMode(
    LED_PIN,
    OUTPUT
  );

  digitalWrite(
    LED_PIN,
    LOW
  );

  // ===================================================
  // LOAD SAVED CONFIGURATION
  // ===================================================

  loadSettings();

  // ===================================================
  // START CONFIGURATION AP
  // ===================================================

  WiFi.mode(
    WIFI_AP_STA
  );

  WiFi.softAP(
    AP_NAME,
    AP_PASSWORD
  );

  Serial.println();
  Serial.println(
    "Configuration Access Point:"
  );

  Serial.print(
    "SSID: "
  );

  Serial.println(
    AP_NAME
  );

  Serial.print(
    "Password: "
  );

  Serial.println(
    AP_PASSWORD
  );

  Serial.print(
    "AP IP: "
  );

  Serial.println(
    WiFi.softAPIP()
  );

  // ===================================================
  // CONNECT TO WIFI + WEBSOCKET
  // ===================================================

  if (isConfigured()) {

    connectWiFi();

    if (
      WiFi.status() == WL_CONNECTED
    ) {

      startWebSocket();
    }

  } else {

    Serial.println();
    Serial.println(
      "Device is not configured."
    );

    Serial.println(
      "Connect to the ESP32 AP and configure it."
    );
  }

  // ===================================================
  // WEB SERVER ROUTES
  // ===================================================

  server.on(
    "/",
    HTTP_GET,
    handleRoot
  );

  server.on(
    "/toggle",
    HTTP_POST,
    handleToggleConnection
  );

  server.on(
    "/save",
    HTTP_POST,
    handleSaveConfig
  );

  server.on(
    "/reconfigure",
    HTTP_GET,
    handleReconfigure
  );

  // ===================================================
  // START WEB SERVER
  // ===================================================

  server.begin();

  Serial.println();
  Serial.println(
    "Web server started."
  );

  Serial.println(
    "================================"
  );

  Serial.println();
}

// =====================================================
// LOOP
// =====================================================

void loop() {

  // ===================================================
  // HANDLE WEB SERVER
  // ===================================================

  server.handleClient();

  // ===================================================
  // WEBSOCKET
  // ===================================================

  if (isConfigured()) {

    webSocket.loop();

    // =================================================
    // SEND SENSOR DATA
    // =================================================

    if (
      sendEnabled &&
      wsConnected &&
      millis() - lastUpdate >= sendInterval
    ) {

      float temperature =
        dht.readTemperature();

      float humidity =
        dht.readHumidity();

      if (
        !isnan(temperature) &&
        !isnan(humidity)
      ) {

        // Backend expects:
        // {"type":"reading","temperature":23.5,"humidity":55.0}
        String msg =
          "{\"type\":\"reading\","
          "\"temperature\":" +
          String(
            temperature,
            1
          ) +
          ","
          "\"humidity\":" +
          String(
            humidity,
            1
          ) +
          "}";

        webSocket.sendTXT(
          msg
        );

        Serial.println(
          "Sensor data sent:"
        );

        Serial.println(
          msg
        );

      } else {

        Serial.println(
          "Failed to read DHT11 sensor."
        );
      }

      lastUpdate =
        millis();
    }
  }
}