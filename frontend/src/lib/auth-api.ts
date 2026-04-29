const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type AuthResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    is_blocked?: string;
    blocked_text?: string;
    created_at?: string;
    updated_at?: string;
  };
  profile: {
    avatar: string;
    created_at?: string;
    updated_at?: string;
  };
};

async function parseJson(res: Response): Promise<{ message?: string } & Record<string, unknown>> {
  try {
    return (await res.json()) as { message?: string } & Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function registerRequest(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(typeof data.message === "string" ? data.message : "Registration failed");
  }
  return data as AuthResponse;
}

export async function loginRequest(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(typeof data.message === "string" ? data.message : "Login failed");
  }
  return data as AuthResponse;
}

export function persistAuth(data: AuthResponse): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  localStorage.setItem("profile", JSON.stringify(data.profile));
}
