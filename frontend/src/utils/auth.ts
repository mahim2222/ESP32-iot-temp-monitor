const TOKEN_KEY = "token";

export function AuthToken(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem(TOKEN_KEY) ?? "";
}
