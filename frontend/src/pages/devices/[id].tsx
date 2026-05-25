import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import AuthCheck from "@/components/layout/auth-check";
import Layout from "@/components/layout/layout";
import {
  DELAY_OPTIONS,
  getDevice,
  sendDeviceCommand,
  type DataTransferState,
  type Device,
  type DeviceCommand,
  type DeviceStatus,
} from "@/lib/devices-api";
import { useLiveStatus } from "@/lib/realtime";
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
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
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

const DeviceDetailPage: NextPageWithLayout = () => {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : undefined;
  const liveStatus = useLiveStatus(id);

  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [delayMs, setDelayMs] = useState<number>(DELAY_OPTIONS[0].valueMs);
  const [delayTouched, setDelayTouched] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [commandMessage, setCommandMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  const effectiveStatus: DeviceStatus | undefined = liveStatus ?? device?.status;
  const isOnline = effectiveStatus === "online";
  const dataTransfer: DataTransferState = device?.data_transfer ?? "start";

  const isMounted = useRef(true);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!id) return;
      if (!opts?.silent) setLoading(true);
      try {
        const d = await getDevice(id);
        if (!isMounted.current) return;
        setDevice(d);
        if (!opts?.silent) setError(null);
      } catch (err) {
        if (!isMounted.current) return;
        if (!opts?.silent) {
          setError(extractMessage(err, "Failed to load device"));
        }
      } finally {
        if (isMounted.current && !opts?.silent) setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    void load();
  }, [router.isReady, load]);

  useEffect(() => {
    if (!device || delayTouched) return;
    setDelayMs(device.delay_ms);
  }, [device, delayTouched]);

  useEffect(() => {
    if (!router.isReady || !id) return;
    const t = setInterval(() => {
      void load({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [router.isReady, id, load]);

  async function copyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy token to clipboard");
    }
  }

  async function runCommand(key: string, command: DeviceCommand, okText: string) {
    if (!id || pendingCommand) return;
    setPendingCommand(key);
    setCommandMessage(null);
    try {
      await sendDeviceCommand(id, command);
      setCommandMessage({ kind: "ok", text: okText });
      setDevice((prev) =>
        prev
          ? command.type === "delay"
            ? { ...prev, delay_ms: command.value }
            : { ...prev, data_transfer: command.value }
          : prev
      );
      if (command.type === "delay") setDelayTouched(false);
    } catch (err) {
      setCommandMessage({ kind: "error", text: extractMessage(err, "Failed to send command") });
    } finally {
      setPendingCommand(null);
      setTimeout(() => {
        setCommandMessage((prev) => (prev?.kind === "ok" ? null : prev));
      }, 2500);
    }
  }

  function formatDelay(ms: number): string {
    const match = DELAY_OPTIONS.find((opt) => opt.valueMs === ms);
    return match ? `${match.label} (${ms} ms)` : `${ms} ms`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/devices"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            ← Back to devices
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            {device?.name ?? (loading ? "Loading…" : "Device")}
          </h1>
          {device && (
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-mono text-xs">{device.username}</span> · {device.sensor}
            </p>
          )}
        </div>
        {device && effectiveStatus && <StatusBadge status={effectiveStatus} />}
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}

      {loading && !device ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-sm text-slate-500 shadow-sm">
          Loading device…
        </p>
      ) : !device ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-sm text-slate-500 shadow-sm">
          Device not found.
        </p>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Temperature</p>
              <h2 className="mt-3 text-4xl font-semibold text-slate-900 tabular-nums">
                {formatTemperature(device.latest_reading?.temperature)}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {device.latest_reading
                  ? `Updated ${formatRelative(device.latest_reading.ts)}`
                  : "No reading yet"}
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Humidity</p>
              <h2 className="mt-3 text-4xl font-semibold text-slate-900 tabular-nums">
                {formatHumidity(device.latest_reading?.humidity)}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {device.latest_reading
                  ? `Updated ${formatRelative(device.latest_reading.ts)}`
                  : "No reading yet"}
              </p>
            </article>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Controls</h2>
              {!isOnline && (
                <span className="text-xs text-slate-500">
                  Device must be online to receive commands
                </span>
              )}
            </div>
            <div className="space-y-5 px-6 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label
                    htmlFor="delay-select"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Reading interval
                  </label>
                  <select
                    id="delay-select"
                    value={delayMs}
                    onChange={(e) => {
                      setDelayTouched(true);
                      setDelayMs(Number(e.target.value));
                    }}
                    disabled={!isOnline || pendingCommand !== null}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
                  >
                    {DELAY_OPTIONS.map((opt) => (
                      <option key={opt.valueMs} value={opt.valueMs}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    Sent as <code className="rounded bg-slate-100 px-1 py-0.5">{delayMs}</code> ms.
                    {device && (
                      <>
                        {" "}
                        Currently applied:{" "}
                        <span className="font-medium text-slate-700">
                          {formatDelay(device.delay_ms)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!isOnline || pendingCommand !== null}
                  onClick={() =>
                    void runCommand(
                      "delay",
                      { type: "delay", value: delayMs },
                      `Delay set to ${delayMs} ms`
                    )
                  }
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {pendingCommand === "delay" ? "Applying…" : "Apply delay"}
                </button>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-700">Data transfer</p>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        dataTransfer === "start"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                          : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
                      }`}
                    >
                      {dataTransfer === "start" ? "Running" : "Stopped"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Start or stop the device from sending temperature and humidity readings.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={
                      !isOnline || pendingCommand !== null || dataTransfer === "start"
                    }
                    onClick={() =>
                      void runCommand(
                        "start",
                        { type: "data_transfer", value: "start" },
                        "Data transfer started"
                      )
                    }
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                      dataTransfer === "start"
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "bg-emerald-600 text-white hover:bg-emerald-500"
                    }`}
                  >
                    {pendingCommand === "start"
                      ? "Starting…"
                      : dataTransfer === "start"
                        ? "Started"
                        : "Start"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      !isOnline || pendingCommand !== null || dataTransfer === "stop"
                    }
                    onClick={() =>
                      void runCommand(
                        "stop",
                        { type: "data_transfer", value: "stop" },
                        "Data transfer stopped"
                      )
                    }
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                      dataTransfer === "stop"
                        ? "border border-rose-200 bg-rose-50 text-rose-700"
                        : "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                    }`}
                  >
                    {pendingCommand === "stop"
                      ? "Stopping…"
                      : dataTransfer === "stop"
                        ? "Stopped"
                        : "Stop"}
                  </button>
                </div>
              </div>

              {commandMessage && (
                <p
                  role="status"
                  className={`rounded-lg px-3 py-2 text-sm ${
                    commandMessage.kind === "ok"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {commandMessage.text}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Details</h2>
            </div>
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Name" value={device.name} />
              <DetailRow label="Username" value={device.username} mono />
              <DetailRow label="Sensor" value={device.sensor} />
              <DetailRow
                label="Status"
                value={effectiveStatus === "online" ? "Online" : "Offline"}
              />
              <DetailRow label="Reading interval" value={formatDelay(device.delay_ms)} />
              <DetailRow
                label="Data transfer"
                value={device.data_transfer === "start" ? "Running" : "Stopped"}
              />
              <DetailRow
                label="Last reading"
                value={
                  device.latest_reading
                    ? `${formatDate(device.latest_reading.ts)} (${formatRelative(device.latest_reading.ts)})`
                    : "No data yet"
                }
              />
              <DetailRow
                label="Token"
                value={device.token}
                mono
                action={
                  <button
                    type="button"
                    onClick={() => void copyToken(device.token)}
                    className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                }
              />
              <DetailRow label="Created" value={formatDate(device.created_at)} />
              <DetailRow label="Updated" value={formatDate(device.updated_at)} />
            </dl>
          </section>
        </>
      )}
    </div>
  );
};

function DetailRow({
  label,
  value,
  mono,
  action,
}: {
  label: string;
  value: string;
  mono?: boolean;
  action?: ReactElement;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 py-4">
      <dt className="w-32 shrink-0 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="flex flex-1 items-center justify-end gap-2 min-w-0">
        <span
          className={`text-right text-sm text-slate-900 break-all ${
            mono ? "rounded bg-slate-100 px-2 py-1 font-mono text-xs" : ""
          }`}
        >
          {value}
        </span>
        {action}
      </dd>
    </div>
  );
}

DeviceDetailPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthCheck>
      <Layout>{page}</Layout>
    </AuthCheck>
  );
};

export default DeviceDetailPage;
