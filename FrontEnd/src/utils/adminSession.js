// Claims are only a navigation hint. The API must verify the signature and
// independently authorize every read/mutation; this code never grants access.
export const adminClaims = (token, now = Date.now()) => {
  if (typeof token !== "string" || token.length > 8192) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const claims = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return claims?.role === "ADMIN" && Number.isFinite(claims.exp) && claims.exp * 1000 > now ? claims : null;
  } catch { return null; }
};

export const storedAdminToken = () => {
  try { const token = sessionStorage.getItem("adminToken"); if (token) return token; } catch { /* unavailable storage */ }
  try { return localStorage.getItem("adminToken") || ""; } catch { return ""; }
};
const removeTabToken = () => { try { sessionStorage.removeItem("adminToken"); } catch { /* unavailable storage */ } };

export const ADMIN_COOKIE_SESSION = "adminCookieSession";
export const cookieSessionClaims = (value, now = Date.now()) => {
  if (value?.role !== "ADMIN" || typeof value.id !== "string" || !/^[a-f0-9]{24}$/.test(value.id) || !Number.isFinite(value.exp) || value.exp * 1000 <= now) return null;
  return { role: "ADMIN", id: value.id, exp: value.exp };
};
export const storedAdminCookieSession = () => {
  try { return cookieSessionClaims(JSON.parse(localStorage.getItem(ADMIN_COOKIE_SESSION))); } catch { return null; }
};
export const storeAdminCookieSession = (value) => {
  const claims = cookieSessionClaims(value);
  if (!claims) throw new Error("Invalid admin session");
  localStorage.setItem(ADMIN_COOKIE_SESSION, JSON.stringify(claims));
  localStorage.removeItem("adminToken");
  removeTabToken();
};
export const clearAdminSession = () => {
  localStorage.removeItem("adminToken");
  removeTabToken();
  localStorage.removeItem(ADMIN_COOKIE_SESSION);
  if (localStorage.getItem("role") === "ADMIN") localStorage.removeItem("role");
  window.dispatchEvent(new Event("admin:session-changed"));
};
// Compatibility with a backend not yet upgraded to cookie sessions. New fallback
// tokens are tab-scoped; old already-open bearer clients remain supported.
export const storeLegacyAdminToken = (token) => {
  if (!adminClaims(token)) throw new Error("Invalid admin session");
  sessionStorage.setItem("adminToken", token);
  localStorage.removeItem("adminToken");
  localStorage.removeItem(ADMIN_COOKIE_SESSION);
};
export const adminRequestSession = () => {
  const session = storedAdminCookieSession();
  return session ? { _adminSessionToken: "", _adminCookieId: session.id } : { _adminSessionToken: storedAdminToken(), _adminCookieId: "" };
};
