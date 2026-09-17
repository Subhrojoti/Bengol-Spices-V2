/* =====================================================================
   PUBLIC WEBSITE ADDRESS

   FRONTEND_URL lists the sites allowed to call this API (CORS), comma
   separated. The FIRST entry is also where links in emails point —
   password reset and set-password — so on the live server put the main
   site first:

     FRONTEND_URL=https://www.bengolspices.com,https://bengolspices.com

   If FRONTEND_URL is missing, email links still go to the live site
   rather than to a localhost address nobody else can open.
   ===================================================================== */

const LIVE_SITE = "https://www.bengolspices.com";

// A trailing slash would never match a browser's Origin header
export const frontendOrigins = () =>
  (process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

export const frontendBaseUrl = () => frontendOrigins()[0] || LIVE_SITE;
