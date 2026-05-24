import UserAvatar from "@/components/layout/user-avatar";
import { performLogout } from "@/lib/logout";
import type { AppDispatch, RootState } from "@/store";
import Link from "next/link";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";

const menuItems = [
  { label: "Dashboard", href: "/" },
  { label: "Devices", href: "/devices" },
  { label: "Account", href: "/account" },
];

export default function Sidebar() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);
  const profile = useSelector((s: RootState) => s.auth.profile);

  const name = user?.name ?? "Guest";
  const avatarUrl = profile?.avatar ?? "";

  return (
    <aside className="flex w-72 flex-col justify-between border-r border-slate-200/70 bg-white/90 p-5 shadow-xl shadow-indigo-100/30 backdrop-blur">
      <div>
        <div className="mb-10 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 p-[1px]">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5">
            <UserAvatar name={name} avatarUrl={avatarUrl} className="h-11 w-11 shrink-0 text-sm" />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-slate-500">Signed in as</p>
              <p className="truncate font-semibold text-slate-900">{name}</p>
            </div>
          </div>
        </div>

        <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Main Menu
        </p>
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const isActive =
              item.href === "/"
                ? router.pathname === "/"
                : router.pathname === item.href || router.pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block w-full rounded-xl px-4 py-2.5 text-left text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-300/50"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <button
        type="button"
        onClick={() => performLogout(dispatch, router)}
        className="w-full rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
      >
        Logout
      </button>
    </aside>
  );
}
