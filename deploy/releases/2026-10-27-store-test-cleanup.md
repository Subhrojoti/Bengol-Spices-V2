# Production release: individual test-store cleanup

Released and verified: **27 October 2026 (Asia/Calcutta)**.
Application commit: `215430d422d71b438f52b978cecbf8851f63d7d7`, pushed to GitHub main.
Owner explicitly requested push/deploy after reviewing the implemented feature.

## Change and validation

Admin can review and permanently remove one test store with its cancelled-order
history and unshared files while retaining its agent and other stores. The new
preview/action requires the store ID, DELETE TEST STORE and explicit test-data
confirmation. Online-payment, shared-history and relevant target/monthly-accounting
cases remain protected. Existing unused-store deletion/archive rules remain.
See [implementation report](../../BackEnd/docs/STORE_TEST_CLEANUP.md).

- All 56 backend, nine frontend unit and 81 Chrome Admin/Employee browser cases
  pass. Seven final focused cleanup cases and a desktop confirmation probe pass.
  Admin/shared lint and production build/prerender pass. Desktop/phone review
  layouts were visually inspected. Existing bundle/deprecation warnings remain.
- Eighteen runtime/test/documentation files were committed explicitly. The ten
  runtime/test files match the isolated candidate. The committed archive supplied
  the deployed backend and website build. All 36 unrelated Product Sales/mobile
  working files and staged mobile rename were preserved and excluded.
- Before upload, all 140 prior backend files matched the deployed invoice
  application snapshot `5cf4f64`. Private deployment settings matched production
  before and after rollout. No credential values were printed or changed.
- Existing deployment flow checked service settings, saved API/database backups,
  installed locked dependencies, gracefully reloaded bengol-api, then staged and
  swapped the website. It retained 141 previous JS/CSS assets for open tabs.
  No nginx configuration change, mobile release or schema/data migration.
- All **142 backend files** and **205 website files** match deployment hashes.
  bengol-api changed from PID 83093/restart count 1 to PID 85578/restart count 2.
  The unrelated HR API stayed at PID 81281/restart count 0.
- Normal Admin sign-in and the deployed store review passed on desktop/phone.
  The checked existing store `CS2026-0006` correctly displays its active-order
  blocker. Typed fields start empty, delete starts disabled, and unauthenticated
  GET/POST are refused with 401. The probe sent zero business mutations; it never
  submitted an authenticated purge. Its own normal session was revoked and replay
  refused. The initial phone-viewport probe's hidden desktop logout control was
  handled through the existing logout API; this required no application change.
- Reported store `CS2026-0051` was **already absent before this deployment**.
  Read-only inspection found a pre-existing PURGE_TEST_STORE completed receipt
  dated `2026-10-27T09:06:57.148Z` (14:36:57 IST), recording one store/order/payment/
  invoice removed. All four associated media jobs are DELETED. Its store/order/
  payment/invoice/return counts were zero before and after rollout, and its
  completed-receipt count remained one. This release did not perform that cleanup;
  no inference is made about its cause/actor. The new preview returns 404 for it.
- HTTPS API/database health, public catalogue, HTTP/2, public/Admin/Employee/agent
  pages and expected redirects/404 passed. A normal Admin Orders Invoice-button
  check still downloads a 200 application/pdf response from the API after the new
  store lock. Employee permissions and cash workflows are covered by isolated
  regression tests; no production employee tokens/passwords were used.

## Recovery

- API: `/root/bengol-backups/api-20261027-091145.tgz`.
- Database: `/var/backups/bengol-spices/2026-10-27_0911`.
- Website: `/root/bengol-backups/website-store-cleanup-20261027-091140.tgz`.
- Matching asset manifest:
  `/root/bengol-backups/website-store-cleanup-20261027-091140.build-assets`.

Verify retained backups before restoring. Restore the website and matching asset
manifest together; restore/reload the API snapshot for backend rollback. Reverting
code disables the new cleanup option but cannot recover a confirmed deletion.
These deployment backups postdate the reported store's prior deletion. Independent
older backups would be needed to recover it. Reload open Admin tabs for the new UI.
