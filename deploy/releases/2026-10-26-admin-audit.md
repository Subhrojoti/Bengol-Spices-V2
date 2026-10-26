# Production release: Admin audit and session hardening

Completed and verified: **26 October 2026 (Asia/Calcutta)**.
Application commit: `ea08a378e10fae351aad12908d3691fe5ee7e43a`, pushed to GitHub main.

## Included scope

Admin section/tab code splitting, resilient loading/error boundaries, request
cancellation and stale-response guards, safer session/error/document handling,
cash/report action synchronization, preview cleanup, accessibility fixes and
the CSS-parser advisory patch. New Admin logins use opaque HttpOnly server
sessions with durable revocation, expiry, credential-change invalidation and CSRF
checks. Existing bearer authentication remains compatible.

The deployment used an isolated release tree. Unrelated mobile working files and
the staged mobile rename were fingerprinted before/after and preserved. The
owner's separate Product Sales URL/Back enhancement remains local; only this
audit's request/export safeguards for that file were committed/deployed. The
release retains the existing Agent filter for returning to all agents.

## Validation

- Previously completed backend suite: 41 passed; frontend unit tests: nine passed.
- Working-tree browser suites: 64 passed in Chrome and 64 in Edge; four focused
  React StrictMode checks passed. These historical runs included the local
  Product Sales navigation enhancement.
- The isolated release passed Admin lint, nine unit tests and production build
  with public-page prerendering. All 64 Chrome cases were verified: the initial
  run passed 63; one new test locator matched both a navigation item and a select.
  Scoping that locator to the combobox fixed the test, and its focused rerun
  passed. Application code did not change in that correction.
- Dependency audits reported zero known vulnerabilities. Existing unrelated
  frontend lint findings and the shared entry chunk warning remain documented.
- CSS-parser patch output was byte-identical. Release source fingerprints were
  checked against Git, allowing only Windows text line-ending conversion.

## Deployment and recovery

Backend first, then website, through the existing `deploy/push.sh` targets.
Only PM2 `bengol-api` reloaded (restart count 3 to 4); `bengol-hr-api` remained
online with zero restarts. Nginx settings, production secrets and mobile clients
were not changed. Website upload retained 75 previous JS/CSS assets for open tabs.

Pre-release recovery copies:

- Website: `/root/bengol-backups/website-20261026-124602.tgz`.
- API: `/root/bengol-backups/api-20261026-124624.tgz`.
- Database: `/var/backups/bengol-spices/2026-10-26_1246`.

Backups are private server files. Existing retention can rotate them; confirm
availability before relying on a recorded path. Rollback to a frontend without
cookie-aware logout must invalidate the new AdminSession records as described in
[the session report](../../BackEnd/docs/ADMIN_SESSION_HARDENING.md). Do not restore
the production database merely to roll back application code.

## Live verification

- All **137 backend package files** and **205 website build files** matched the
  deployed bytes by SHA-256. Backend package contents matched the application
  commit after text line-ending normalization; binary files matched directly.
- HTTPS API health/database connection and public catalogue passed. API uses
  HTTP/2. Public home/about, agent/admin/employee login pages, robots, sitemap,
  expected redirects and unknown-page 404 passed.
- New HTTPS Admin login issued the host-only Secure/HttpOnly/SameSite=Strict
  cookie. Credentialed CORS allowed the actual Admin origin/custom header.
  Authenticated dashboard/coverage reads passed; untrusted-origin writes were
  refused; event stream opened and closed on logout; replay returned 401.
- The new session collection's unique tokenHash and TTL expiresAt indexes were
  verified. The smoke-test session record was removed through normal logout.
- A fresh real Chrome browser on the production Admin host signed in, loaded the
  dashboard, reloaded successfully and signed out across two tabs. Cookie flags,
  absence of browser-stored Admin credentials and no page runtime errors passed.
  Browser verification allowed only reads and the login/logout POST endpoints.

No real order, payment, incentive, store or agent mutation was used for live
verification. Identity documents still have their previous public URLs; this
release does not perform the separately documented storage migration.
