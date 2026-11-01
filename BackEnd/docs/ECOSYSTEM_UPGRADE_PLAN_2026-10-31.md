# Ecosystem upgrade: review, decisions and implementation plan

Reviewed: 31 October 2026 (Asia/Calcutta).
Source baseline: `192d5e63c9439733240a6a3f49eda6ba04c6730f`, plus existing local edits.
Status: **owner decisions received; local implementation in progress**.
No production data or deployment changed. This document records the brief and
decisions so work can resume without relying on the attachment or chat.

## Approved decisions received 31 October 2026

These decisions supersede the earlier pending/proposed descriptions below.

- Credit: Retailer 7 days, Wholesaler 10 days, HoReCa 7 days from successful
  delivery. Distributor placement-based logic stays unchanged. Preserve existing
  unpaid due dates. Owner delegated the follow-up choice: preserve ALL pre-rollout
  orders, even when delivered later; only newly placed orders snapshot the policy.
- Minimums: per product and category, Admin configurable; preserve existing
  minimums. Initial values were reviewed before implementation. Read-only
  production product projection found all nine active products use 10 packets:
  Dhaniya 10g/50g, Haldi 12g/50g, Jeera 6g/50g, Lal Mirch 6g/50g and Shahi Garam
  Masala. Recommended inheritance of current minima for all four categories,
  retaining the existing floor. Owner delegated the choice; this conservative
  inheritance is now implemented, with no hardcoded category values or production
  product-data changes. Admin may raise category minima in product creation/edit.
- Collections: retain office verification, show recorded/verified/pending
  separately, only eligible verified payments count toward collected sales and
  incentives. Credit original Order.agentId, snapshot actual collector. Delivery
  accepts CASH/UPI only, including partial/repeated post-delivery collections,
  stopping at zero. No duplicate credit, no change to existing eligibility rules.
- Order editing: only PLACED before confirmation, server prices, add/remove/
  quantities, total cannot fall below recorded payments. Preserve payment rows,
  audit before/after/actor/time, recalculate total/due, enforce on backend.
- Invoice workflow (latest owner clarification): place order -> agent may edit ->
  Admin/authorised Employee confirms -> invoice generates -> agent editing locks.
  This supersedes same-number issued-invoice revision. Only new orders receive
  invoicePolicy ON_CONFIRMATION; legacy orders/invoices are not migrated or edited.
  Audit draft changes; no invoice exists yet to overwrite or version.
- Employee permissions: separate default-OFF store report, delivery code reveal,
  store-change review, due extension; only Admin manages permissions.
- Store proposals: name/owner/phone/address/GST/photo/GPS only; type/ownership
  remain Admin-controlled. Approval updates current store, rejection changes
  nothing; audit both. Never rewrite historical order/invoice snapshots.
- Dispatch: auto assignment on Admin or authorised Employee confirmation;
  missing/inactive mapping confirms unassigned with warning. Never override
  valid manual assignment. Preserve transit restrictions, actor/time/history,
  notify assigned/reassigned partners.
- Reports: Placed/Confirmed/Delivered date basis; pending means non-cancelled,
  not delivered. Separate current workload from assignment history. Report
  delivered, pending, failed attempts, distinct failed orders, cancelled and
  reassigned-away. Completion = delivered/(delivered+pending), excluding the
  latter two; no duplicate counts from history.
- Maps: Agent current-managed stores only; partner active currently assigned
  jobs only; selectable multi-store markers. Free/no billing/card, compare
  providers before integration. Recommended Leaflet/WebView + compliant online
  OSM tiles, manual stops/navigation links. Owner delegated the follow-up choice;
  this free approach is implemented. No road-route optimiser or paid API is added.
- GPS: fresh capture immediately after photo, accuracy <=50m mandatory for new
  mobile flow, show accuracy/retry, reject missing/old metadata for that flow,
  preserve old web format and stored coordinates. Real-device checks required.
- Agent Web exception: ONLY OverDuePayments.jsx may switch createdAt+7 to saved
  dueDate. No other Agent Web changes. Delivery Web entirely excluded.

Implementation baseline saved under ignored
`FrontEnd/.admin-audit.local/ecosystem-upgrade/before-implementation/` with 41
existing files, SHA256 hashes and exact staged/unstaged patches. Do not overwrite
or restage existing work. See the implementation checkpoint below for current work.

## Local implementation checkpoint (31 October; not deployed)

Subsequent owner-reported Admin issues are fixed in the
[store report/mapping follow-up](ADMIN_STORE_REPORT_FOLLOWUP_2026-10-31.md):
photo/tab stacking, agent/email dropdown, store-order links and Back controls,
Admin-only audited mapping revocation. Latest backend suite is 81/81; full browser
regressions 109/109 plus 17/17 final affected cases, frontend units 12/12, lint/build pass.

Implemented locally; verification is in progress, NOT a release-ready claim:

- `storeReports.controller.js`: paged creator/date reports, retained/period counts,
  current manager labels; separate POST code reveal with no-store and AdminAudit.
  Four default-off Employee flags are in the schema and Admin permission editor.
  Agent > Store Details, per-agent row shortcut and Store requests are connected.
- `orderReportDates.js` + workspace: actual Placed/Confirmed/Delivered date filters,
  IST boundaries and identical export filters; no fabricated historical dates.
- Category optional per-product fields (`retailerMinOrderQty`, `wholesaler...`,
  `distributor...`, `horeca...`) inherit current `minOrderQty`. Backend validates
  combined product quantities before reservation; scoped catalogue supplies the
  same effective minOrderQty to the existing mobile cart. Admin-only category edits.
- `orderCredit.js`: only NEW orders carry version-1 DELIVERY policy, days 7/10/7;
  dueDate null until successful delivery, initialized once in the status+invoice
  metadata transaction. Old orders remain unchanged; Distributor keeps +7 days
  from placement. Office due extension is separate-permission, stale-date-guarded,
  audited on Order and updates Invoice dueDate transactionally. Download renders
  current saved metadata; historical buyer/product snapshots remain untouched.
- `payment.service.js`: actor-aware due collection, durable client request ID/hash,
  Payment/Order/Invoice financial transaction, duplicate replay before balance
  check, overpayment protection. New offline ID index is partial, preserving old
  rows. Gateway references also recover already-committed due payments. PDF/target
  side effects follow commit. Initial placement now commits stock, Order and
  INITIAL Payment in one transaction; new drafts defer invoice metadata to
  confirmation. Legacy helper behavior remains covered by regression tests.
- Delivery CASH/UPI collection/history APIs scope to current assigned partner,
  including delivered orders. UPI requires a reference note; office verification
  remains mandatory. Original Order.agentId owns sales, actual collector is stored
  and notified on verification. Initial/new instalment rows have explicit markers;
  legacy rows are labelled Collection rather than inferred/backfilled.
- Admin Payment Info shows recorded/verified/pending and full collector history;
  extension action reuses existing design. Cash Verification shows actual collector.
  Agent Performance now reuses existing sales eligibility; recorded money is a
  separate additive field. Target/incentive arithmetic itself is unchanged.
- Agent collection screen accepts selected amounts for cash/checkout/QR; omitted
  API amounts retain legacy full-due behavior. Offline attempts are saved before
  submission in SecureStore per profile/order; retries reuse their identity.
  Agent order detail has scoped payment history. Delivery detail has partial Cash/
  UPI entry, persistent retry, history, verified/pending and remaining balance.
- `DispatchMapping` + Admin mapping screen; confirmation by Admin/authorised
  Employee conditionally assigns active mapped partner, preserves valid manual
  partner, warns when unassigned. Manual assignments also persist actor/time/name/
  previous partner history and notify previous/new partner. Existing transit rules
  retained. Confirmation/cancellation/assignment/status share store-operation locks.
- `deliveryPerformance.controller.js` + Delivery > Performance: date cohort,
  current responsibility versus historical assignments, reported COULD_NOT_DELIVER
  attempts versus distinct orders, cancelled/reassigned-away, completion formula,
  actual collector totals. Refused GPS/code checks remain separate trail events.
- Assign Location pincode chips open all matching agents from existing coverage.
- Optional GST saved/validated, propagated only to future order/invoice buyer
  snapshots. New mobile registration version requires fresh <=50m GPS immediately
  after camera photo, displays accuracy/retries; old web payloads remain compatible.
- `StoreChangeRequest`: whitelist, one pending request per store, immutable before/
  proposal, transactional office review with ownership/details staleness checks,
  phone/coverage checks, no historical order/invoice updates. Mobile request/history
  and office approval UI connected. Pending/old photos remain referenced; test-store/
  agent purge includes requests/photos; agent purge also removes dispatch mappings.
- Maps: Leaflet 1.9.4 bundled locally (BSD license retained), WebView 13.16.1 in both
  apps; online OSM tiles, identifying UA/referrer, native HTTP caching, visible
  attribution, no prefetch/offline tiles or geocoding. Agent map uses currently
  managed stores; Delivery map uses current active jobs, deduplicates destinations,
  selectable detail, manual stop order and existing navigation. Delivery DTO/photo
  enrichment and native photo viewer are implemented; native acceptance awaits a phone.
- Agent Web ONLY OverDuePayments.jsx uses actual saved dueDate. Delivery Web has
  no edits. Existing sidebar/ProductSales/mobile work and staged rename preserved.

### Verification checkpoint and outstanding work

- 79/79 backend tests, 102/102 Admin/Employee browser regressions and 12/12
  frontend unit tests passed. Admin lint and SPA production build passed.
  After the final shared-office invoice fix, 40/40 affected cases passed,
  including two additional Admin/Employee immediate-invoice cases (104 distinct
  browser cases now exist). Final backend rerun is again 79/79.
- Both mobile TypeScript checks and Android JavaScript/Hermes exports passed.
  Native bundle compilation does not establish camera/GPS/WebView device behavior.
- Isolated map HTML tests passed marker/bridge/attribution and hostile popup
  escaping with intercepted tile requests (not live basemap verification).
- Counts-only read-only production compatibility audit: 72 orders, zero payment
  ledger/balance mismatches, missing legacy due dates, duplicate gateway groups
  or duplicate store phone groups; transactions supported. No IDs, customer
  records or financial amounts were exported. No production writes/index builds.
- New order editing is implemented: scoped GET/PUT mine/:orderId/edit, revision
  compare, server pricing, combined minima, stock delta, recorded-payment floor,
  persistent same-body idempotency, immutable OrderModification snapshots, Agent
  editor/history and office history. Payment rows and original sales attribution
  stay unchanged. Existing issued/legacy invoices cannot enter this workflow.
- Confirmation creates the invoice metadata and locks the draft in the SAME
  transaction. PDF upload follows commit; authenticated download renders saved
  metadata even if storage delivery fails. All pre-confirmation payment records
  are snapshotted into the first invoice. Download cannot self-heal an unconfirmed
  new draft into an issued invoice. New office screens send expectedRevision;
  old clients may omit it and retain the previous request contract.
- New orders from old web clients also follow the approved backend invoice timing.
  Their pre-confirmation invoice button may receive the explanatory 409 response;
  no additional Agent Web/Delivery Web UI edits are made under the scope limit.
- Real-device checks are STILL PENDING. ADB remains empty. Owner can connect a
  phone; use the disposable fixture API, never real production business mutations.
  See [validation and device handoff](ECOSYSTEM_UPGRADE_VALIDATION_2026-10-31.md).
- No push, commit, deployment, destructive migration or production data write.
  Existing staging/rename and unrelated edits preserved. Evidence/logs/helpers:
  ignored FrontEnd/.admin-audit.local/ecosystem-upgrade/.

### External decisions and evidence

- [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/): visible
  attribution, identifying requests, caching, no bulk/offline tile downloads;
  best effort, no SLA or promise of unlimited free production capacity.
- [Leaflet](https://leafletjs.com/) is an open-source web map engine compatible
  with a WebView; Agent already has WebView. MapLibre needs native integration
  and a separate tile source too. GPS uses Expo Location, not geocoding APIs.
- Earlier issued-invoice revision questions are superseded by the owner
  explicitly choosing invoice issuance at confirmation. This implementation does
  not revise existing issued invoices or assume their accounting status.

## Scope and existing work

Implement missing features in backend, existing Admin Panel, Agent mobile app
and Delivery mobile app. Employee portal changes are limited to the explicitly
requested permission-controlled office features. Agent Web (`marketingHub`)
and Delivery Web must remain untouched unless the owner explicitly approves the
small credit-date compatibility exception described below. Preserve existing
design and all unrelated business logic, data, targets and incentives.

The Admin sidebar spacing fix is already local/tested and not deployed. There
are also existing Product Sales and mobile edits, including the staged rename
of the Agent store-registration screen to `agent-app/app/new-store.tsx`.
These are pre-existing work, not changes made for this upgrade. Extend the
current files carefully, preserve unrelated changes and staging, and create a
new baseline snapshot before implementation.

## Architecture and trust boundaries

- `BackEnd/server.js` mounts Express routes; Mongoose models store business
  records. Store registration/catalog/coverage are under `/agent/store`, orders
  and agent payments under `/agent/orders`, and partner jobs/history under
  `/delivery-partner`. Admin-only routes include `/admin/order-workspace`.
- The React Admin site uses `FrontEnd/src/api/services.js`. Employee routes reuse
  several Admin components but are separately gated by `employeeRoutes.js` and
  backend permissions. Admin cookie sessions and Employee bearer authentication
  must both remain supported.
- Both mobile apps use Expo/React Native/Expo Router, Axios bearer clients,
  SecureStore tokens and React Query invalidation. Main integration boundaries
  are `agent-app/src/api/` and `delivery-app/src/api/`; DTOs are in each
  `src/types/api.ts`. No embedded multi-marker map package is currently present.
- Authentication rechecks account status/session versions and current employee
  permissions on requests. UI restrictions never replace backend checks.
- `Store.registeredBy` is the creator; `currentAgentId` is the current manager,
  falling back to creator for legacy rows. Operational agent access is currently
  restricted to active stores they manage. Transfers preserve order attribution.
- `Order` contains product/address/location snapshots and financial totals.
  `Payment` is a separate collection. `Invoice` is created at order placement
  and has its own items/totals/payment list. `DeliveryEvent` records assignments,
  completion, failed attempts and exceptions. `AdminAudit` and store-operation
  locks already support administrative transactions/retries.

## Every requested feature checked against the current source

| Requirement | Existing implementation / gap | Planned application and change |
|---|---|---|
| Per-agent Store Details, total and period creation counts, daily/weekly/monthly/custom dates, individual details | Agent has Management/Performance/Incentives tabs. Store administration exists, but no creation-date report. Creation targets are not a replacement for a store report. | Admin + authorised Employee + backend: paginated Store Details tab using creator/date; show current manager separately. Count retained records, including clearly labelled archived stores; do not invent records removed by test-data cleanup. |
| Office visibility of delivery code | Persistent code already exists and Agent mobile My Stores shows it. Shared office store list intentionally omits it; partner responses omit it too. | Separate permission-controlled reveal/read endpoint and office control. Do not add codes to broad lists, exports, delivery responses or logs. |
| Payment totals, initial/subsequent payments, collector/date/history | Admin/Employee Payment Info already shows order total, recorded paid, due and expandable collection history. Backend holds one Payment per collection. Collector display is currently an ID and collector role supports only AGENT. | Extend the existing Payment Info screen, rather than duplicate it. Add clear initial/instalment identity, collector role/name, recorded/verified/pending distinctions and scoped mobile history. |
| Unlimited partial collections by agent and partner | Backend agent CASH/checkout accepts partial amounts repeatedly. Agent mobile always submits the full due, and due QR is fixed to full due. Partner has no collection API/UI. | Backend + both mobile apps: amount entry, selected-amount gateway sessions where supported, previews, repeated instalments and collector attribution. |
| Duplicate/overpayment protection | Per-order locks and balance checks exist. Gateway claims prevent many duplicate gateway operations. Offline payments have no persistent request key: a lost-response retry can record again while enough due remains. | Persistent idempotency key + payload hash, atomic balance/ledger changes, conflict checks and retry lookup; use one collection path for both roles. |
| Delivery-based credit and due-date extensions | Placement assigns `now + 7 days` for every category. Delivery sets deliveredAt but not dueDate. No extension workflow/audit. No separate Distributor rule found in source. | Backend, Admin/Employee and mobile displays: pending-delivery credit state, approved category rules, atomic delivery-date initialization, audited extensions and refreshed invoice/schedule. Existing-record policy requires owner approval. |
| Automatic agent-to-partner mapping | Confirm changes PLACED to CONFIRMED only; assignment is separate/manual. | Admin mapping controls + backend confirmation/assignment integration; default enabled as requested. Fallback, Employee confirmation and in-transit reassignment policy await approval. |
| One-click shared-pincode agents | Assign Location already lists all coverage and supports agent selection. Pincodes are static spans, not reverse lookups. | Existing Admin Assign Location: clickable pincode -> grouped matching agents with identifiers; retain assignment editor. |
| Date-wise Orders | Already deployed at Admin > Orders > All orders > Placed date: Today/Last 7 days/This month/Custom. Set From = To for one day. Status filters already exist. | Reuse existing screen. Add confirmed/delivered date basis only if approved; current date filter is placement date, not transition date. |
| Partner performance | Partner mobile dashboard has completed/active delivery and return counts/trends. Backend has partner history and DeliveryEvent trail; Admin has Dispatch/Alerts/Partner Approval. No complete requested performance/collections report. | Admin partner Performance view + backend aggregates; mobile collection totals/history. Separate current workload from historical assignment and failed attempts. |
| Store-category minimum quantities | Product Creation/Edit already stores per-product minOrderQty; Agent mobile uses it. Backend placeOrder checks quantity >= 1 but does not enforce product minOrderQty. No category settings. | Admin configuration + backend create/edit validation + Agent mobile cart. Quantity meaning, initial values and interaction with product minima require approval. |
| Store change requests and office approval | No request/review workflow. Store transfers/archive are administrative operations, not detail modification. | Agent mobile request form + backend proposal/audit model + Admin/authorised Employee review. Preserve approved data until atomic approval, reject stale requests, manage proposed photo cleanup. |
| Agent order editing before confirmation | No agent order-edit endpoint or mobile editor. Stock is already reserved, initial payment recorded and invoice created on placement. | Agent mobile + backend: controlled PLACED edits with stock delta, totals/invoice revision, audit and confirmation-race protection. Editable scope and paid-total floor await approval. |
| Agent all-stores map | Existing mobile code opens one location in the device Maps app. No multi-store view. | Agent mobile + scoped backend data; markers, selected-store details and existing navigation links. Current-manager versus original-creator visibility needs approval. |
| Optional GST during registration | No Store GST field, mobile form field or request field. Invoice renderer can display buyer GST, but Invoice.buyer schema does not store it. | Agent mobile + backend validation/storage; optional fields and future order/invoice GST snapshots. Do not rewrite historical buyer details. |
| Accurate photo-associated GPS, validation/retry | Camera-only registration photo and separate GPS button already exist. Mobile rejects mocked GPS and numeric accuracy >100m, but accepts missing accuracy and discards accuracy/time. Backend checks numeric position and India bounds, not quality/freshness. | Capture fresh GPS around camera return, retain/report quality/time, retry poor readings and validate new metadata. 50m threshold is proposed, not approved. Client coordinates are estimates, not proof of physical presence. |
| Delivery map of allocated stores | Existing one-destination Maps links only. Active jobs already scope to assigned partner. | Delivery mobile multi-marker map, deduplicate stores, selected-store/order details, navigation. No automatic route optimizer was requested. |
| Delivery store contacts/location/photos | Assigned-order DTO has address/phone/location and product photos. Populated store omits store photo. | Scoped partner store DTO and mobile detail/photo viewer. Never expose another partner's store or the delivery confirmation code. |
| Actual collections, consistent totals, preserved targets/incentives | sales.service separates order value from eligible collected payments; cash waits for approval; cancelled/returned orders and earlier-month dues have established rules. Payment Info uses recorded Order paid/due. | Keep those distinct meanings explicit; reconcile ledger/invoice/order totals, add collector dimension, and preserve target eligibility unless owner explicitly changes it. |
| Security, compatibility, performance and end-to-end testing | Existing backend security/finance/invoice tests and Admin/Employee browser fixtures provide regression infrastructure. Mobile typecheck exists; no checked-in mobile workflow test suite found. | Extend meaningful integration tests, add mobile logic/interaction checks, verify native device flows, and perform legacy contract tests before staged release. |

## Findings that must shape implementation

1. The apparent two-payment limit is largely a client restriction. Do not create
   a new fixed instalment array or replace the Payment collection. Extend the
   existing ledger and payment flow.
2. A lock alone does not make offline retries idempotent. Persist a payment
   request identifier; the same identifier and body must return the same result,
   while reuse with a different amount/order must be refused. A new intentional
   payment may have the same amount but must use a new identifier.
3. Payment creation, Order save and Invoice update currently run separately.
   The invoice update catches failures. Strengthen consistency and recovery;
   never re-charge a gateway payment or re-apply money because PDF upload failed.
   Cloudinary/PDF side effects belong after committed financial changes.
4. Delivery collection needs real actor support through schema, service,
   verification history/notifications, DTOs and reports. Payment.agentId is
   existing sales attribution, not necessarily the person who collected cash.
5. Confirm/edit/payment/cancel can race. Rechecking PLACED at the end and using
   shared transactional/conflict controls is essential; checking it only when
   the editor opens is insufficient. Preserve stock and paid amounts atomically.
6. Category minima must be checked before reservation or gateway charging and
   revalidated when recording an order. Combine duplicate product lines before
   validation. Preserve grandfathering of existing records unless approved.
7. The new credit rule conflicts with untouched Agent Web: its
   `marketingHub/Tabs/Payments/tabs/OverDuePayments.jsx` ignores dueDate and
   calculates createdAt + 7. Do not fake createdAt or change the all-dues API
   into an overdue-only endpoint to hide this. Owner must choose the narrow
   compatibility exception or accept the documented web limitation.
8. Persistent delivery codes must remain hidden from Delivery partners even
   after enriching store details and payment permissions. Reveal permissions
   need fresh server checks, no-store responses and access auditing without
   storing the code in the audit payload.
9. GPS metadata cannot authenticate location by itself. Keep mock/freshness/
   accuracy checks and clear retry messages; do not infer location from EXIF
   alone. Old clients without new metadata require a compatible path.
10. Do not backfill a missing historical payment or collector by guessing from
    totals. Reconciliation should report discrepancies for review. Existing
    cash approval timing, earlier-month dues, refund eligibility and PAYMENT
    target event counts must remain explicit and tested.
11. Store detail changes must not silently rewrite old order/invoice address,
    price, GST or location snapshots. Proposal photos need lifecycle management;
    agent/store test cleanup must account for any newly added related models.

## Historical questions from the initial review (answered/superseded above)

- **D1 Credit:** actual Distributor rule; non-Distributor day counts (proposal:
  seven days from successful delivery); treatment of existing unpaid orders.
- **D2 Minimums:** per product or total cart; four initial category values;
  whether/how existing per-product minima continue to apply. Mixed units must
  not be added together without an approved quantity definition.
- **D3 Collections:** delivery payment methods and post-delivery access;
  retain offline verification, recorded/verified/pending displays, and original
  sales-agent target attribution with delivery collector separately identified.
- **D4 Editing:** product/quantity edits only while PLACED, server-controlled
  prices, and refusal when new total falls below already-recorded payments.
  Invoice handling must retain a revision trail; no automatic refund proposal
  is included. Confirm invoice revision policy before changing issued snapshots.
- **D5 Permissions/details:** new default-off Employee permissions for store
  reports, code reveal, request review and due extensions. Proposed request
  fields: name/owner/phone/address/GST/photo/GPS; type/ownership Admin-controlled;
  previous order/invoice snapshots retained.
- **D6 Assignment:** Employee confirmation too or Admin only; proposed fallback
  is CONFIRMED/unassigned with a warning when mapping is missing/inactive;
  preserve existing reassignment restrictions once goods are in transit.
- **D7 Reporting:** date-basis selector; pending means not delivered/cancelled;
  report both failed attempts and distinct failed orders, historical assignment
  versus current workload. Proposed completion rate is delivered divided by
  delivered + pending, with cancelled/reassigned-away cases shown separately;
  define a consistent period/cohort and label it rather than imply an SLA.
- **D8 Map/GPS scope:** Agent current-managed stores only (exclude transferred
  away); Delivery active assigned destinations; fresh <=50m reported GPS after
  photo with retries. Embedded-map provider/native build configuration remains
  a technical prerequisite to confirm before adding map dependencies.
- **D9 Web conflict:** owner was explicitly asked whether to allow only the
  Agent Web overdue-date compatibility correction or keep web entirely untouched
  with its known limitation. No exception has been approved.
- **D10 Invoice editing:** owner was asked to approve keeping the invoice number,
  auditing the previous contents and regenerating the revised invoice for an
  allowed pre-confirmation order edit, or specify a different invoice policy.
- **D11 Map provider:** owner was asked whether an existing Google Maps or other
  provider project is available. Otherwise propose provider/setup before native
  integration. Do not request or store API keys in the chat or review notes.

Do not implement unresolved business behavior. Questions were sent in the chat;
record the answers here before dependent changes. Elapsed time is not approval.

## Implementation sequence after decisions

1. **Contracts and preservation:** freeze current working-file/staging hashes,
   establish fixture baselines and approved business definitions, inventory
   new API contracts/permissions, and confirm mobile map/build prerequisites.
2. **Financial foundation:** shared actor-aware collection service, durable
   idempotency, atomic Order/Payment writes, invoice reconciliation, scoped
   histories and consistent report semantics. Keep gateway recovery functional.
3. **Credit and order lifecycle:** approved credit metadata and extension audit;
   initialize credit exactly once on delivery; transactional PLACED editing with
   stock/invoice revision; category minimums; confirmation auto-assignment with
   manual assignment still available. Test concurrent edits/confirmation/payment.
4. **Stores and security:** optional GST and snapshot propagation; quality GPS
   metadata; pending store-change records and office review permissions; safe
   code reveal; updated cleanup/media reference handling and creation reports.
5. **Admin/Employee UI:** extend Payment Info and Orders; add Store Details,
   partner mapping/performance, category settings, pincode lookup and review
   controls in existing sections with the current design.
6. **Agent mobile:** registration/GST/GPS, request/history screens, editable
   PLACED cart, selected partial amount/history and retry behavior, map markers
   and detail/navigation. Reuse React Query invalidation after approved changes.
7. **Delivery mobile:** scoped store/photos/map, payments with history and
   balance preview, collection totals and recovery. Access must be rechecked
   on the server after reassignment or account deactivation.
8. **Verification and rollout preparation:** full affected regressions plus
   native-device verification, dry-run compatibility/reconciliation report,
   reviewed release bundle/backup/rollback notes. Deploy only after a subsequent
   deployment instruction; this request does not itself deploy production.

## Additive data changes implemented under approved decisions

- Store: optional GST, GPS accuracy/capture time and details revision.
- StoreChangeRequest: store/agent/version, proposed allowed fields/photo,
  status, submitted/reviewed times, reviewer and reason; indexes for pending work.
- Payment: persistent request key/hash, explicit initial/instalment marker,
  collector role/name snapshot; partial unique index only on new request keys.
  Retain historical payment records and original sales attribution.
- Order: credit policy snapshot/start/basis, nullable pre-delivery due date under
  the approved policy, extension audit, edit revision/history and assignment
  metadata. Existing orders require an explicit preservation/migration policy.
- Invoice: buyer GST snapshot and payment references; only new drafts defer
  invoice creation until confirmation. OrderModification stores draft audit.
- Agent-to-partner mapping and order-category settings: audited configuration;
  default automatic assignment on, while actual mappings remain explicit.
- Employee: narrowly scoped default-false capabilities, exposed in existing
  permissions management and enforced independently at API level.

No destructive migration or automatic recalculation of existing production
records is proposed. Index creation and dry-run reconciliation need staging
checks first; the subsequent counts-only production check is recorded above.

## Test and acceptance matrix

- Payments: initial 2,000 + 3,000 + 1,000 on a 10,000 order => recorded 6,000,
  due 4,000; agent and partner collectors; verified/pending splits; arbitrarily
  many instalments; minimum/fractional paise cases; same-key retries, changed-body
  retries, concurrent different payments, overpayment, failure after commit,
  gateway taken-but-not-applied recovery, and invoice replay/reconciliation.
- Credit: placement/confirmation leave countdown unstarted under new policy;
  delivered timestamp initializes once, repeat delivery cannot reset it;
  authorised extension + reason/audit updates schedule; revoked permissions fail;
  Distributor and legacy policies match owner decisions; IST/month boundaries.
- Editing/minima: PLACED edits, duplicate product lines, server prices, stock
  increases/releases, paid-total floor, minimum rules, invoice-at-confirmation,
  concurrent confirm/cancel/payment, post-confirm rejection and old-client reads.
- Stores: GST absent/valid/invalid, optional field compatibility, camera/GPS
  timing, denied/coarse/mocked/missing/old fixes and retry, proposal approval/
  rejection/stale version, coverage/phone conflicts, transfer/deactivation,
  pending photo cleanup, original creator/current manager counts and date ranges.
- Assignment/reporting: mapped/unmapped/inactive partner, default setting,
  Admin/Employee confirmation choice, manual reassignment, failed attempts and
  delivered/pending/cancelled records, original versus current assignment,
  filtered counts, date basis, pincode matches and all report permissions.
- Maps/delivery: relevant-store scope only, multiple orders at one store,
  missing coordinates/photo, marker selection/navigation, large marker sets,
  no code disclosure, reassignment between list and action, post-delivery payment
  scope and histories according to approved rules.
- Regression: cash verification, sales targets, incentives, returns/refunds,
  invoices/logo/unit labels, store cleanup, Admin sessions, Employee permissions,
  old mobile/API shapes and both untouched web versions. Every UI action also
  receives an unauthorised/direct-API negative case where appropriate.

## Initial review validation (historical baseline)

- Agent mobile `npm run typecheck`: **passed**.
- Delivery mobile `npm run typecheck`: **passed**.
- Reviewed existing architecture notes, affected models/routes/controllers/
  services, Admin/Employee sections, mobile clients/screens/types and legacy
  Agent Web overdue behavior. Repository has no new runtime edits from this
  request. Earlier release tests are historical evidence, not rerun results.
- No new financial/native workflow has been implemented or tested yet. No
  production database, gateway transaction, email, upload or deployment was
  invoked. Native GPS/camera/map validation still requires a device/build once
  implementation is approved.

## Primary source map for continuation

Backend: `models/{store,Order,Payment,Invoice,Employee,DeliveryEvent}.js`,
`controllers/{store,order,deliveryPartner,delivery,agent}.controller.js`,
`routes/{store,order,deliveryPartner,admin}.routes.js`,
`services/{payment,invoice,sales,cashVerification,storeAccess,storeOperation,
orderWorkspace,deliveryTrail,adminManagement,storePurge,agentPurge}.service.js`,
`utils/{paymentVerification,salesTarget,pricing}.js`, `middleware/{auth,permission}.js`.

Frontend: Admin `Tabs/{Agent,PaymentInfo,Delivery,Orders,AssignLocation,
EmpCreation,ProductCreation,AllProducts,Targets,ProductSales}`, API services and
Employee route configuration. Agent mobile `app/new-store.tsx`,
`app/(tabs)/stores/`, `app/orders/[orderId]/`, `src/hooks/useLocationCapture.ts`,
`src/components/forms/ImagePickerField.tsx`, API/types/validators/maps utilities.
Delivery mobile `app/(tabs)/deliveries/`, `app/deliveries/[orderId].tsx`,
`app/(tabs)/history/`, API/types/hooks/maps/location utilities.
