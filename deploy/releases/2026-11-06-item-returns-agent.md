# Production release: item returns, optional advances and Agent reliability

Deployed and verified: **6 November 2026 (Asia/Calcutta)**.
Application commit: `73a7a61afc2d71f9e88b69864cd4d979622f7b00`, pushed to main.

## Scope

- Backend supports selected-item Agent returns after delivery, assigned-partner
  item returns during delivery and zero-advance placement without a fake Payment.
  Admin/permitted Employee Returns shows item quantities and the office-review
  accounting boundary. Legacy mobile/web request formats remain compatible.
- Office review remains mandatory for financial adjustments. Recording a return
  does not automatically change invoices, payments, outstanding balances, stock
  or incentives. No historical business records were recalculated or backfilled.
- Agent and Delivery mobile source is pushed, including item-return forms and
  the Agent performance/payment fixes. **Both apps require new builds** to expose
  the mobile changes. No AAB/APK or Play Store rollout was performed here.

Implementation and validation details:
[returns/advances](../../BackEnd/docs/ITEM_RETURNS_ADVANCES_2026-11-05.md),
[first Agent review](../../agent-app/docs/AGENT_REVIEW_2026-11-05.md),
[second Agent review](../../agent-app/docs/AGENT_SECOND_REVIEW_2026-11-05.md).
Their local-only statements describe the earlier implementation stage; this
release record establishes the deployed backend/website state.

## Validation

- Full backend suite: **113/113 passed**, using disposable databases/mocked
  financial services. Full isolated Admin/Employee browser suite: **170/170**.
  Frontend units **13/13**, Admin lint and SPA build passed.
- Production website built/prerendered from the exact commit archive. Staged
  locked production dependencies, runtime imports and read-only database,
  storage, payment-gateway and email credential checks passed.
- Previous mobile verification: **41/41** combined regressions, Agent typecheck
  and final Android JS/Hermes export passed. Both apps' earlier item-return
  typechecks/exports and disposable emulator flows passed. These are not signed
  release or live-payment tests.

## Deployment and live evidence

- Before switching, production matched all 184 backend/220 website files from
  the prior release. Refreshed code/site/database backups on 6 November and
  verified gzip integrity before proceeding.
- Applied only the additive unique partial return replay index
  `orderId_1_clientRequestId_1`, restricted to string references. Duplicate
  reference audit passed; return indexes increased from 7 to 8. No index drops,
  record edits or destructive migration.
- API gracefully reloaded and website switched as a complete directory. Old
  JS/CSS assets retained for already-open panels. All **186 backend/220 website
  files** match release hashes. Production configuration fingerprint unchanged;
  no nginx, credentials, employee grants or PM2 configuration changes.
- Stable API process: PID 156944, restart count 1. HR process stayed PID 142559,
  restart count 0. HTTPS/API database health and HTTP/2 pass. Public/About,
  Admin/Employee login, Agent Web and Delivery Web entry pages return 200.
- Live normal Admin sign-in, Returns list/page, Orders/filtering, Bills, cash
  collector tabs, store reports/change requests, mappings, delivery performance,
  partner order/collection reports, permission-editor read and active delivery
  code metadata views passed. New return routes reject unauthenticated callers.
- Smoke blocked business mutations; no order, return, collection, refund or
  permission change was submitted, and no real delivery code was revealed.
  Zero page/API server errors. Verification session revoked and replay refused.
  One initial smoke selector matched both breadcrumb/content Returns headings;
  scoping it to main content resolved the test-only ambiguity. Final smoke passed.

## Recovery

- Private release directory: `/root/bengol-release-item-returns-20261105`.
  Refreshed `api-before.tgz`, `website-before.tgz` and
  `website-before.build-assets` are retained there.
- Previous API/dependencies:
  `/var/www/Bengol-Spices-V2/BackEnd.previous-item-returns`.
- Previous website:
  `/var/www/Bengol-Spices-V2/FrontEnd/dist.previous-item-returns`.
- Verified database backup: `/var/backups/bengol-spices/2026-11-06_1200`,
  **1,341 documents across 30 collections**, all gzip files valid.
- Prefer a forward fix. If rollback is needed, assess returns/orders/payments
  created since release and restore compatible source/site versions. Never
  overwrite live business activity with an older database backup blindly. The
  additive retry index is compatible with legacy records and need not be dropped.

Operational helpers and private evidence remain under ignored
`FrontEnd/.admin-audit.local/release-item-returns-20261105/`; local regression
logs remain under `output/release-20261105-*`. No credentials are recorded here.

Refresh open office panels to load the website release. The backend is now
ready for the new Agent and Delivery app binaries; older installed apps retain
their existing screens and advance defaults until updated.
