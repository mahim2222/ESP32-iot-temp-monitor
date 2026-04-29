import axios from "axios";
import { AuthToken } from "@/utils/auth";

const API_ROOT = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const axiosInstance = axios.create({
  baseURL: `${API_ROOT}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use((config) => {
  const token = AuthToken();
  if (token) {
    config.headers.authtoken = token;
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
