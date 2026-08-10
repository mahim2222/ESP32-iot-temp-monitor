import "dotenv/config";
import http from "http";
import { URL } from "url";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { connectDatabase } from "./config/database";
import authRouter from "./routers/auth.router";
import devicesRouter from "./routers/device.router";
import { createAppWss } from "./realtime/app-ws";
import { createDeviceWss } from "./realtime/device-ws";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

const frontendOrigin = process.env.FRONTEND_URL ?? "http://localhost:3000";

app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "600kb" }));

app.get("/", (_req: Request, res: Response) => {
  res.send("Hello, Express server is running!");
});

app.use("/api/auth", authRouter);
app.use("/api/devices", devicesRouter);

async function bootstrap(): Promise<void> {
  if (!process.env.JWT_SECRET) {
    console.error("FATAL: Set JWT_SECRET in your environment (see .env.example)");
    process.exit(1);
  }

  await connectDatabase();

  const server = http.createServer(app);
  const deviceWs = createDeviceWss();
  const appWs = createAppWss();

  server.on("upgrade", (req, socket, head) => {
    let pathname: string;
    try {
      pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    } catch {
      console.warn("[ws] bad upgrade URL:", req.url);
      socket.destroy();
      return;
    }

    console.log(`[ws] upgrade request: ${pathname} from ${req.socket.remoteAddress ?? "?"}`);

    if (pathname === "/socket") {
      deviceWs.handleUpgrade(req, socket, head);
    } else if (pathname === "/app") {
      appWs.handleUpgrade(req, socket, head);
    } else {
      console.warn(`[ws] rejecting unknown path: ${pathname}`);
      socket.destroy();
    }
  });

  server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`Device WS: ws://localhost:${PORT}/socket?token=<deviceToken>`);
    console.log(`App WS:    ws://localhost:${PORT}/app?token=<userJwt>`);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
