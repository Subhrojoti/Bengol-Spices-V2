import axios from "axios";
import { storedAdminToken, adminRequestSession, storedAdminCookieSession, clearAdminSession } from "../utils/adminSession";
import { invalidateAdminReads } from "../utils/adminReads";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

/* 🔹 GET TOKEN BASED ON CURRENT ROUTE */
const getTokenByPath = () => {
  const path = window.location.pathname;

  if (path.startsWith("/admin")) {
    return localStorage.getItem("adminToken");
  }

  if (path.startsWith("/employee")) {
    return localStorage.getItem("employeeToken");
  }

  if (path.startsWith("/delivery")) {
    return localStorage.getItem("deliveryToken");
  }

  return localStorage.getItem("agentToken");
};

/* 🔹 REQUEST INTERCEPTOR */
axiosInstance.interceptors.request.use(
  (config) => {
    const admin = /^\/admin(?:\/|$)/.test(window.location.pathname);
    const adminRequest = admin || Object.hasOwn(config, "_adminSessionToken");
    const session = adminRequest ? (Object.hasOwn(config, "_adminSessionToken") ? config : adminRequestSession()) : null;
    const token = adminRequest ? session._adminSessionToken : getTokenByPath();
    if (adminRequest) {
      config._adminSessionToken = token;
      config._adminCookieId = session._adminCookieId || "";
      if (config._adminCookieId) {
        config.withCredentials = true;
        config.headers["X-Admin-Session"] = config._adminCookieId;
        delete config.headers.Authorization;
      }
      if ((config.method || "get").toLowerCase() !== "get") invalidateAdminReads();
      else if (!config.timeout) config.timeout = 30000;
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    } else {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error),
);

/* The office's two panels, by the address the page is on. Anything else
   (the agent and delivery panels, the public site) is not one of them. */
const officePanel = () => {
  const path = window.location.pathname;

  if (path.startsWith("/admin")) {
    return { login: "/admin/login", keys: ["adminToken", "role"] };
  }
  if (path.startsWith("/employee")) {
    return { login: "/employee/login", keys: ["employeeToken", "permissions", "role"] };
  }
  return null;
};

// Read by the sign-in pages, to say why the person is looking at one
export const SIGNED_OUT_NOTICE = "signedOutNotice";

// Several requests can fail together when a session ends; one trip to sign in
let leavingForSignIn = false;

/* 🔴 RESPONSE INTERCEPTOR (GLOBAL ERROR HANDLING) */
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (error.config && Object.hasOwn(error.config, "_adminSessionToken")) {
      // An old request must not sign out a newer admin session or a different
      // panel the person has opened while its response was in flight.
      const token = error.config._adminSessionToken;
      const cookieId = error.config._adminCookieId;
      const matching = cookieId ? cookieId === storedAdminCookieSession()?.id : token && token === storedAdminToken() && !storedAdminCookieSession();
      if (status === 401 && matching &&
          /^\/admin(?:\/|$)/.test(window.location.pathname) && window.location.pathname !== "/admin/login" && !leavingForSignIn) {
        leavingForSignIn = true;
        clearAdminSession();
        invalidateAdminReads();
        try { sessionStorage.setItem(SIGNED_OUT_NOTICE, "Your session has ended. Please sign in again."); } catch { /* unavailable storage */ }
        window.location.replace("/admin/login");
      }
      return Promise.reject(error);
    }

    /* ── the admin and employee panels ──────────────────────────────────

       These used to share the handling further down, which did two things
       to someone in the middle of their work:

       - any server error, or a moment without a connection, on ANY request
         (a background refresh included) replaced the whole panel with the
         full-page "Ooops" screen at /error. Whatever was half typed was
         lost, and that screen's Reload button reloads /error itself, so
         the only way back was the browser's Back button. Every screen of
         these panels already shows its own message and a Retry when
         something cannot be loaded or saved; it never got the chance.

       - a session that had run out (an admin sign-in lasts a day) wiped
         everything the browser had stored for the site, the sign-ins of
         the other panels and the colour theme with it, and then left the
         person on a page where nothing worked, with no word of why.

       Now a failed request is simply handed back to the screen that made
       it, and an ended session removes that panel's own sign-in and goes
       to its sign-in page, which says what happened. */
    const panel = officePanel();

    if (panel) {
      const hadSession = Boolean(error.config?.headers?.Authorization);

      if (
        status === 401 &&
        hadSession &&
        !leavingForSignIn &&
        window.location.pathname !== panel.login
      ) {
        leavingForSignIn = true;
        panel.keys.forEach((key) => localStorage.removeItem(key));

        // The server says why in words fit to show ("Session expired...", "Your
        // account is no longer active."), except for a sign-in it could not read
        const said = error.response?.data?.message;
        const reason =
          said && !["Invalid token", "No token provided"].includes(said)
            ? said
            : "Your session has ended. Please sign in again.";

        try {
          sessionStorage.setItem(SIGNED_OUT_NOTICE, reason);
        } catch {
          /* storage unavailable: the sign-in page simply says nothing */
        }

        window.location.replace(panel.login);
      }

      return Promise.reject(error);
    }

    // 🔐 Unauthorized / Token expired
    if (status === 401) {
      console.warn("Unauthorized");

      // Optional: clear token
      localStorage.clear();

      // window.location.href = "/login";
    }

    // ⛔ Forbidden
    else if (status === 403) {
      console.warn("Forbidden access");
    }

    // 🔥 Server error → show full screen error page
    else if (status >= 500) {
      console.error("Server error - Redirecting to error page");

      if (window.location.pathname !== "/error") {
        window.location.href = "/error";
      }
    }

    // 🌐 Network error (backend down / no internet)
    else if (!error.response) {
      console.error("Network error");

      if (window.location.pathname !== "/error") {
        window.location.href = "/error";
      }
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
