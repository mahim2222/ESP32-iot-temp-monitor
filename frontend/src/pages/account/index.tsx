import type { ReactElement } from "react";
import AuthCheck from "@/components/layout/auth-check";
import Layout from "@/components/layout/layout";
import type { NextPageWithLayout } from "../_app";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";

const AccountPage: NextPageWithLayout = () => {
  const user = useSelector((s: RootState) => s.auth.user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Account</h1>
        <p className="mt-1 text-sm text-slate-500">Your profile information.</p>
      </div>
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-medium text-slate-500">Name</dt>
            <dd className="mt-1 text-slate-900">{user?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Email</dt>
            <dd className="mt-1 text-slate-900">{user?.email ?? "—"}</dd>
          </div>
        </dl>
      </article>
    </div>
  );
};

AccountPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthCheck>
      <Layout>{page}</Layout>
    </AuthCheck>
  );
};

export default AccountPage;
