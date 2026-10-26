# Backend context and continuation guide

Reviewed: **25 October 2026 (Asia/Calcutta)**. Repository HEAD at review:
`59354fc6f86731fd74f9099e4d6036690b8b2a2e`.

## Purpose and scope

**Latest verified release:** `ea08a37` (26 October 2026), backend and Admin
frontend audit/session hardening. See [current release record](deploy/releases/2026-10-26-admin-audit.md).
The release entries below retain the earlier deployment history.

**Local Admin follow-up (not deployed):** store photos now open a responsive
modal in Orders, Returns, Payment Info and Delivery. This uses existing image
URLs; no backend behavior changed. See [preview notes](FrontEnd/docs/admin-audit/STORE_PHOTO_PREVIEW.md).

**Deployment update (26 October 2026, Asia/Calcutta):** application release
`bc05a475b04e4ac2451166d1bd93420ca2f52b94` is pushed to GitHub `main`
and deployed on the production VPS. Backend deployment completed on 25 October;
website deployment and final verification completed on 26 October after resuming
the session. See [release record](deploy/releases/2026-10-26-admin-management.md).
Earlier statements about local-only implementation are historical.

The owner asked for a complete backend review before supplying future admin
features and changes, and for repository notes that survive loss of the chat.
The initial review changed documentation only. The owner subsequently supplied
the production enhancement brief, implemented locally on the same date. Existing
unrelated ProductSales and mobile edits remain untouched.

All first-party JavaScript in `BackEnd/` was reviewed: entry point, configuration,
database setup, routes, middleware, models, controllers, services, utilities,
and operational scripts. Package manifests, relevant deployment configuration,
and client API/admin integration points were also inspected. Dependencies,
binary assets, private environment values, and credential files are outside the
source-review scope.

Read this guide first in a new session. Then use:

- [API_REFERENCE.md](BackEnd/docs/API_REFERENCE.md): every registered method,
  full path, handler, and middleware, extracted from the route syntax trees.
- [SOURCE_MAP.md](BackEnd/docs/SOURCE_MAP.md): every backend source module,
  exported symbols, local dependencies, line count, and source fingerprint.
- [PRODUCTION_ENHANCEMENTS.md](BackEnd/docs/PRODUCTION_ENHANCEMENTS.md): current
  implementation, APIs, test evidence, additive schema/index changes, deployment
  checks and rollback constraints. Read this before modifying the new features.
- [TEST_DATA_CLEANUP.md](BackEnd/docs/TEST_DATA_CLEANUP.md): follow-up permanent
  test-agent/data/media deletion, clearer UI and owner-supplied invoice logo.
  This supersedes the initial soft-delete-only and photo-reference-only choices.
- [deploy/DEPLOY.md](deploy/DEPLOY.md): existing operational guide; historical
  statements there are documentation, not confirmation of current live state.

Read the files relevant to a requested change and inspect their diff since this
snapshot. A new session can recover context from these files while this checkout
is retained; chat memory itself is not guaranteed to survive deletion. These
notes are ordinary repository files, not an off-machine backup.

## Backend security review: 26 October 2026

**Follow-up deployed and verified:** application commit `ea08a37` is pushed to
GitHub main and live on the VPS, including the Admin frontend audit. See
[release evidence](deploy/releases/2026-10-26-admin-audit.md) for backups, file
hashes, HTTPS cookie/CORS checks and real Chrome sign-in/reload/two-tab logout.
The owner subsequently authorized backend and
Admin-frontend fixes while excluding agent/delivery web changes. See
[ADMIN_SESSION_HARDENING.md](BackEnd/docs/ADMIN_SESSION_HARDENING.md). Admin login
now supports an opt-in HttpOnly opaque session cookie backed by an additive
AdminSession collection (hashed token, one-day expiry/TTL, credential rotation and
durable logout revocation). Session-info/logout endpoints and CSRF Origin/header
checks are additive; existing bearer clients keep their contracts. Event streams
recheck the matching cookie session and close on logout. No business schema or
calculation changed. Public identity files remain a separate migration; do not
claim this follow-up made existing URLs private. The earlier security release
described below refers to `841e663` and is retained as historical evidence.

Local validation: 41 backend tests, nine frontend unit tests, 64 Admin browser
tests each in Chrome/Edge and four focused StrictMode checks pass. Admin lint and
the production frontend build/prerender pass; frontend/backend dependency audits
are clean. CSS is byte-identical after the parser dependency patch. Updated source
maps cover 121 backend modules, 446 resolved imports and 143 method/path entries.
See the follow-up report for staging/release/rollback requirements. Unrelated
Employee/agent-web lint findings and mobile working-tree edits remain untouched.

**Deployed and verified:** application commit `841e663` is pushed to GitHub main
and live on the VPS. All 36 backend tests passed; production/full dependency
audits reported zero known vulnerabilities. Deployment file hashes, patched
versions, API/database health, login and authenticated read/stream smoke checks
passed. Frontend/mobile were not redeployed. See the report's release section
for backups and remaining concerns, including public identity-document URLs.

Backend-only follow-up; see
[SECURITY_REVIEW_2026-10-26.md](BackEnd/docs/SECURITY_REVIEW_2026-10-26.md) for
confirmed issues, compatibility evidence, deployment status and remaining limits.
Reset/setup links are consumed atomically; agent/partner password changes
increment session versions and cancel reset links. Legacy version-zero sessions
remain accepted until credentials/access change. DeliveryPartner now has optional
default-zero sessionVersion. Shared authenticatedUser() validates both requests
and each published live event, so revoked employee permissions do not persist on
open streams. Concurrent login checks count toward the existing account throttle.
Partial failed stock reservations compensate earlier successful decrements.
Early upload cleanup/committed-image retention and product error handling are fixed.
Cloudinary/Multer/body-parser are patched; the old Cloudinary-1.x-only Multer
adapter is replaced with utils/cloudinaryStorage.js while retaining file metadata.
There is no frontend/mobile change or bulk customer-data migration.

## Store registration coverage fix: 26 October 2026

**Deployed and verified:** backend application commit `f4a5e09` is pushed to
GitHub main and live on the VPS. Public API health/database connectivity and
read-only checks against the affected production coverage passed. The website
and mobile binaries were not redeployed for this backend-only fix.

The production refusal in the owner's screenshot was reproduced: assigned state
`WEST BENGAL` and pincode `743503` did not match the app's free-text state
`WEST BANGAL`. Read-only production inspection confirmed that agent's assignment.
Shared `utils/salesLocation.js` now canonicalizes the observed spelling, WB/W.B.,
joined West Bengal names, case and whitespace. Store authorization still requires
the authenticated agent's own pincode in the matching state. It does not guess
arbitrary spellings, infer a state from an unassigned pin or use another agent's
coverage. New store addresses and assignment writes use canonical state names;
legacy territory reads and location pricing use the same normalization. Assignment
pins are trimmed/deduplicated. Refusals identify missing coverage, state mismatch,
unassigned pin or invalid pin format. No mobile rebuild or UI changes are needed.
See [STORE_COVERAGE_FIX.md](BackEnd/docs/STORE_COVERAGE_FIX.md) for test evidence
and deployment status. Existing mobile and ProductSales edits remain unrelated.

## Dashboard product sales follow-up: 26 October 2026

The owner cancelled the duplicate dashboard product-sales addition because the
existing Admin **Product Sales** tab already provides product-wise period reports.
The local dashboard UI/API/test addition was fully reverted before deployment;
the existing Product Sales tab and its unrelated local edits were preserved.
For future feature requests, first inspect the existing UI and backend. If the
feature already exists, tell the owner its section and how to access it rather
than adding a duplicate. Implement it only when it is missing.

## Current enhancements: 25 October 2026

These changes supersede the corresponding original-review descriptions below:

- Agent approval `status` remains PENDING/APPROVED/REJECTED. Separate
  `accessStatus` ACTIVE/BLOCKED/DEACTIVATED/DELETED and `sessionVersion` enforce
  blocking and fresh-login reactivation. Missing legacy fields mean ACTIVE/0.
  Normal agent removal is soft deletion and requires no active assigned stores.
  A separately confirmed ADMIN-only test-data purge physically removes a disabled
  test agent and its unshared store/transaction/target/incentive graph. It retains
  deletion receipts, refuses shared/handed-over data and uses a durable media
  deletion outbox. See TEST_DATA_CLEANUP.md before touching this destructive path.
- Store `registeredBy` remains the original creator; `currentAgentId` is the
  responsible agent, falling back to registeredBy for legacy stores. Shared
  storeAccess.service.js governs agent operational/history access. Original
  transaction agentIds, creation targets, sales targets and incentives never
  change on transfer. New dues on old orders retain original attribution while
  Payment.collectedBy records the actual collector; verification notices go to
  that collector. Original-agent aggregate performance is retained, distinct
  from current access to individual store/order records.
- Admin-only management endpoints use expiring previews, request IDs, unique
  audit records, MongoDB transactions and shared store locks. Transfer selected
  or all eligible active stores (maximum 1000 per operation). Archive preserves
  history; operational cleanup removes the store-photo reference and queues its
  unshared cloud image for deletion with retries; normal physical
  store deletion is limited to unused stores without business dependencies.
  Open orders, unpaid orders and open returns prevent archiving. Archived
  history/invoices stay readable by the last manager, operational writes stop.
- Rejected applications can reapply with the SAME email AND phone, reusing the
  identity and unique indexes. Atomic transition to PENDING snapshots the prior
  rejection, clears credentials and increments the session/application versions.
  Approval/rejection use compare-and-set; disabled identities cannot reapply.
  Registration now normalizes new email addresses and checks legacy email case
  with collation. The frontend registration helper now correctly awaits Axios.
- Bundled backend assets/invoice-logo.png is copied from the owner's new
  All Assets/invoice logo.png and aligned beside seller details. It replaces
  the earlier generic logo and remote fetching. PDFs use "Ordered Confirm Invoice" and retain a
  secondary "Tax Invoice" description, existing geometry and calculations.
  No bulk historical PDF regeneration was added.
- Agent/store management now has Account access, Stores, Transfer stores and
  History sections, literal store search/status filters and a separately labeled
  permanent-test-data workflow. File-cleanup status/retries appear after deletion
  and in retained administrative history.
- Orders store-list scrolling follow-up is frontend-only: isolated/memoized
  OrderStoreSidebar with local search/pagination, small Cloudinary avatar previews
  with original-image fallback and asynchronous decoding, and scoped scroll/paint
  containment. Existing order APIs and calculations are unchanged. See
  [ORDERS_SCROLL_PERFORMANCE.md](FrontEnd/docs/ORDERS_SCROLL_PERFORMANCE.md) for
  source findings, tests and the remaining real-browser performance check.
- Dashboard-summary retains old fields and adds salesOverview: daily, Monday
  week, calendar month and all-time in IST. Verified payment collections use
  existing eligibility/return rules; order value, outstanding, pending and
  rejected payments are separate. Existing yearly charts remain explicitly
  labeled as order value/recorded payments, not verified collections or profit.
- Automated isolated tests now exist. Read the report for verified results and
  remaining staging checks. None of this establishes live production state.

The sections below retain the original full backend review. Use the current
enhancement report for changed behavior and SOURCE_MAP.md for current hashes.

## Architecture and startup

- Node.js, ES modules (`type: module`), Express 5, Mongoose 9/MongoDB. No separate
  application factory: importing `server.js` connects to MongoDB and listens.
- `BackEnd/package.json`: `npm run dev` uses nodemon; `npm start` runs
  `node server.js`; `npm run backup` runs the backup script. The manifest's
  `main: index.js` is stale; the actual entry is `server.js`.
- Stack: HTTP route -> authentication/role/permission/upload middleware ->
  controller -> services/utilities -> Mongoose models and external services.
  Controllers contain substantial business logic, especially `order.controller.js`.
- Local server default is port **5000**. Web client fallback and deployed PM2
  configuration use **8000**; align local environment settings when running.
- `database/db.js` constructs the URI by literal concatenation:
  `${MONGO_URI}/bengol-spices`. Initial connection retries with exponential
  backoff from 2 seconds to 60 seconds; subsequent recovery is the driver's job.
  `/health` returns 200 only when Mongoose is connected, otherwise 503.
- Startup sets trust proxy to loopback, removes `X-Powered-By`, adds basic
  response security headers, parses JSON/urlencoded bodies, recursively removes
  body keys starting with `$`, and supplies `{}` when the body is absent.
  This body cleanup is not a general query-string or multipart validator.
- CORS reads comma-separated `FRONTEND_URL`. In production, absent settings
  fall back to the two company website origins; in development to any origin.
  The first configured origin is also the base for email links.
- Configuration checks warn but do not prevent startup. A weak/missing
  `JWT_SECRET` only produces a warning. 404 and uncaught request errors return
  JSON. Shutdown closes SSE connections, allows requests 10 seconds to finish,
  then exits; PM2 permits 12 seconds. Uncaught exceptions trigger shutdown;
  unhandled native promise rejections are logged.
- Production startup schedules old invoice-file migration one minute after DB
  connection. Starting the app is therefore not a read-only verification step.

## Identities, authentication, and permissions

| Role | Login identity | Active status | JWT lifetime |
|---|---|---|---|
| ADMIN | Environment email/password | No account lookup | 1 day |
| AGENT | Business `agentId` | APPROVED | 30 days |
| EMPLOYEE | Business `employeeId` | ACTIVE | 30 days |
| DELIVERY_PARTNER | Phone | ACTIVE | 30 days |

`middleware/auth.js` verifies Bearer JWTs using HS256. Tokens carry MongoDB
`id` plus business IDs where applicable; middleware sets `req.user._id` from
`decoded.id`. For agents, employees and delivery partners it reads account
status and `passwordChangedAt` on each request. Employees' permissions and name
are refreshed from the DB. Admin JWTs contain only the role, so there is usually
**no admin `id` or `_id`**. `models/Admin.js` exists, but is not the login source.
Audit code must allow a null ID or use an explicit `admin` fallback.

`checkPermission(key)` lets admins through, and lets employees through when a
stored Boolean is exactly true. Arrays mean **any one**, not all. Role
middleware and controller-level ownership checks still apply independently.
`optionalAuth` allows absent tokens for public products but rejects invalid
tokens when supplied.

Employee permission keys (all default false):

`canManageProducts`, `canAssignDelivery`, `canConfirmOrders`, `canGetAllOrders`,
`canGetAllDeliveryPartners`, `canAssignReturn`, `canViewDashboardSummary`,
`canCancelOrders`, `canManageAgents`, `canSeePaymentInfo`, `canSetTargets`,
`canManageNotifications`, `canAssignLocations`, `canPayoutIncentives`,
`canManageDeliveryPartners`, `canVerifyPayments`.

The frontend definitions in `FrontEnd/src/config/permissions.js` must use the
same keys. Admin always bypasses employee permission gates. Creating, listing,
soft-deleting employees and editing their permissions are admin-only.

Login failures are limited per normalized account/endpoint in memory: ten
401/404 failures within 15 minutes lock login for 15 minutes. Applications
share a 30/hour IP limit; password request routes share 30/15 minutes/IP.
These maps reset on process restart and are not distributed.

Agent approval creates a SHA-256-hashed, 15-minute password setup token and
emails the raw link. Approved agents without a password can be approved again
to resend it. Forgot/reset flows use hashed 15-minute tokens and a one-minute
resend cooldown. Agent and partner passwords require six characters with a
letter and number; employee creation requires eight with upper/lower case,
number and symbol. Password changes return a new JWT and invalidate older
sessions via `passwordChangedAt`. Logout does not revoke JWTs: employee/partner
logout changes `isOnline`; generic logout simply acknowledges.

## Data model and identifiers

| Model(s) | Responsibility and relationships |
|---|---|
| Agent | Application, documents, legacy plus structured address, optional bank data, approval and password state; unique business agentId, email and phone |
| Employee | Admin-created account, employeeId, permissions, ACTIVE/INACTIVE soft deletion and isOnline |
| DeliveryPartner | Phone login, application/document/bank/address data, PENDING/ACTIVE/REJECTED and isOnline |
| Store (`models/store.js`) | consumerId, unique six-digit deliveryCode, store type, address/GPS/photo, registeredBy as business agentId |
| AgentSalesLocation | One document per agentId + state; permitted pincodes and per-product price overrides |
| Product | SKU, descriptions/images, unit, base/discount/trade prices, GST, stock and minimum order quantity |
| Order | Business orderId/consumerId/agentId, optional Store ObjectId, line and address/location snapshots, paid/due totals, status history, delivery and cancellation blocks |
| Payment | Collection event linked by business IDs, method/gateway refs, cash verification and decision history |
| GatewayPayment | Unique key `payment:<id>` or `qr:<id>`; gateway application/refund/recovery state |
| Invoice | One per business orderId; financial-year invoiceNumber, buyer/seller/item/tax snapshots and Cloudinary PDF URL |
| Return | Whole-order return/pickup history, cancellation and future refund fields |
| DeliveryEvent / DeliverySettings | Append-only delivery trail (review metadata can change); singleton location-enforcement configuration |
| Target / AgentTargetProgress | Activity target definition and one unique progress row per agentId + targetId |
| SalesTargetConfig / AgentSalesPeriod / SalesTargetChange | Default/individual monthly settings, monthly terms and achievements, append-only settings change log |
| AgentIncentiveLedger | EARNING and PAYOUT entries; references activity progress or a sales period |
| Counter / OperationLock | Atomic identifier sequences; short-lived unique-key locks with holder tokens and TTL |
| Notification / FAQ / Admin | Recipient inbox/broadcast records; active public FAQs; legacy admin schema |

Use ObjectIds for Product, delivery partner assignments, payment verification,
target editing, and event review. Most business workflows use string IDs:
`BS<year>-001`, `EMP<year>-001`, `CS<year>-0001`, `ORD<year>-0001`,
`RET<year>-0001`. Counter keys differ (`order_<year>` versus `agent-<year>`,
`employee-<year>`, `store-<year>`, `return-<year>`); do not normalize casually.
Invoices use `invoice_<YY-YY>` and `BS/26-27/1`, resetting each April in IST.
Agent/employee IDs retry collisions; order creation also catches up a lagging
counter. Other counters do not have the same repair behavior.

## Application, territories, stores, and products

- Agent application uploads Aadhaar, PAN and photo, requires legacy address
  plus state/city/street/pincode, checks email/phone duplicates, and creates
  PENDING status and a business ID. Optional bank fields are all-or-nothing.
  A matching delivery-partner phone is rejected. Partner registration similarly
  checks agent phones, takes a document and password, and starts PENDING.
  Cross-collection phone uniqueness is a best-effort check with a race window.
- Approvals/rejections save status before sending mail and report `emailSent`
  separately. Account checks enforce inactive/rejected states on later requests.
- Assigning a territory upserts on agentId + uppercase state and **replaces the
  pincode list**. Omitting `priceOverrides` preserves prices; null clears them.
  Each override names one product and any of four store-type prices. Blank/zero
  means default, not free. Read `/agent/store/locations` before replacing coverage.
- Store creation requires image, GPS and RETAILER/WHOLESALER/DISTRIBUTOR/HORECA.
  Coordinates must be within the configured India bounding box and not duplicate
  another exact coordinate. Phone duplicates are checked in the controller but
  the schema phone index is not unique. State+pincode must be assigned to this
  agent. It creates a random unique six-digit handover code and credits store
  activity targets. There is no store OTP step or implemented store edit API.
- Prices resolve from territory override -> positive store-type product tier ->
  catalogue discount/base fallback. Store catalog uses `utils/pricing.js`.
  `order.controller.js` has its own `resolvePrice`, which also allows a sent
  price matching either base or discount when no tier is set. The two helpers
  are similar but not identical.
- Product creation needs front and back images. Descriptions pass a custom HTML
  allowlist; editable scalar fields are allowlisted. Units are kg/gm/ltr/packet.
  Product deletion is physical, but orders retain snapshots. Edits can send
  `previousStock` to apply the stock difference to current inventory rather
  than overwrite stock consumed since opening the form.
- Signed-out public catalog omits trade prices. Signed-in catalog includes
  trade tiers. Stock/SKU/internal fields are not in that public projection.

## Orders, inventory, and delivery

Normal order flow:

`PLACED -> CONFIRMED -> ASSIGNED -> SHIPPED -> OUT_FOR_DELIVERY -> DELIVERED`.

Admin/authorized staff can cancel before DELIVERED. Cancellation records its
reason/actor/history and restores stock once through a conditional transition.
It does **not** automatically refund the order's paid balance.

`placeOrder` accepts an agent's own store, up to 200 real active product lines,
enriches names/units/images/GST from the catalog, prices on the server, rounds
to paise, and requires at least Rs 1 paid and no overpayment. Due is payable
seven days later. Delivery address and coordinates come from the store, not
the agent's current position. Order totals treat line prices as GST-inclusive.

Stock is reserved through conditional `$inc` updates with `stock >= quantity`.
Insufficient stock rolls back previously taken lines. Once Order creation
succeeds, the order owns the reservation. Later work logs its own failures:
initial Payment creation, invoice generation, targets and monthly sync. A valid
cash `requestId` (16-64 letters/digits/_/-) is stored as clientRequestId under
a unique agentId+clientRequestId index to answer retries with the same order.
Verified gateway flows use payment claims instead.

Direct order placement allows CASH only. ONLINE/MIXED/QR must come through a
server-verified gateway wrapper. Confirmation and most delivery/order
transitions use conditional atomic updates to resist duplicate/stale actions.

Delivery assignment requires an ACTIVE partner and a CONFIRMED/ASSIGNED order.
A carrying partner's failed-delivery report permits reassignment, resetting
delivery state/waivers/attempt counters. The previous partner is told to return
the goods. Normal partner updates must follow the next transition and assignment.

Final delivery always requires the **store's persistent six-digit code**.
Five attempts lock confirmation for 15 minutes; attempts are claimed before
comparison. Partner order responses hide codes and financial amounts.

Each partner action can record a point-in-time position in DeliveryEvent.
This is not continuous tracking. Haversine distance uses the current store
location first, then order snapshot; up to 60 metres of reported accuracy is
allowed. Default radius is 60 m; admin can set integer 30-500 m. Blocking far
deliveries defaults false: unusual delivery locations are flagged; when enabled,
missing, mocked or far positions block final delivery unless the office grants
that order a waiver. A waiver never bypasses the delivery code.

Office tools list failed deliveries, unreviewed location events, and orders
OUT_FOR_DELIVERY over 24 hours. Staff can review an event, request retry,
reassign/cancel, or waive the location check. Settings changes are admin-only.
The broader attention dashboard also marks in-transit orders stalled at 3 days.

## Money, cash verification, and gateway recovery

There are three distinct amounts: order value, money collected, and outstanding
dues. **Order.paidAmount/dueAmount are the order-balance authority**; Payment
records explain collections and drive the newer sales calculations.

Offline due methods are CASH/UPI/CARD/BANK_TRANSFER; all require verification.
Only RAZORPAY bypasses it. Applying a due holds `order-payment:<orderId>` for
up to two minutes, checks ownership/cancellation/due, creates Payment, saves
Order, updates invoice, then credits eligible targets. Order save failure
attempts to delete the new Payment. Collections below Rs 1 are allowed only
to clear the final fractional due. This is a lock-and-compensation workflow,
not a multi-document MongoDB transaction or a durable offline request ID.

Cash verification transitions:

`PENDING -> APPROVED` or `PENDING -> REJECTED -> APPROVED`.

APPROVED is final. Rejection needs a reason; bulk approval handles at most 200
IDs individually. Lists cap at 1,000 rows (agent view 200). More than three days
pending is late. Decisions append actor/time/reason/note history. They **do not
alter Order paid/due**: the store's payment and the agent's verified credit are
different facts. Orders in agent responses include a `cashVerification` summary.

`COUNTS_AS_COLLECTED` excludes PENDING/REJECTED; legacy payments without a
verification field count. `COUNTED_ON` uses verification.countedAt or createdAt.
Approval counts from the approval instant, clamped to the last instant of the
collection month if approved later. Thus October cash approved in November can
update October's sales period. Activity PAYMENT targets are credited using the
original collection timestamp and may differ from monthly sales eligibility.

Gateway flows:

1. Checkout: create Razorpay order, then verify HMAC and fetch the actual
   payment amount/status. Currently authorized or captured status is accepted.
2. Dynamic QR: create single-use fixed INR UPI QR, expires after 20 minutes;
   client polls; verification refetches the QR and payment IDs. Initial QR checks
   agent/purpose notes; due QR checks order/purpose and local order ownership.
3. Unique GatewayPayment claim prevents repeat application. Initial verified
   payments invoke the same placeOrder controller through an internal response
   adapter. Due payments invoke applyDuePayment. Amounts come from Razorpay,
   never the client-reported paid figure.
4. Claims are PROCESSING/APPLIED/FAILED/REFUNDED/REFUND_FAILED/RESOLVED.
   FAILED or PROCESSING stale over five minutes can be retried. Unexpected
   failures and lock conflicts are retryable; business refusals request a full
   refund. Issues include failures or processing stale over ten minutes.
5. Staff with payment-info access can view issues. Only admin can refund or
   resolve with a note; the action checks whether Payment already recorded it.

There is **no registered Razorpay webhook** or queue/worker reconciling payments
that never reach verification. GatewayPayment is created on verification, not
when checkout/QR is created. The issue list is therefore not a complete view
of every payment received by the gateway.

## Returns and incentives

Only the owning agent can initiate a return, after delivery. A per-order lock
prevents simultaneous duplicate non-cancelled returns. Return is whole-order;
there is no per-line return quantity workflow.

`INITIATED -> PICKUP_ASSIGNED -> PICKED_UP -> RECEIVED_AT_WAREHOUSE -> COMPLETED`.

Office assigns an ACTIVE partner; that partner advances pickup states. Agent
can cancel only INITIATED/PICKUP_ASSIGNED; both PUT and POST cancellation are
supported for installed-app compatibility. A cancelled return can be initiated
again. Return transitions largely use document read/save, unlike atomic order
transitions. Schema refund/isClosed fields and REFUND_PROCESSED exist, but there
is no registered return-refund endpoint, no restocking on return completion,
and no automatic order paid/due adjustment.

Two independent target systems feed the same AgentIncentiveLedger:

| System | Counted event / terms | Important behavior |
|---|---|---|
| Activity Target | STORE_CREATION, ORDER, PAYMENT; DAILY 24h, WEEKLY 7d, MONTHLY calendar-window duration | All or named agents; mandatory is a label; ORDER counts UNITS or ORDERS, optional product commissions |
| Monthly sales target | Verified eligible collections on same-month orders | IST month, default settings plus individual overrides; fixed/calendar working days, weekly offs, holidays/leave; optional extra-sales reward |

Activity progress is unique per agent+target for its entire lifetime. Atomic
increments and completion flip pay the flat reward once. Product commission
can accrue on each applicable order even after completion. PAYMENT progress
counts collections, not rupees; `paymentConfig.perPaymentReward` is stored but
not used by the current service. Changes to active targets allow name/value/
reward/mandatory only; reducing value settles reached targets immediately.
Type/window/audience changes require a new target. Ending preserves earnings.
Late cash approval can credit a target that existed and was active at collection.

Monthly settings resolve own non-null -> default -> built-in (no target,
Sundays off, no incentive). Agent leave combines with company holidays. Monthly
records open and old records close lazily on reads/syncs, without cron. Running
sales are recomputed; finished months store final totals. Late verification is
an explicit exception that can refresh a closed month.

Monthly sales exclude cancelled/returned orders, and payments on orders placed
in earlier months are shown as earlier dues, not counted toward the monthly
target, daily/weekly pace or extra incentive. A warehouse-received/completed/
refunded whole-order return excludes its payments. Positive partial refund
amounts support proportional eligibility in the read-side calculations.

Daily target = remaining before today / working days left including today;
weekly targets similarly redistribute remaining sales at the week's start.
Dates/months use IST; weeks run Monday-Sunday and are split at month boundaries.
Achievement and earned reward markers are sticky: later cancellations or raised
targets do not remove earned achievements/rewards. Extra incentive eligibility
uses total sales above mandatory; `incentiveStartedAt` is a UI choice, **not a
prerequisite** in evaluate().

Settings support THIS_MONTH or NEXT_MONTH. Current achievements and already
earned incentive terms are protected; new settings apply in future months.
Every change records before/after fields, actor, effective month and notes.
Some read endpoints evaluate achievements and create periods/ledger entries;
do not assume GET means zero database writes in this design.

Wallet balance = total EARNING - total PAYOUT. Payout uses an agent-specific
lock and records a MANUAL ledger entry with actor/note; it does not initiate
a bank transfer. Agent history omits the office actor. No earnings reversal
workflow is implemented.

## Reporting, notifications, and invoice behavior

- `sales.service.js` is the newer source for verified collected sales and
  product reports. Product order quantities/value use order placement dates;
  collected amounts use payment counted dates; outstanding is the current due
  on selected-period orders. Money is allocated proportionally over line values
  with paise reconciliation. Reports separate target-eligible versus earlier
  dues, pending verification and rejected payments; can include unsold products.
  Admin filters: inclusive IST `from/to`, agentId, productId, day/week/month
  grouping; default current month, at most 800 days. Product filter narrows
  totals/trend/agent splits while keeping the full product comparison table.
- Older `dashboard.service.js`, `leaderboard.service.js`, and collection-
  performance endpoints use order totals/balances. They do not implement the
  same verification/return/date rules. Dashboard `profit` is collected minus
  refund, with no cost-of-goods model. Do not treat it as accounting profit.
  Some counts are all-time while chart/financial series use a selected year.
  Legacy date bucketing mixes server-local boundaries and MongoDB UTC months.
- Attention summary checks permissions per section and omits failing sections
  rather than fail the entire response. It covers office queues, due amounts,
  applications, low stock (<10), payment issues, cash and unpaid incentives.
- Notifications are MongoDB inbox records, not mobile push/FCM/Expo delivery.
  Custom broadcasts fan out to approved agents or active employees/partners.
  Employees cannot broadcast to employees. Broadcast UUID groups history and
  read counts; legacy records group by content/audience/minute. Inbox cap 300,
  broadcast history cap 50. Admin has no personal account inbox.
- `/api/events/stream` is authenticated SSE for admin/employees, scoped to each
  event's permission. Events: ORDER_PLACED, CASH_VERIFICATION, DELIVERY_ALERT.
  Heartbeat 25 seconds; default recycle 30 minutes to recheck sessions and
  permissions on reconnect. Clients live in memory; no persistent replay or
  cross-process event bus. Permissions on an already-open stream are a snapshot
  until reconnection, even though ordinary HTTP requests refresh them immediately.
- Invoice creation extracts GST from inclusive prices, stores one document per
  order, then generates PDFKit A4 tax invoice and uploads to Cloudinary. Payment
  updates regenerate PDF. Failures are generally logged so business writes stand.
  Download can create missing invoices/regenerate missing or old-name files.
  Allowed: admin; employees with order or payment-info permission; owning agent;
  assigned delivery partner (despite ordinary partner responses hiding money).
- Downloads redirect to Cloudinary with attachment filename. Files have an
  invoice-number plus HMAC suffix derived from JWT_SECRET; URL possession still
  grants access. Old predictable names are replaced and deleted after saving
  the new URL. Secret rotation changes future filenames as well as sessions.
- `generateInvoicePdf.js`: fixed seller identity/GST/state, tax-inclusive
  breakdown, local CGST+SGST versus interstate IGST, Indian words/date/number
  formatting, measured Tally-style layout, repeated headers, multi-page item
  planning, final-page tax totals. Logo is fetched/cached from a fixed URL with
  10-second timeout; missing logo is tolerated. Bundled Arimo subset draws Rs
  symbol. Current PDF labels quantities as pcs and does not persist product
  uom/HSN or buyer GSTIN in invoice schema, although renderer supports some fields.
- FAQs expose active records only. `seedFaqs` deletes/replaces FAQs but its
  startup call is commented out. OTP utility is an unused console SMS placeholder;
  Shiprocket service is a dummy and its shipment route is commented out.

## Integrations and deployment

| Configuration names (never store values here) | Use |
|---|---|
| MONGO_URI | Base URI concatenated by database helper; backup uses the same helper |
| JWT_SECRET | JWT signing/verification and deterministic invoice-file suffix |
| ADMIN_LOGIN_EMAIL / ADMIN_LOGIN_PASSWORD | Admin authentication |
| FRONTEND_URL | CORS origins and first-origin email link destination |
| CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET | Images, identity documents and invoice PDFs |
| RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET | Checkout/UPI QR, verification and failed-application refunds |
| RESEND_API_KEY | Transactional email; client is created lazily |
| ADMIN_EMAIL / ADMIN_PANEL_URL | Agent-application alert recipient/link; distinct from admin login email |
| PORT / NODE_ENV / EVENT_STREAM_MAX_MS / BACKUP_DIR | Listening port, production behaviors, SSE lifetime, backup output |

Cloudinary upload middleware accepts jpg/jpeg/png/pdf up to 5 MB each; six
files/60 fields/70 parts and 1 MB text per field. Folders depend on URL; store
images currently fall under agents because their path starts `/agent`.
Sanitized filenames include random bytes. Files remain accessible by URL;
random naming is not authenticated file storage. Most refused forms clean up
uploads, but not every error boundary is equivalent.

Razorpay and Resend initialize lazily, so absent keys fail those features
without stopping API module load. Resend sender is fixed to the company
noreply address; templates escape user data. No service connectivity was tested
in this review; no email, payment, database write or upload was performed.

Deployment source config: nginx -> PM2 `bengol-api`, fork mode, one instance,
port 8000, production, source directory `/var/www/Bengol-Spices-V2/BackEnd`.
Single process is important for in-memory SSE/limiters. Nginx supports HTTP/2,
25 MB upload bodies, JSON compression, unbuffered streams and 120-second proxy
read/send timeouts. `deploy/push.sh` uploads source and `deploy/backend.env`,
installs production dependencies, checks services, backs up DB, restarts PM2,
checks health and can restore saved source/config. Do not execute it for review.

Database backup streams each collection as gzipped canonical BSON Extended JSON
lines, with counts/index metadata in manifest; `.partial` renamed only when
complete, 14 retained by default. It is not a transactional point-in-time
snapshot across collections. Restore requires explicit `--to`; nonempty
collections require `--replace`, indexes are not explicitly restored from the
manifest. API models rebuild declared indexes at startup. Default backup cron
is 20:30 server time, intended as 02:00 IST when server timezone is UTC.

`scripts/check-services.js` contacts database, Cloudinary, Razorpay and Resend;
exit 0 accepted, 2 refused, 3 unreachable. It was read, not run.

Existing DEPLOY.md records that URI query-string placement caused the live DB
to be named `test`, and that development credentials had live payment keys.
These are **historical operational notes, not newly verified facts**. Because
URI concatenation is still present, confirm the actual resolved database name
before any future URI correction/migration; do not assume the name in code
proves where existing data lives.

## Admin and mobile change map

`FrontEnd/src/config/adminRoutes.js` defines sidebar/pages. Admin area/base and
`FrontEnd/src/api/services.js` connect pages to the backend. Employee screens
reuse admin components with permission gates; match employee route/sidebar
rules and backend gates when adding a feature. Web Axios chooses token by
current page prefix; admin/employee 401 responses clear only that panel's
session and redirect to its login. FormData content type is set by the browser.

| Admin surface under `FrontEnd/src/pages/Admin/Tabs/` | Backend starting points |
|---|---|
| AdminDashboard | admin.controller; dashboard.service; attention.service |
| Agent | agent/admin controllers; leaderboard/dashboard; incentive controller; target performance |
| EmpCreation | employee.controller; Employee permissions; admin permission route |
| Orders | order.controller; Store directory; invoice controller |
| Delivery | deliveryPartner.controller; delivery.controller; deliveryTrail.service |
| Returns | return.controller and Return model |
| ProductCreation / AllProducts | product.controller; upload middleware; pricing utilities |
| AssignLocation | agent controller location functions; AgentSalesLocation; store controller catalog |
| PaymentInfo | order payment summaries/issues; payment.service |
| CashVerification | cashVerification controller/service; paymentVerification utility |
| Targets | target controller/service; salesTarget controller/service and calendar utils |
| ProductSales | analytics.controller; sales.service |
| CustomNotification | notification controller/service and Notification |

`FrontEnd/src/hooks/useLiveOrders.jsx` reads SSE through fetch with Authorization,
announces/chimes new orders, and dispatches `live:order-placed`,
`live:cash-verification`, `live:delivery-alert` window events to refresh pages.
There is no backend event replay; lists remain the source of truth.

Mobile integration lives in `agent-app/src/api/` and `delivery-app/src/api/`;
types in each `src/types/`. Both share API behavior with the website and use
Bearer tokens. Their `baseUrl.ts` allows development EXPO_PUBLIC_API_URL;
installed builds require HTTPS or fall back to the company live API. Retain
backwards compatibility for installed builds when changing contracts.

## Observations to revisit when relevant

These are source-review findings, not fixes made or a complete penetration/
concurrency audit. Reproduce and choose scope before implementation.

1. **Multi-document failure gaps:** no DB transactions/outbox. Order may exist
   without initial Payment; progress/achievement can be marked before its ledger
   entry; due Payment can exist before Order update if the process crashes.
   Compensation/logging is helpful but not durable reconciliation. Missing
   initial payment records are currently a manual-repair case.
2. **Payment completion depends on client:** no webhook/reconciliation for paid
   QR/checkout never submitted to verify. Checkout creation does not bind purpose/
   agent/order via server-stored intent as QR notes do. Claims use separate QR
   versus payment keys; gateway Payment reference indexes are sparse, not unique.
   Check cross-flow identity, ownership, currency/capture policy, and crash
   recovery before expanding payment APIs.
3. **Offline retries:** per-order locks serialize collections but do not prevent
   a later retry of a partial cash collection from recording it twice when due
   still permits it. Payouts likewise have no durable client request ID.
   Existing payment/payout locks expire after two minutes without renewal;
   new store-management locks use a ten-minute lease.
4. **Returns lack settlement:** no implemented return restocking/refund/credit
   note; returns use read/save transitions. Cancellation restores order stock
   even when a partner is carrying goods, before warehouse handback is recorded.
5. **Metrics differ:** dashboards/leaderboard/collection performance are not
   verified-sales reports. Collection performance aggregates all orders including
   cancelled ones and accepts no date filter despite its comment. Activity
   rewards are not reversed for later cancellations/returns. Monthly achievements
   deliberately remain sticky. Agree metric definitions before changing labels.
6. **Inventory validation:** Product.minOrderQty is stored/exposed but is not
   enforced in placeOrder. Fractional quantities >=1 are accepted even for
   packet products. Stock-edit protection depends on client sending previousStock.
7. **Registration edges:** The Agent email unique index is still case-sensitive;
   current application lookup uses case-insensitive collation and new emails
   are normalized. Existing phone uniqueness remains enforced.
   Store phone and exact-GPS uniqueness are checks without unique DB indexes.
   Store upload ID is assigned only after early validations, so an early refusal
   can leave an upload orphaned. Verify multipart cleanup if editing forms.
8. **Access inconsistencies:** delivery partners can still download assigned
   invoices with financial details. Admin tokens have no account/revocation
   lookup. Ordinary HTTP permission refresh is immediate, SSE refresh waits
   until recycle/reconnect. Frontend local permissions are display state only.
9. **Large lists:** orders/products/stores/agents/returns and many histories are
   unpaginated; cash/notification lists have fixed caps. Reports use MongoDB
   aggregates including `$dateTrunc`; actual server compatibility is unverified.
10. **Legacy client helpers:** services.js still defines verifyStoreOtp and
    updateProductPermission targeting absent routes; no callers found in src.
    agentRegistration's missing await was fixed for reapplication; its caller
    now receives response.data. Do not copy the absent-route helpers as patterns.
11. **Operational/schema drift:** URI assembly and historical DB-name caveat;
    package main mismatch; optional invoice renderer fields missing from schema;
    old progress index migration is not performed by code. Verify actual indexes
    before relying on historical schema changes in a live database.

## Validation and next session

Current syntax/static-link checks, route extraction and source fingerprints are
recorded in SOURCE_MAP.md. `npm test` in BackEnd runs isolated regression tests
using synthetic records, a temporary MongoDB replica set and rendered invoice
samples. It never imports server.js or loads .env. The implementation report
records test/build results and explicitly untested integrations. The production
entry point, service-check, seed, backup, restore and deploy scripts were not run.

Next session: read PRODUCTION_ENHANCEMENTS.md before further feature changes or
deployment. For each change, read its mapped code, preserve client contracts and
working-tree edits, implement the requested behavior, verify it appropriately,
then update these notes and affected endpoint/source references.
