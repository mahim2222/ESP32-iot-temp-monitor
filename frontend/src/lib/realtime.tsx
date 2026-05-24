import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AuthToken } from "@/utils/auth";

export type LiveStatus = "online" | "offline";

type RealtimeContextValue = {
  liveStatus: Readonly<Record<string, LiveStatus>>;
  connected: boolean;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  liveStatus: {},
  connected: false,
});

const API_ROOT = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function apiToWsUrl(api: string): string {
  return api.replace(/^http(s?):\/\//i, "ws$1://").replace(/\/$/, "");
}

type ServerEvent =
  | { type: "init"; online_device_ids: string[] }
  | { type: "device:status"; deviceId: string; status: LiveStatus };

function parseEvent(raw: unknown): ServerEvent | null {
  if (typeof raw !== "string") return null;
  try {
    const data = JSON.parse(raw) as { type?: unknown };
    if (data.type === "init") {
      const ids = (data as { online_device_ids?: unknown }).online_device_ids;
      if (Array.isArray(ids) && ids.every((x) => typeof x === "string")) {
        return { type: "init", online_device_ids: ids as string[] };
      }
      return null;
    }
    if (data.type === "device:status") {
      const d = data as { deviceId?: unknown; status?: unknown };
      if (
        typeof d.deviceId === "string" &&
        (d.status === "online" || d.status === "offline")
      ) {
        return { type: "device:status", deviceId: d.deviceId, status: d.status };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [liveStatus, setLiveStatus] = useState<Record<string, LiveStatus>>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    function clearReconnect() {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    }

    function scheduleReconnect() {
      if (cancelled) return;
      clearReconnect();
      const delay = Math.min(15_000, 1000 * 2 ** Math.min(attempt, 4));
      attempt += 1;
      reconnectRef.current = setTimeout(connect, delay);
    }

    function connect() {
      if (cancelled) return;
      const token = AuthToken();
      if (!token) {
        scheduleReconnect();
        return;
      }

      const url = `${apiToWsUrl(API_ROOT)}/app?token=${encodeURIComponent(token)}`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          ws.close();
          return;
        }
        attempt = 0;
        setConnected(true);
      };

      ws.onmessage = (ev) => {
        const event = parseEvent(ev.data);
        if (!event) return;
        if (event.type === "init") {
          const next: Record<string, LiveStatus> = {};
          for (const id of event.online_device_ids) next[id] = "online";
          setLiveStatus(next);
        } else if (event.type === "device:status") {
          setLiveStatus((prev) => ({ ...prev, [event.deviceId]: event.status }));
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        setConnected(false);
        if (!cancelled) scheduleReconnect();
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearReconnect();
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const value = useMemo<RealtimeContextValue>(
    () => ({ liveStatus, connected }),
    [liveStatus, connected]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useLiveStatusMap(): Readonly<Record<string, LiveStatus>> {
  return useContext(RealtimeContext).liveStatus;
}

export function useLiveStatus(deviceId: string | undefined | null): LiveStatus | undefined {
  const map = useContext(RealtimeContext).liveStatus;
  if (!deviceId) return undefined;
  return map[deviceId];
}

export function useRealtimeConnected(): boolean {
  return useContext(RealtimeContext).connected;
}
