# Ecosystem upgrade validation and continuation

Date: 31 October 2026, Asia/Calcutta. **Local changes, not deployed.**
Read [approved requirements and architecture](ECOSYSTEM_UPGRADE_PLAN_2026-10-31.md)
and [repository context](../../BACKEND_CONTEXT.md) before continuing.

## Implemented workflow

For newly placed orders: place and record initial collection -> agent may edit
the draft -> Admin/authorised Employee confirms -> invoice metadata is created
and editing locks in the same transaction. PDF generation follows commit.
Legacy orders and issued invoices cannot enter the new editing workflow.
No legacy invoice number, buyer snapshot or credit date is backfilled/revised.

Draft edits use backend prices/minima, stock reservation deltas, recorded-payment
floor, expected revision and durable request identities. OrderModification stores
before/after products and totals, agent, revision and time. It is included in
test-store/account cleanup. Issued invoice revisions/PDF versioning are not needed
for this approved workflow: no invoice exists while the new draft is editable.

## Where the features live

| Feature | Existing section / mobile screen |
|---|---|
| Created-store counts, daily/weekly/monthly/custom records, details | Admin/authorised Employee: Agent > Store Details; agent-row shortcut |
| Delivery code | Deliberate Reveal action in Store Details and Orders; separate permission and audit |
| Proposed store corrections | Agent mobile store menu > Request changes; office Agent > Store requests |
| Agent-to-partner mapping | Admin Delivery > Agent mapping; enabled by default on each mapping |
| Partner workload/failed attempts/collections | Delivery > Performance, with collection history |
| Multiple recorded/verified/pending collections | Payment Info and Cash Verification; mobile order/delivery payment history |
| Payment due extension | Orders / Payment Info, separate default-off permission, reason and audit |
| Category minimums | Product creation / product edit; blank inherits existing per-product floor |
| Matching coverage agents | Assign Location > click a pincode chip |
| Order date basis and range | Orders: Placed / Confirmed / Delivered with same CSV filters |
| Draft editor | Agent mobile order detail > Edit order (new PLACED orders only) |
| Agent map | My stores map, currently managed stores only |
| Delivery map | Active delivery map, current active destinations and manual stop order |
| Optional GST / precise GPS | Agent mobile new-store form; GPS after camera photo, <=50m and fresh |

Employee flags are OFF by default: canViewStoreReports, canViewDeliveryCodes,
canReviewStoreChanges, canExtendDueDates. Admin enables them individually; all
operations also enforce API permissions and store/partner scope.

## Verification evidence

Evidence is ignored local QA output under
`FrontEnd/.admin-audit.local/ecosystem-upgrade/`, not release assets or secrets.

- Backend full suite: 79 tests. Final rerun evidence: backend-final.log.
  Tests include financial rollback/idempotency, original-agent sales credit,
  permissions, credit/legacy preservation, store approval/snapshots, registration
  phone races, category minima/preflight, assignment/performance, draft edits,
  stale confirmation, edit/confirm race and invoice generation/download.
- Admin/Employee full browser run: 102/102 passed (browser-final.log). After the
  final shared-office invoice fix, all 40 affected browser cases passed, including
  two additional Admin/Employee immediate-invoice cases (browser-affected-final.log).
  There are now 104 distinct browser cases in the suite. APIs are intercepted
  with synthetic fixtures; these are not live-user browser measurements.
- Frontend unit tests: 12/12 passed (frontend-unit-final.log). Admin lint, extra
  new shared-component lint and SPA build passed. Build retains the pre-existing
  large-chunk warning; no claim that the entire Admin bundle was reduced.
- Both apps: final TypeScript checks and Android Hermes exports passed. These
  are JavaScript bundles, **not APK builds or installations**. Delivery adds
  react-native-webview; a custom development client/native release must include
  that module. No app-store/EAS submission or existing phone-app replacement.
- Embedded map HTML: two markers, selection bridge, attribution and malicious
  popup escaping passed at 390px with all tile requests intercepted. No live OSM
  tiles, native WebView gestures/caching or road routes were verified by that test.
- Disposable mobile fixture API: normal Agent and Delivery logins plus 11 scoped
  authenticated reads passed (device-api-smoke.json). No production credentials.
- Counts-only production read audit: 72 orders, zero payment-ledger/balance
  mismatches, missing legacy due dates, duplicate gateway groups or duplicate
  store-phone groups; replica-set transactions supported (financial-shape.json).
  No customer identifiers, record-level balances, production writes or index builds.
- A repeated backend run exposed a test timing issue: an immediate return-cancel
  request can receive the existing store-management 409 while the prior HTTP
  response's DB-lock cleanup finishes. The test now verifies that exact retry
  message and actual lease release before retrying. Production locking is retained.

## Real-device checks still required

Owner can connect an Android test phone. ADB has repeatedly shown no device.
Do not claim native acceptance complete until the following are exercised on it:

1. Camera capture -> fresh <=50m GPS; denied/approximate permission, GPS disabled,
   poor accuracy, retries and expired reading. GST absent/valid/invalid.
2. Agent map markers/details/navigation, transferred-store exclusion, scrolling
   and attribution/credits. Delivery active destinations, deduplication, stops,
   navigation, native tile caching/error fallback and reassignment refresh.
3. Draft add/remove/quantity changes, minimum/stock errors, below-paid rejection,
   save/lost-reply recovery, confirmed lock, first invoice after confirmation.
4. Agent and Delivery partial collections, UPI reference, multiple instalments,
   saved retries, zero balance, history and post-delivery collections. Verify
   office approval and original-agent credit using the synthetic fixture accounts.
5. Store correction/photo/GPS request, approval/rejection and refreshed current
   details while old order/invoice snapshots stay unchanged.

An ignored helper `device-server.cjs` creates a disposable MongoDB replica set,
binds only localhost:8766, mocks uploads, disables gateway operations and imports
neither server.js nor dotenv. It requires BENGOL_DEVICE_FIXTURES=1. Use ADB reverse
for 8766 and the chosen Metro port. A development bundle must explicitly use
EXPO_PUBLIC_API_URL=http://127.0.0.1:8766. Never use a release bundle whose HTTPS
fallback would send synthetic QA to production. Fixture credentials and the local
Admin token are in the ignored device-fixture-access.local.json; do not copy them
or phone GPS/photos into committed notes. Recreate the helper's memory DB to reset.

## Compatibility and future rollout

- Only new orders opt into DELIVERY credit or ON_CONFIRMATION invoices. Distributor
  retains placement+7 days. All pre-rollout orders retain their saved due dates.
- No product quantities are seeded: all four category settings inherit the
  existing minimum (the nine currently active products were 10 packets).
- No payment eligibility/target rates are changed. Offline verification stays;
  original Order.agentId receives eligible credit, actual collector stays recorded.
- Backend request shapes remain compatible. New optional cart preflight, GPS
  version, request keys and confirmation revision are additive. Old clients may
  omit them; final backend validation still applies. Old web clients also see the
  new invoice timing on new orders, so a pre-confirmation download receives 409.
- Agent Web has exactly the approved OverDuePayments.jsx saved-dueDate fix.
  Delivery Web has no changes. Preserve existing ProductSales/mobile/sidebar work
  and the pre-existing staged new-store rename; do not stage the workspace wholesale.
- New collections: DispatchMapping, StoreChangeRequest, OrderModification. Optional
  fields on existing models. Partial new Payment idempotency index excludes legacy
  rows; StoreChangeRequest allows one pending record per store. Rehearse index
  creation in staging; do not run syncIndexes or remove existing indexes blindly.
- OSM tiles are free best effort under the linked tile policy, with attribution,
  identifying requests, normal caching and no offline/prefetch. No billing/key,
  geocoder or automatic route optimiser is introduced. Existing device navigation
  supplies road directions. Public tiles carry no production SLA.
- Before any requested rollout: finish device checks, take verified backups,
  review the exact release manifest/index plan, deploy API and office compatibility
  together, then distribute compatible mobile builds. Delay raising category minima
  until agents have a client that performs the new pre-payment cart check.
- Rolling back to a pre-upgrade API after new-policy orders/partner collections
  exist is unsafe: it can issue draft invoices early or lose policy/collector
  behavior. Use a compatibility-preserving rollback/hotfix, retaining new data.

No commit, push, production migration or deployment has been performed for this
upgrade. Native device acceptance remains the outstanding release gate.
