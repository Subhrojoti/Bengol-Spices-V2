# Production release: admin management and order browsing

Completed and verified: 26 October 2026 (Asia/Calcutta).
Application commit: `bc05a475b04e4ac2451166d1bd93420ca2f52b94`, pushed to GitHub main.

## Included changes

Admin agent access management, store transfers/removal, guarded permanent
test-agent cleanup with durable media deletion retries, sales dashboard updates,
invoice branding using the owner's invoice logo, and faster Orders store browsing.
Implementation details and limitations remain in `BackEnd/docs/PRODUCTION_ENHANCEMENTS.md`,
`BackEnd/docs/TEST_DATA_CLEANUP.md`, and `FrontEnd/docs/ORDERS_SCROLL_PERFORMANCE.md`.

Unrelated pre-existing mobile app and ProductSales working-tree edits were excluded
and remain local. The deployment was built from an isolated archive of the commit.

## Deployment and recovery

- Backend deployed on 25 October via `deploy/push.sh backend`; website deployed
  on 26 October via `deploy/push.sh frontend` after the session resumed.
- API directory: `/var/www/Bengol-Spices-V2/BackEnd`; PM2 service `bengol-api`.
- Website directory: `/var/www/Bengol-Spices-V2/FrontEnd/dist`.
- Pre-release API snapshot: `/root/bengol-backups/api-20261025-101124.tgz`.
- Database backups before release: `/var/backups/bengol-spices/2026-10-25_1010`
  and `/var/backups/bengol-spices/2026-10-25_1011`. Existing retention rotates
  these; check availability before relying on a listed backup.
- Production environment values matched the existing VPS settings before upload.
  Existing replica-set transactions and required indexes were checked read-only.
- Nginx configuration was unchanged. Unrelated `bengol-hr-api` stayed online
  with zero restarts. Only `bengol-api` was reloaded.
- Previous website JS/CSS assets were retained for already-open browser tabs.

## Verification

- Backend tests: 21 passed; frontend tests: 3 passed; touched frontend lint passed.
- Full production Vite build and public-page prerender completed successfully.
  Existing large-bundle warning remains.
- SHA-256 verification: all 128 committed backend files and all 135 website
  build files matched the deployed copies, including invoice assets.
- API health returned HTTP 200 with database connected; public products HTTP 200.
  Protected store-management and agent-orders routes returned HTTP 401 without
  authentication.
- Public home/about, agent login, admin login, employee login, robots and sitemap
  returned HTTP 200. Their main JS asset returned HTTP 200. Expected admin
  redirect (302), legacy home redirect (301), and unknown-page 404 passed.
- API HTTPS negotiates HTTP/2. Both PM2 services are online.

These are source, build, deployment and HTTP smoke checks. No live agent purge,
payment mutation or authenticated end-to-end admin workflow was performed.
