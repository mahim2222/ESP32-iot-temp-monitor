import { axiosInstance } from "@/utils/axios-instance";

export type DeviceSensor = "DHT11";
export type DeviceStatus = "online" | "offline";
export type DataTransferState = "start" | "stop";

export type LatestReading = {
  temperature: number;
  humidity: number;
  ts: string;
};

export type Device = {
  id: string;
  name: string;
  username: string;
  sensor: DeviceSensor;
  token: string;
  status: DeviceStatus;
  delay_ms: number;
  data_transfer: DataTransferState;
  latest_reading: LatestReading | null;
  created_at?: string;
  updated_at?: string;
};

export const DEVICE_SENSOR_OPTIONS: { value: DeviceSensor; label: string }[] = [
  { value: "DHT11", label: "DHT11" },
];

export const DELAY_OPTIONS: { label: string; valueMs: number }[] = [
  { label: "3 seconds", valueMs: 3_000 },
  { label: "15 seconds", valueMs: 15_000 },
  { label: "30 seconds", valueMs: 30_000 },
  { label: "1 minute", valueMs: 60_000 },
  { label: "10 minutes", valueMs: 600_000 },
  { label: "30 minutes", valueMs: 1_800_000 },
  { label: "1 hour", valueMs: 3_600_000 },
  { label: "1.5 hours", valueMs: 5_400_000 },
  { label: "2 hours", valueMs: 7_200_000 },
];

export type DeviceCommand =
  | { type: "delay"; value: number }
  | { type: "data_transfer"; value: "start" | "stop" };

export async function listDevices(): Promise<Device[]> {
  const res = await axiosInstance.get<{ devices: Device[] }>("/devices");
  return res.data.devices ?? [];
}

export async function getDevice(id: string): Promise<Device> {
  const res = await axiosInstance.get<{ device: Device }>(`/devices/${id}`);
  return res.data.device;
}

export async function createDevice(input: {
  name: string;
  username: string;
  sensor: DeviceSensor;
}): Promise<Device> {
  const res = await axiosInstance.post<{ device: Device }>("/devices", input);
  return res.data.device;
}

export async function updateDeviceName(id: string, name: string): Promise<Device> {
  const res = await axiosInstance.patch<{ device: Device }>(`/devices/${id}`, { name });
  return res.data.device;
}

export async function deleteDevice(id: string): Promise<void> {
  await axiosInstance.delete(`/devices/${id}`);
}

export type DeviceStats = {
  total: number;
  online: number;
};

export async function getDeviceStats(): Promise<DeviceStats> {
  const res = await axiosInstance.get<DeviceStats>("/devices/stats");
  return res.data;
}

export async function sendDeviceCommand(id: string, command: DeviceCommand): Promise<void> {
  await axiosInstance.post(`/devices/${id}/command`, command);
}
