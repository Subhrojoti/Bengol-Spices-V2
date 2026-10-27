# Production release: authenticated invoice download

Released and verified: **27 October 2026 (Asia/Calcutta)**.
Application commit: `5cf4f64849750c1b841b5f38b69abbb77e4530b8`, pushed to GitHub main.
Owner explicitly requested push/deploy after reviewing the tested fix.

## Change and validation

Invoice downloads now return authenticated API PDF bytes instead of redirecting
credentialed browser requests to storage. The current template includes the
supplied invoice logo and order units, with sufficient net-rate precision.
Amounts, payment records and existing backend access checks remain unchanged.
HSN stays blank as requested. Shared Admin/Employee Orders has accurate retry
wording for network failures. See [implementation report](../../BackEnd/docs/INVOICE_DOWNLOAD_FIX.md).

- All 49 backend tests, nine frontend unit tests and 76 Chrome Admin/Employee
  browser tests passed. Admin/shared lint and production build/prerender passed.
  Packet and multi-page invoice renderings were visually inspected.
- Fifteen release source/test/documentation files were committed explicitly.
  The eight runtime/test files match the tested isolated candidate. A clean
  archive of the application commit supplied the deployed backend and website
  build. All 36 unrelated Product Sales/mobile working files and the staged
  mobile rename remain unchanged and excluded.
- Before upload, all 138 prior backend files matched their expected release
  snapshot. The GPS report used its original deployed documentation revision;
  later documentation-only updates had not been deployed. No unexpected runtime
  source differences were found. Production settings matched the private local
  deployment settings before and after rollout; values were never printed.
- Existing deployment flow checked database/Cloudinary/Razorpay/Resend settings,
  saved API/database backups, installed locked dependencies and gracefully
  reloaded only bengol-api. Website staged upload/swap retained 141 previous
  JS/CSS assets for open tabs. No nginx configuration or mobile deployment.
- All **140 backend files** and **205 website files** match release hashes.
  bengol-api PID changed from 81280 to 83093, restart count 0 to 1. The unrelated
  HR API stayed at PID 81281, restart count 0. These pre-release PIDs differ from
  older release notes; the fresh runtime comparison established this baseline.
- Normal production Admin sign-in and the actual Orders Invoice button
  downloaded the reported order's PDF: HTTP 200, application/pdf, 122,339 bytes,
  no-store, API origin, suggested filename `ORD2026-0017.pdf`. The rendered PDF
  visibly includes the supplied logo, packet labels, aligned table/footer and
  total 182.00. Complete Order and Invoice checksums are unchanged across the
  check (paid 1.00, due 181.00). The test Admin session was logged out normally.
- Employee login/profile/reload UI smoke passed on deployed assets using
  synthetic intercepted APIs. Real Employee authentication/download permissions
  are covered by isolated backend/browser tests; no real employee password was
  available or used. No production Employee tokens were minted.
- HTTPS API/database health, public catalogue, HTTP/2, public/Admin/Employee/agent
  pages and expected redirects/404 all passed. No fake business records, payments,
  password resets or database migration were used for verification.

## Recovery

- API snapshot: `/root/bengol-backups/api-20261027-075709.tgz`.
- Database backup: `/var/backups/bengol-spices/2026-10-27_0757`.
- Website: `/root/bengol-backups/website-invoice-20261027-075655.tgz`.
- Matching website asset manifest:
  `/root/bengol-backups/website-invoice-20261027-075655.build-assets`.

Verify retained backups before restoring. Restore the website with its matching
asset manifest; restore/reload the API snapshot if backend rollback is needed.
Rollback reintroduces the storage redirect download failure. No database restore
or session reset is required for this code-only release. Reload an already-open
Admin/Employee tab to load the updated frontend.
