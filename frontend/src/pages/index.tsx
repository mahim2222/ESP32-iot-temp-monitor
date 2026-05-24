import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import AuthCheck from "@/components/layout/auth-check";
import Layout from "@/components/layout/layout";
import { getDeviceStats, type DeviceStats } from "@/lib/devices-api";
import type { NextPageWithLayout } from "./_app";

const DashboardPage: NextPageWithLayout = () => {
  const [stats, setStats] = useState<DeviceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getDeviceStats();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load stats");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = stats?.total ?? 0;
  const online = stats?.online ?? 0;
  const offline = Math.max(total - online, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Live overview of your ESP32 devices.</p>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total Devices</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900">
            {loading ? "…" : total}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {loading
              ? "Loading…"
              : total === 0
                ? "No devices registered yet"
                : `${total} device${total === 1 ? "" : "s"} in your account`}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Online Now</p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                online > 0
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                  : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  online > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                }`}
              />
              {online > 0 ? "Live" : "Idle"}
            </span>
          </div>
          <h2 className="mt-3 text-3xl font-semibold text-slate-900">
            {loading ? "…" : online}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? "Loading…" : `${offline} offline`}
          </p>
        </article>
      </div>
    </div>
  );
};

DashboardPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthCheck>
      <Layout>{page}</Layout>
    </AuthCheck>
  );
};

export default DashboardPage;
