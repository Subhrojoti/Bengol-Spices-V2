import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { fetchEmployeeAccessState } from "../api/services";
import { evaluateAccess, permissionSignature } from "../utils/accessSync";

const POLL_INTERVAL_MS = 45000;
const FOCUS_THROTTLE_MS = 10000;
const SIGN_OUT_DELAY_MS = 3000;

/**
 * Keeps a signed-in employee's session honest against the server.
 *
 * Permissions are read from a JWT and a localStorage copy taken at login, so
 * an admin granting or revoking access had no effect until the employee
 * happened to sign in again. This polls their own record and, the moment it
 * differs, explains what happened and signs them out so the next login
 * carries the new access.
 */
const useAccessSync = ({ enabled, permissions, onSignOut }) => {
  const baseline = permissionSignature(permissions);
  const signOut = useRef(onSignOut);
  useEffect(() => { signOut.current = onSignOut; }, [onSignOut]);

  useEffect(() => {
    if (!enabled) return undefined;

    let timer = null;
    let cancelled = false;
    let checking = false;
    let fired = false;
    let lastCheck = 0;
    const token = localStorage.getItem("employeeToken");
    const isCurrent = () => !cancelled && token && token === localStorage.getItem("employeeToken");

    const check = async () => {
      if (!isCurrent() || fired || checking) return;

      checking = true;
      lastCheck = Date.now();
      const result = await fetchEmployeeAccessState();
      checking = false;

      if (!isCurrent()) return;

      const verdict = evaluateAccess({ result, baseline });

      if (verdict.action !== "signout") return;

      if (verdict.permissions) {
        // Refresh the cached copy so the next session starts correct even if
        // the sign-out below is interrupted.
        try {
          localStorage.setItem("permissions", JSON.stringify(verdict.permissions));
        } catch {
          /* storage unavailable — the sign-out still happens */
        }
      }

      fired = true;
      toast.info(verdict.message, { duration: SIGN_OUT_DELAY_MS });
      timer = setTimeout(() => { if (isCurrent()) signOut.current(); }, SIGN_OUT_DELAY_MS);
    };

    const onFocus = () => {
      if (Date.now() - lastCheck > FOCUS_THROTTLE_MS) check();
    };

    const interval = setInterval(check, POLL_INTERVAL_MS);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, baseline]);
};

export default useAccessSync;
