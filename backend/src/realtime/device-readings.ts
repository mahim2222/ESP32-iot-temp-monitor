export type LatestReading = {
  temperature: number;
  humidity: number;
  ts: number;
};

const latestReadings = new Map<string, LatestReading>();

export function setLatestReading(deviceId: string, reading: LatestReading): void {
  latestReadings.set(deviceId, reading);
}

export function getLatestReading(deviceId: string): LatestReading | undefined {
  return latestReadings.get(deviceId);
}

export function clearLatestReading(deviceId: string): void {
  latestReadings.delete(deviceId);
}

export function getReadingsSnapshot(): ReadonlyMap<string, LatestReading> {
  return latestReadings;
}
