import type { WebSocket } from "ws";

export type DeviceSocket = WebSocket & {
  deviceId?: string;
  userId?: string;
  username?: string;
  isAlive?: boolean;
};

export const deviceSockets = new Map<string, DeviceSocket>();

export function isDeviceOnline(deviceId: string): boolean {
  return deviceSockets.has(deviceId);
}

export function getOnlineDeviceIdsForUser(userId: string): string[] {
  const ids: string[] = [];
  for (const [id, ws] of deviceSockets) {
    if (ws.userId === userId) ids.push(id);
  }
  return ids;
}
