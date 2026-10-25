# Production enhancement implementation report

25 October 2026. Local implementation of the owner's production enhancement
brief; no deployment or production data mutation performed. Read alongside
[BACKEND_CONTEXT.md](../../BACKEND_CONTEXT.md), [API_REFERENCE.md](API_REFERENCE.md)
and [SOURCE_MAP.md](SOURCE_MAP.md). The existing unrelated ProductSales and mobile
working-tree edits were preserved.

Follow-up on the same date: [TEST_DATA_CLEANUP.md](TEST_DATA_CLEANUP.md) records
the explicitly authorized permanent test-agent cleanup, durable cloud-file
deletion/retries, reorganized UI and replacement invoice logo. Its behavior
supersedes this initial report's soft-delete-only and photo-reference-only
decisions. Current verification is 21 passing tests and 115 modules/409 relative
imports/141 endpoints; this report retains the original implementation evidence.

## Implemented behavior and root causes

| Feature | Previous problem | Result |
|---|---|---|
| Invoice | Remote logo fetch could fail silently; backend public/logo.png is an unrelated image | Correct website Bengol logo bundled in backend assets and resolved relative to import.meta.url. One embedded image reused across PDF pages. Requested heading plus secondary Tax Invoice description. Existing geometry, tax calculations and amounts unchanged. |
| Agent access | Approval status also served as access control; no separate resign/block workflow | Separate ACTIVE/BLOCKED/DEACTIVATED/DELETED access state. Every protected request checks it and sessionVersion. Reactivation requires fresh login. Delete retains identity and history. |
| Store handover | registeredBy mixed original creator with current management; order ownership relied on original agentId | Separate currentAgentId with legacy fallback, shared current-assignment authorization, previewed atomic transfers, historical creator/transaction attribution retained. |
| Store removal | No safe dependency-aware administrative removal workflow | Admin directory, counts, mutually exclusive removal choices, typed ID, transaction, audit and idempotency. Archive used for stores with history; no transaction cascade deletion. |
| Dashboard | Legacy order totals/paidAmount were not verified collection totals | Additive salesOverview based on Payment verification and existing return/cancellation eligibility; IST daily/Monday week/month/all-time. Pending and rejected amounts remain separate. |
| Reapplication | Any email/phone match was rejected regardless of application lifecycle | Exact same rejected identity can atomically submit again; retain indexes, identity, previous snapshots/reasons/decision actor and timestamps, clear credentials, return to approval workflow. |
| Onboarding response | agentRegistration read response.data before awaiting Axios | Awaited response preserves the existing successful-registration contract. |

Invoice downloads continue serving already-issued stored PDFs. The heading/logo
apply to new generation and the existing legitimate regeneration paths (for
example, payment-driven updates or missing files). No bulk regeneration was
introduced and invoice records were not rewritten. The existing startup
migration of old invoice URLs remains unchanged.

The tax description, GSTIN, tax columns and other existing invoice information
remain present. This is a conservative presentation change, not a determination
of legal compliance; the relevant official reference is
[CBIC invoice particulars, Rule 46](https://taxinformation.cbic.gov.in/content-page/explore-rules/1000136/1000001).

## Safety decisions and tradeoffs

- Agent deletion is a soft deletion. It retains identity, applications, sales,
  target, incentive and audit references. It does not free the email/phone for
  a new unrelated identity. Active stores must first be transferred or archived;
  soft-deleted accounts cannot be reactivated through this API.
- Transfer changes only Store.currentAgentId and ownershipVersion. Original
  Store.registeredBy, Order.agentId, Payment.agentId, Return.agentId, invoices,
  delivery records, targets, incentives and existing audit records remain.
  Collections on old orders keep original sales attribution, while collectedBy
  identifies the actual new collector. Cash verification notices go to that
  collector. Original-agent aggregate performance/earnings remain historical;
  individual store/order/invoice/return/cash access follows current assignment.
- A new manager gets history and operational permissions for assigned active
  stores. The former manager loses those record APIs, including idempotent
  order/gateway replay and due-QR polling. Existing employee/delivery-partner
  permissions were retained. A previously downloaded PDF cannot be recalled.
- Option A archives only. B archives and removes ONLY the store photo reference;
  it does not delete Cloudinary media or any financial/operational history.
  Address/GPS are retained for delivery evidence. C physically removes ONLY an
  unused Store document with no identified dependencies. The audit remains.
  These alternatives intentionally avoid a destructive history cascade.
- Orders in progress, unpaid noncancelled orders and open returns block archive
  operations. Last managers can still read archived history and invoices;
  archived stores cannot accept new orders/collections/return actions.
- Store-creation target progress is aggregated per original agent, not per
  store. Any such progress conservatively blocks physical deletion for that
  creator's stores, even when exact contribution cannot be reconstructed.
- Signed previews expire after ten minutes. A version/assignment/photo change
  or changed dependency counts requires a new preview. Requests use a unique
  client requestId. Repeating a completed request returns the saved result;
  reusing its ID for a different operation is refused. Refused operations need
  review and a new ID. Audit records include actor, timestamp, IDs, option,
  outcome and retention details where available. Invalid/expired previews and
  requests rejected before execution do not create a business-operation audit.
- Shared database locks serialize affected order/payment/return writes with
  store transfers/removal. Store locks have a ten-minute crash-recovery lease;
  existing payment/payout locks keep their two-minute lease. Lock contention is
  a 409 and must be retried. Operations must complete within the lease; monitor
  DB/gateway latency and use smaller transfer batches on slow deployments.
- Transfers are capped at 1000 active stores per transaction; larger sources
  use selected batches. "All" means the eligible stores shown by that preview;
  newly created stores after preview are not silently added.
- Reapplication requires both the same email and phone, one unambiguous rejected
  identity and ACTIVE administrative access. Pending, approved or disabled
  identities cannot self-reapply. Old documents/bank/address snapshots are
  retained; passwords/reset tokens are never put into history. For old records
  without a decision timestamp/reason, updatedAt is an approximate fallback and
  the history explicitly says no earlier reason was recorded.

## Reporting definitions

salesOverview contains daily, weekly, monthly, allTime, activeAgents,
activeStores, timezone, weekStartsOn and generatedAt. Each period has from/to,
ordersPlaced, collected, orderValue, outstanding, awaitingVerification and rejected.

Collections use COUNTS_AS_COLLECTED and COUNTED_ON from paymentVerification.js.
Cash contributes only after office approval; legacy records follow the existing
compatibility rule. Cancelled/full-returned orders contribute no collections.
Positive partial refunds proportionally reduce collections using the existing
sales.service.js rule. One payment is aggregated once, without multiplying by
product lines. The tests reconcile against productSales for the same interval.

Collection periods use effective counting dates; order value and outstanding
use order placement dates. Thus outstanding means still owed on eligible orders
placed in that period. Earlier-month dues can count as dashboard collections,
as in product reports; existing same-month sales-target eligibility remains
unchanged. Approved cash countedAt retains the existing month-clamping rule.
Pending/rejected amounts use collection creation dates and are informational,
not collected revenue. Existing yearly chart fields remain compatible and are
now labeled as order value/recorded payments; they are not verified sales or
profit. The dashboard refreshes on relevant live events, visibility, manual
refresh and every 60 seconds while visible.

Server aggregation returns totals rather than sending all historical orders to
the browser. All-time lookup cost grows with history; indexes and production
latency need staging verification. No persistent reporting cache or ledger
rewrite was introduced.

## API changes

All new management endpoints require protect + isAdmin. Employees with
canManageAgents retain application approval/list permissions, but cannot use
management/removal endpoints.

| Endpoint | Request/result |
|---|---|
| GET /admin/store-management | Optional agentId/page; 100 stores per page, creator and manager names/status |
| POST /admin/store-transfers/preview | sourceAgentId, destinationAgentId, consumerIds OR all:true; returns stores, dependency counts and confirmationToken |
| POST /admin/store-transfers | confirmationToken, requestId; atomic assignment update and audit |
| GET /admin/store-management/:consumerId/removal-preview | Identity, manager, counts, allowed options and confirmationToken |
| POST /admin/store-management/:consumerId/remove | confirmationToken, requestId, option ARCHIVE/ARCHIVE_OPERATIONAL/PERMANENT, confirmIdentifier equal to consumerId |
| POST /admin/agents/:agentId/access | action BLOCK/DEACTIVATE/REACTIVATE/DELETE, reason, requestId; DELETE also requires typed confirmIdentifier |
| GET /admin/management-audit | Optional agentId; latest 100 actions involving source/destination |

Existing /admin/dashboard-summary gains data.salesOverview; old fields remain.
/agent/apply keeps its request/success response shape and enables reapplication.
/admin/agents/:agentId/reject accepts optional reason (500 characters maximum,
default recorded if blank). Agent lists gain access/application history fields;
password/reset secrets remain excluded. Login/change-password JWTs include
sessionVersion. Existing JWTs without that claim work as version 0 until an
administrative action revokes them. Store/history endpoints retain their shapes
but enforce current assignment. Full route inventory: API_REFERENCE.md.

## Schema, indexes and rollout

All changes are additive. No automatic data backfill, collection drop, index
drop or history rewrite is required.

| Model | Additions |
|---|---|
| Agent | accessStatus/accessReason/accessChangedAt, sessionVersion, managementVersion, rejectionReason, applicationVersion/submittedAt/decidedAt/decidedBy/history |
| Store | currentAgentId, ownershipVersion, archivedAt/archivedBy; indexes on currentAgentId and currentAgentId/status/consumerId |
| Payment | createdAt index; existing attribution/collectedBy fields reused |
| AdminAudit (new) | unique requestId, requestHash, action/actor, source/destination/consumer IDs, details/result/outcome, createdAt; source/date and consumerIds/date indexes |

1. Verify backups and existing Agent email/phone/agentId, Store consumerId and
   OperationLock key unique indexes on staging/production using the normal
   operational process. Do not drop/rebuild unique constraints or use syncIndexes
   blindly. Reapplication depends on existing identity uniqueness.
2. Confirm MongoDB supports replica-set/sharded transactions and existing report
   aggregation operators. A standalone database causes management mutations to
   refuse with 503; there is no unsafe nontransactional fallback. Ensure the DB
   user can create the new collection/indexes. Transactions were tested on
   temporary MongoDB 7.0.14, not the live database.
3. If automatic index creation is disabled, explicitly create the above additive
   indexes through a reviewed deployment migration. AdminAudit.init and
   OperationLock.init must complete before management requests. Do not remove
   existing indexes. Consider the cost of building indexes on a large collection.
4. Check legacy data for orphaned stores/consumer IDs and ambiguous case-variant
   identities. Missing assignment falls back to registeredBy; there is no need
   to populate currentAgentId for all existing stores. Missing access/session
   fields mean ACTIVE/0. No secrets/new environment variables are introduced.
5. Ship the backend asset assets/bengol-logo.png with existing font assets.
   PDF generation no longer requires a remote logo fetch or static URL. A missing
   asset fails generation visibly rather than silently issuing a logo-less PDF.
6. Deploy backend authorization changes to ALL workers first, then the frontend.
   Do not perform transfers/blocks/archive actions while any old backend workers
   still handle requests; old code does not understand the new access fields.
7. Complete staging/manual checks below before production use. No production
   restart or deployment was performed by this implementation session.

Runtime dependencies were not intentionally upgraded. Added development-only
dependencies: mongodb-memory-server (isolated transaction tests), pdfjs-dist and
@napi-rs/canvas (PDF inspection/rendering). Production installs can omit dev
dependencies. Test installs may download MongoDB binaries; CI may cache them.

## Rollback constraints

Before management actions are used, frontend/new-management-route rollback can
leave the additive fields and indexes in place. After transfers, blocking or
archiving, deploying the old backend directly is unsafe: it ignores
currentAgentId/accessStatus/sessionVersion and could restore former access.
Prefer rolling back the frontend or disabling management mutations while
retaining the updated backend authorization. A full backend rollback requires
maintenance coordination, audited reversal of assignments/access decisions and
a reviewed data restoration strategy. Never overwrite registeredBy with the new
manager or rewrite historical transaction agentIds to make old code appear to work.
Archived stores can be restored only through a separately reviewed recovery;
no accidental bulk-unarchive endpoint was added. Physical unused-store removal
requires backup/recreation if it must be undone; the audit is retained.

## Verification evidence

- BackEnd `npm test`: **16/16 tests passed**. Synthetic data, temporary local
  MongoDB replica set, ephemeral Express listener; no dotenv/server.js imports.
  Covers revoked/legacy sessions, employee/admin permissions, selected/all
  transfers, old/new manager access, original attribution, current-manager order
  pricing/stock/idempotency, dues and verification notifications, mocked gateway
  replay/QR access, stale previews, duplicate requests, injected audit-write
  failure with full rollback, removal choices/refused audit, archive retention,
  typed confirmation, reapplication concurrency and reject/reapply/approve.
- Reporting fixtures cover pending/approved/rejected/legacy cash, gateway
  collections, cancellation, full return, partial refund, older collections,
  IST midnight/month/Monday boundaries and product-report reconciliation.
- PDF tests generate 2-row local-tax and 65-row interstate invoices. Verified
  heading, logo image operations on every page, tax descriptions/amounts and
  unchanged input data. All four rendered pages were visually inspected: no
  heading/logo/table overlap, clipped content or broken page continuation.
  PNG/PDF previews are ignored intermediates in tmp/pdfs; no Cloudinary upload.
- Touched frontend JS/JSX: ESLint passed with no errors or warnings.
- FrontEnd `npm run build:spa`: passed, 14,247 modules; existing large-chunk
  warning remains. Full SEO prerender was not run because its FAQ fetch uses
  configured external API settings; SPA compilation covers the changed admin UI.
- Offline parser/static-link inventory: **112 modules, 366 relative imports,
  137 method/path entries**. node --check passed for all 112 modules.
  Regenerate maps with node BackEnd/scripts/review-source.mjs;
  that script uses frontend development dependencies and imports no app modules.
- Expected missing-email configuration messages and the injected audit failure
  appear during tests. Email/gateway keys are removed or synthetic. Gateway
  replay tests use stubbed gateway methods; no live gateway call is claimed.

## Remaining staging/manual checks

- Actual production topology, index readiness, backup restoration, representative
  data size/query latency and transaction/lock behavior under production load.
- Browser walkthrough on desktop/tablet/mobile of management selection,
  multi-page store selection, dialogs, keyboard operation, expired/stale previews,
  network retry feedback and period switching. JSX/build/lint passed; no full
  browser interaction suite or visual admin-screen QA was performed here.
- Actual Cloudinary PDF upload/download/CORS/auth behavior, deployed asset
  packaging, existing-invoice download preservation and a new deployed invoice.
  Download authorization/redirects were tested using synthetic stored URLs.
- Approval/setup mail delivery, password setup links, real Razorpay/UPI payment
  settlement/refunds and a checkout interrupted by handover. Active gateway
  checkouts during transfer should be completed or reconciled through existing
  payment-issues handling. No gateway webhook/reconciliation redesign was added.
- Delivery/warehouse/return end-to-end flows with installed mobile builds,
  office cash verification, original-agent target/incentive reconciliation and
  SSE refresh. Their existing schemas/attribution were retained; this is not a
  claim that all live external workflows were exercised.

## Changed-file map

Backend modified: controllers/{admin,agent,auth,invoice,order,return,store}.controller.js;
middleware/auth.js; models/{Agent,Payment,store}.js; routes/{admin,order,return}.routes.js;
services/{cashVerification,payment}.service.js; utils/generateInvoicePdf.js;
package.json/package-lock.json.

Backend added: controllers/adminManagement.controller.js; models/AdminAudit.js;
services/{adminManagement,agentApplication,dashboardSales,storeAccess,storeOperation}.service.js;
utils/agentAccess.js; assets/bengol-logo.png; tests/{production-enhancements,invoice-pdf}.test.js;
scripts/review-source.mjs.

Frontend modified: src/api/services.js; pages/Admin/Tabs/AdminDashboard/AdminDashboard.jsx;
pages/Admin/Tabs/Agent/tabs/AgentManagement.jsx. Added
pages/Admin/Tabs/Agent/AgentAdministration.jsx. New controls are within the existing
Agents panel and existing dashboard cards; navigation/theme were not redesigned.

Continuation documentation: root AGENTS.md/BACKEND_CONTEXT.md;
BackEnd/docs/{API_REFERENCE,SOURCE_MAP,ENHANCEMENT_PLAN,PRODUCTION_ENHANCEMENTS}.md.
tmp/pdfs/.gitignore keeps locally generated preview files out of source control.
Do not include pre-existing unrelated ProductSales/mobile changes in this feature's
commit/deployment without the owner's separate review.
