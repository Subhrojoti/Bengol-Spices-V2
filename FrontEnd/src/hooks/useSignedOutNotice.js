import { useEffect } from "react";
import { toast } from "sonner";
import { SIGNED_OUT_NOTICE } from "../api/axiosInstance";

/**
 * On a sign-in page: says why the person has landed there, when the panel
 * sent them (their session ran out, their account was switched off, their
 * password was changed). The reason is left by api/axiosInstance.js and is
 * shown once.
 */
export default function useSignedOutNotice() {
  useEffect(() => {
    let notice = null;

    try {
      notice = sessionStorage.getItem(SIGNED_OUT_NOTICE);
      sessionStorage.removeItem(SIGNED_OUT_NOTICE);
    } catch {
      /* storage unavailable: nothing to say */
    }

    if (notice) toast.info(notice, { duration: 8000 });
  }, []);
}
