import type { AppDispatch } from "@/store";
import { AuthLogout } from "@/store/auth-slice";
import type { NextRouter } from "next/router";

export function performLogout(dispatch: AppDispatch, router: NextRouter): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("profile");
  }
  dispatch(AuthLogout());
  void router.push("/auth/login");
}
