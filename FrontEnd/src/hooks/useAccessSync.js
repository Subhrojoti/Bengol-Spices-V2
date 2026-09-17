import { useEffect, useRef } from "react";
import { toast } from "react-toastify";
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
  /* null until the caller has actually loaded the profile. Capturing a
     baseline before then would compare "no permissions yet" against the real
     set on the first tick and sign the employee straight back out. */
  const baselineRef = useRef(null);
  const firedRef = useRef(false);
  const lastCheckRef = useRef(0);

  const signOutRef = useRef(onSignOut);
  signOutRef.current = onSignOut;

  useEffect(() => {
    if (!enabled) return undefined;

    if (baselineRef.current === null) {
      baselineRef.current = permissionSignature(permissions);
    }

    let timer = null;
    let cancelled = false;

    const check = async () => {
      if (cancelled || firedRef.current) return;

      lastCheckRef.current = Date.now();
      const result = await fetchEmployeeAccessState();

      if (cancelled || firedRef.current) return;

      const verdict = evaluateAccess({ result, baseline: baselineRef.current });

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

      firedRef.current = true;
      toast.info(verdict.message, { autoClose: SIGN_OUT_DELAY_MS });
      timer = setTimeout(() => signOutRef.current?.(), SIGN_OUT_DELAY_MS);
    };

    const onFocus = () => {
      if (Date.now() - lastCheckRef.current > FOCUS_THROTTLE_MS) check();
    };

    const interval = setInterval(check, POLL_INTERVAL_MS);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled]);
};

export default useAccessSync;
