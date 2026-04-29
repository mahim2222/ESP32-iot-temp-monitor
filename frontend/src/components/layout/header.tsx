import UserAvatar from "@/components/layout/user-avatar";
import { performLogout } from "@/lib/logout";
import type { AppDispatch, RootState } from "@/store";
import { useRouter } from "next/router";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

export default function Header() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);
  const profile = useSelector((s: RootState) => s.auth.profile);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const name = user?.name ?? "Guest";
  const avatarUrl = profile?.avatar ?? "";

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/70 bg-white/85 px-6 py-4 backdrop-blur md:px-8">
      <div className="w-full max-w-md">
        <label className="relative block">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            🔍
          </span>
          <input
            type="search"
            placeholder="Search Devices"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
        </label>
      </div>

      <div className="relative ml-4">
        <button
          type="button"
          onClick={() => setIsProfileOpen((prev) => !prev)}
          className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full ring-4 ring-slate-100 transition hover:opacity-90"
          aria-expanded={isProfileOpen}
          aria-haspopup="true"
        >
          <UserAvatar name={name} avatarUrl={avatarUrl} className="h-10 w-10 min-h-10 min-w-10 text-sm" />
        </button>

        {isProfileOpen && (
          <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70">
            <p className="truncate border-b border-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
              {name}
            </p>
            <button
              type="button"
              onClick={() => {
                setIsProfileOpen(false);
                performLogout(dispatch, router);
              }}
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
