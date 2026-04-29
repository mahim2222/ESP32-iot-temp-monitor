import { AuthLogin } from "@/store/auth-slice";
import { AuthToken } from "@/utils/auth";
import { axiosInstance } from "@/utils/axios-instance";
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store";

type AuthCheckProps = {
  children: ReactNode;
};

export default function AuthCheck({ children }: AuthCheckProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    async function checkAuthToken() {
      const token = AuthToken();
      if (!token) {
        await router.push("/auth/login");
        return;
      }

      try {
        const response = await axiosInstance.get("/auth/user", {
          headers: {
            authtoken: token,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });

        if (response.data?.error && response.data?.error?.code === 401) {
          await router.push("/auth/login");
          return;
        }

        dispatch(AuthLogin(response.data));
        setLoading(false);
      } catch {
        await router.push("/auth/login");
      }
    }

    void checkAuthToken();
  }, [dispatch, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-slate-100">
        <p className="text-sm font-medium text-slate-600">Checking session…</p>
      </div>
    );
  }

  return <>{children}</>;
}
