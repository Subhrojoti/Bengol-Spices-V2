import { useEffect, useReducer } from "react";
import { adminClaims, storedAdminToken, storedAdminCookieSession, ADMIN_COOKIE_SESSION } from "../utils/adminSession";

export default function useAdminSession(enabled = true) {
  const [revision, refresh] = useReducer((value) => value + 1, 0);
  const token = enabled ? storedAdminToken() : "";
  const claims = enabled ? storedAdminCookieSession() || adminClaims(token) : null;
  const expiry = claims?.exp;
  useEffect(() => {
    if (!enabled) return undefined;
    const changed = (event) => { if (event.key === "adminToken" || event.key === ADMIN_COOKIE_SESSION || event.key === null) refresh(); };
    window.addEventListener("storage", changed);
    window.addEventListener("admin:session-changed", refresh);
    const timer = expiry ? setTimeout(refresh, Math.min(Math.max(0, expiry * 1000 - Date.now()) + 25, 2147483647)) : null;
    return () => { window.removeEventListener("storage", changed); window.removeEventListener("admin:session-changed", refresh); clearTimeout(timer); };
  }, [enabled, expiry, token, revision]);
  return { token, claims };
}
