# Production release: Admin Orders workspace

Released and verified: **29 October 2026 (Asia/Calcutta)**.
Application commit: `e023118846a043c0e0960c49bcb37fd576282714`, pushed to GitHub main.
Owner explicitly requested push/deploy after the Orders and badge refinements.

## Scope and verification

- Admin Orders defaults to All orders with server pagination, status/search/
  agent/store/India-date filters, detail panel/mobile dialog and full filtered
  CSV export. By store retains the original screen. Four additive Admin-only
  backend read routes support it; Employee/agent/delivery legacy APIs remain.
- Order action buttons are blue/green/red. Agent application and access states
  now use aligned badges. No financial, stock or order mutation rule changed.
- All 61 backend and 12 frontend unit cases passed. Full Chrome regression run:
  92 passed, with four final layout/theme cases (93 distinct cases covered).
  Admin lint, isolated action/badge checks and committed production build with
  prerender passed. Existing shared chunk-size/deprecation warnings remain.
- Twenty-five files were committed explicitly; 17 runtime/test files matched
  the isolated candidate. All 36 unrelated Product Sales/mobile files and the
  staged mobile rename were preserved and excluded from this release.
- Production was verified against the previous release before upload: 142
  backend and 205 website files matched. Private deployment settings matched
  before and after deployment; credential values were neither printed nor changed.
- The deployment checked service settings, saved API/database/website backups,
  installed locked backend dependencies and gracefully reloaded bengol-api.
  The website was built from the committed archive, staged and swapped, retaining
  142 previous script/style assets for open tabs. No nginx or schema migration.
- All **145 backend files** and **206 website files** match deployment hashes.
  bengol-api is online at PID 99613/restart count 3 (previously 85578/count 2).
  Unrelated bengol-hr-api remained PID 81281/restart count 0.
- Normal Admin sign-in passed against production. The default page returned 25
  of 68 orders; options, delivered-only reads, invalid-query rejection, details,
  filtered CSV download and an existing invoice PDF download passed. The mobile
  dialog fits 390px, original By store works, and a real Blocked badge matches
  the Approved badge height/center. Zero page errors and zero business mutation
  requests. The smoke helper initially used an incorrect accessible-name selector
  for MUI's dialog; correcting that helper yielded a full pass without app changes.
- All four new read endpoints refuse unauthenticated requests with 401. The
  normal verification session was revoked and replay refused. No production
  Employee credentials or fabricated authentication tokens were used.
- HTTPS API/database health, product list, public/Admin/Employee/agent entry
  pages, expected redirects, 404 and HTTP/2 checks passed. Existing Employee
  workflows are covered by isolated browser regressions.

## Recovery

- API: `/root/bengol-backups/api-20261029-133128.tgz`.
- Database: `/var/backups/bengol-spices/2026-10-29_1331` (708 documents, 27 collections).
- Website: `/root/bengol-backups/website-orders-workspace-20261029-133150.tgz`.
- Matching assets: `/root/bengol-backups/website-orders-workspace-20261029-133150.build-assets`.

Verify retained backups before restoring. Restore website and asset manifest
together. Restore/reload the API snapshot for a backend rollback; the new routes
are additive read-only endpoints, so this release needs no database rollback.
Reload open Admin tabs to receive the new workspace and styles.
