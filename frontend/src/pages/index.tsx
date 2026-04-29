import type { ReactElement } from "react";
import AuthCheck from "@/components/layout/auth-check";
import Layout from "@/components/layout/layout";
import type { NextPageWithLayout } from "./_app";

const DashboardPage: NextPageWithLayout = () => {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Total Devices</p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-900">24</h2>
        <p className="mt-1 text-sm text-emerald-600">+2 this week</p>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Online Now</p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-900">19</h2>
        <p className="mt-1 text-sm text-slate-500">Stable connection</p>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2 xl:col-span-1">
        <p className="text-sm font-medium text-slate-500">Average Temp</p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-900">28.4°C</h2>
        <p className="mt-1 text-sm text-amber-600">Slightly above normal</p>
      </article>
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
