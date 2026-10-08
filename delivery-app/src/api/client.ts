import axios, { AxiosError } from "axios";
import { tokenStorage } from "@/utils/tokenStorage";
import { API_URL } from "./baseUrl";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

/* A 401 means "your session has ended" only for a request that was sent
   with a session, and never for the sign-out call itself.

   It used to sign the user out on ANY 401. Signing out sends one last
   request to the server, which by then has no token and is answered 401,
   which signed the user out again, which sent another request… an endless
   stream of them (dozens a second) until the app was closed. It started on
   every sign-out, on every expired session, and on a wrong password at
   sign-in (also a 401), and while it ran it threw the user straight back
   out of any new sign-in. */
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const config = error.config;
    const sentWithSession = Boolean(config?.headers?.Authorization);
    const isSignOut = /\/logout$/.test(config?.url ?? "");

    if (error.response?.status === 401 && sentWithSession && !isSignOut) {
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (error.code === "ECONNABORTED") return "Request timed out. Check your connection and try again.";
    if (!error.response) return "Can't reach the server. Check your internet connection.";
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
