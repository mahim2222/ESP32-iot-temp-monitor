import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AuthCheck from "@/components/layout/auth-check";
import Layout from "@/components/layout/layout";
import {
  createDevice,
  DEVICE_SENSOR_OPTIONS,
  deleteDevice,
  listDevices,
  updateDeviceName,
  type Device,
  type DeviceSensor,
  type DeviceStatus,
} from "@/lib/devices-api";
import { useLiveStatusMap } from "@/lib/realtime";
import type { NextPageWithLayout } from "../_app";

const POLL_INTERVAL_MS = 5000;

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatRelative(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return "—";
  const diff = Math.max(0, Date.now() - d);
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return formatDate(iso);
}

function formatTemperature(t?: number | null): string {
  if (t === null || t === undefined || !Number.isFinite(t)) return "—";
  return `${t.toFixed(1)}°C`;
}

function formatHumidity(h?: number | null): string {
  if (h === null || h === undefined || !Number.isFinite(h)) return "—";
  return `${h.toFixed(1)}%`;
}

function extractMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "response" in err &&
    err.response &&
    typeof err.response === "object" &&
    "data" in err.response &&
    err.response.data &&
    typeof err.response.data === "object" &&
    "message" in err.response.data &&
    typeof (err.response.data as { message: unknown }).message === "string"
  ) {
    return (err.response.data as { message: string }).message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

function StatusBadge({ status }: { status: DeviceStatus }) {
  const isOnline = status === "online";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        isOnline
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
          : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
        }`}
      />
      {isOnline ? "Online" : "Offline"}
    </span>
  );
}

const DevicesPage: NextPageWithLayout = () => {
  const liveStatus = useLiveStatusMap();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [sensor, setSensor] = useState<DeviceSensor>("DHT11");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState(false);

  const initialLoadDone = useRef(false);

  const loadDevices = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const list = await listDevices();
      setDevices(list);
      if (!opts?.silent) setError(null);
    } catch (err) {
      if (!opts?.silent) {
        setError(extractMessage(err, "Failed to load devices"));
      }
    } finally {
      if (!opts?.silent) setLoading(false);
      initialLoadDone.current = true;
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    const id = setInterval(() => {
      if (initialLoadDone.current) {
        void loadDevices({ silent: true });
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadDevices]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const device = await createDevice({ name, username, sensor });
      setDevices((prev) => [device, ...prev]);
      setName("");
      setUsername("");
      setSensor("DHT11");
    } catch (err) {
      setError(extractMessage(err, "Failed to create device"));
    } finally {
      setSubmitting(false);
    }
  }

  function beginEdit(device: Device) {
    setEditingId(device.id);
    setEditingName(device.name);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function saveEdit(deviceId: string) {
    if (!editingName.trim()) {
      setError("Name cannot be empty");
      return;
    }
    setEditSaving(true);
    setError(null);
    try {
      const updated = await updateDeviceName(deviceId, editingName);
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? updated : d)));
      cancelEdit();
    } catch (err) {
      setError(extractMessage(err, "Failed to update device"));
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDevice(deleteTarget.id);
      setDevices((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(extractMessage(err, "Failed to delete device"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Devices</h1>
        <p className="mt-1 text-sm text-slate-500">
          Register ESP32 devices. Each device receives a unique token for WebSocket
          connection:{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            wss://host/socket?token=&lt;token&gt;
          </code>
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Add device</h2>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="device-name" className="block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              id="device-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              placeholder="Living room sensor"
            />
          </div>
          <div>
            <label htmlFor="device-username" className="block text-sm font-medium text-slate-700">
              Username
            </label>
            <input
              id="device-username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              placeholder="living-room-01"
            />
            <p className="mt-1 text-xs text-slate-500">Globally unique across all devices.</p>
          </div>
          <div>
            <label htmlFor="device-sensor" className="block text-sm font-medium text-slate-700">
              Sensor
            </label>
            <select
              id="device-sensor"
              required
              value={sensor}
              onChange={(e) => setSensor(e.target.value as DeviceSensor)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            >
              {DEVICE_SENSOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-300/50 transition hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? "Creating…" : "Create device"}
            </button>
          </div>
        </form>
        {error && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Your devices</h2>
        </div>
        {loading ? (
          <p className="px-6 py-8 text-sm text-slate-500">Loading devices…</p>
        ) : devices.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500">No devices yet. Create one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Temperature</th>
                  <th className="px-6 py-3">Humidity</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Last reading</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.map((device) => {
                  const isEditing = editingId === device.id;
                  const reading = device.latest_reading;
                  const effectiveStatus = liveStatus[device.id] ?? device.status;
                  return (
                    <tr key={device.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            autoFocus
                            className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          />
                        ) : (
                          device.name
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-700 tabular-nums">
                        {formatTemperature(reading?.temperature)}
                      </td>
                      <td className="px-6 py-4 text-slate-700 tabular-nums">
                        {formatHumidity(reading?.humidity)}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={effectiveStatus} />
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {reading ? formatRelative(reading.ts) : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={editSaving}
                                onClick={() => void saveEdit(device.id)}
                                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                              >
                                {editSaving ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                disabled={editSaving}
                                onClick={cancelEdit}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <Link
                                href={`/devices/${device.id}`}
                                className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                              >
                                View
                              </Link>
                              <button
                                type="button"
                                onClick={() => beginEdit(device)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(device)}
                                className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">Delete device?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently delete{" "}
              <span className="font-semibold text-slate-900">{deleteTarget.name}</span> (
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                {deleteTarget.username}
              </code>
              ). The token will stop working immediately. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

DevicesPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthCheck>
      <Layout>{page}</Layout>
    </AuthCheck>
  );
};

export default DevicesPage;
