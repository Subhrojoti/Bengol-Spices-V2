# Production release: Admin, order and mobile API improvements

Released and verified: 1 November 2026 (Asia/Calcutta).
Application commit: `abf72b3bee36f46206ab3e5e35f831f5791698a0`, pushed to main.

- Committed approved backend/Admin and mobile-source work, excluding generated
  output, QA evidence, environment files and dependencies. Mobile binaries were
  not built, published or distributed by this deployment.
- Website built/prerendered from the committed archive. API and website deployed
  together; existing production settings and nginx configuration unchanged.
- API/database/website backups verified. Reviewed additive workflow/idempotency
  indexes without dropping indexes or rewriting business records.
- Existing due dates and issued invoices retained. Newly placed orders use the
  approved credit and confirmation-before-invoice policies. See the ecosystem
  validation notes for compatibility and safe rollback constraints.
- All 177 backend and 216 new website files match deployment hashes. Previous
  script/style assets retained for open tabs. API gracefully reloaded; unrelated
  HR service stayed at PID 81281/restart count 0.
- Normal Admin sign-in, store reports/change-request reads, mappings, partner
  performance/items/collections, Orders/status filtering and phone Store Details
  passed live smoke checks. Four unauthenticated report endpoints refused access.
  Zero business mutation requests, page errors or server errors in the smoke.
  Verification login revoked and replay refused.
- HTTPS API/database health, HTTP/2, public/About pages and Admin/Employee/Agent/
  Delivery login entry pages passed. nginx configuration test passed.
- Local release evidence: 91 backend tests, 13 frontend units, broad Admin browser
  review (144/145 initially; the timeout passed three isolated repeats), and all
  18 final affected-flow checks. See the Admin release recheck report for limits.
- Smoke helpers initially used an incorrect Store requests tab key and nonexistent
  Agent/Delivery subdomains; correcting helpers yielded passes without app changes.

## Recovery

- API: `/root/bengol-release-abf72b3/api-before.tgz`.
- Website: `/root/bengol-release-abf72b3/website-before.tgz` with matching
  `website-before.build-assets`. Previous directory retained beside live dist.
- Database: `/var/backups/bengol-spices/2026-11-01_1230`, 848 documents across
  30 collections; gzip integrity checked for every collection.
- Do not roll back to the pre-upgrade API blindly after new-policy orders or
  partner collections are created: old code lacks the new policy protections.
  Prefer a forward fix; review database/business changes before any rollback.

This release does not include subsequently requested collector tabs or Bills.
No signed mobile release, outdoor GPS/camera certification or real payment
settlement test was performed during deployment.
