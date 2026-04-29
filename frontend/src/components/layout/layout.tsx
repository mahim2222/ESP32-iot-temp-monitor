import type { ReactNode } from "react";
import Header from "./header";
import Sidebar from "./sidebar";

type LayoutProps = {
  children: ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <Sidebar />
        <main className="flex-1">
          <Header />
          <section className="p-6 md:p-8">{children}</section>
        </main>
      </div>
    </div>
  );
}
