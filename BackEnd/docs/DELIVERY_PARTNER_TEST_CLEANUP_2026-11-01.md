# Test delivery-partner cleanup

1 November 2026. Local implementation; no production deletion or deployment.

## Request and location

The owner requested a deletion option like test-agent cleanup and explicitly
confirmed that linked fake business records must also be removed. Partner Approval
previously offered approval/rejection and account details without deletion.

Admin path: **Delivery Partner → Partner Approval → Delete test partner**.
**Cleanup history** on that tab keeps recent successful receipts and file retry
controls after the account disappears. Employees cannot use either control;
preview, execution and cleanup retry independently require Admin on the backend.

## Scope and safeguards

The preview follows current/historical delivery assignments, events, pickups and
collections to identify related orders. It lists counts and affected order, store
and agent IDs. The dialog paginates affected-order rows.

Execution removes the reviewed partner account, its mappings, listed cancelled
test orders, payments, invoices, returns, order revisions, delivery events and
related notifications. Unshared identity documents and invoice PDFs are queued
for deletion. Agent accounts, stores/store photos, unrelated orders, shared files,
targets, incentives and audit receipts remain. Stock is unchanged: existing
order-cancellation handling applies before cleanup.

Confirmation requires the exact partner ID, **DELETE TEST DELIVERY DATA**, and
acknowledgement that every listed record is fake, activity has stopped and the
operation is permanent. The backend blocks:

- Orders in any state except CANCELLED; active/delivered orders cannot be removed.
- Open return pickups, orphaned/inconsistent links or transferred/shared stores.
- History involving another delivery partner, including reassignments/collections.
- Gateway/Razorpay payment and refund tracking.
- Shared target progress or closed/rewarded monthly accounting overlapping the
  activity, and payments with unreliable dates.
- Cloudinary files that cannot be safely matched to this account/application.

External non-Cloudinary URLs are reported for manual file cleanup. Unlike
test-agent purge, this cleanup preserves stores and shared agent accounting.
Blockers require review rather than erasing another person's rewards or history.

## APIs and concurrency

- GET `/admin/delivery-partners/:partnerId/purge-preview`
- POST `/admin/delivery-partners/:partnerId/purge`
- Existing `/admin/data-cleanups/:requestId` and `.../retry-media` now accept
  completed partner-cleanup receipts too.

The signed preview expires in ten minutes. Execution rebuilds the plan inside a
replica-set transaction and compares its fingerprint; changed data requires fresh
review. The existing Admin operation runner commits deletion and the audit receipt
together, replays successful request IDs and retains refusal receipts. A recorded
refusal needs a new review/request. Network uncertainty after a successful commit
can be recovered with the same request or through Cleanup history.

Existing store-management locks protect affected stores. An additive hidden
`DeliveryPartner.activityVersion` field serializes deletion with manual assignment,
automatic confirmation assignment, pickup assignment and mapping changes. These
transactions write/recheck the ACTIVE partner row, so an assignment admitted just
before cleanup cannot leave work attached to a deleted account. Pickup assignment
also checks INITIATED inside its transaction. Normal assignment API contracts stay
compatible. Account deletion removes credentials/reset tokens; existing auth checks
account existence on every request and rejects old partner sessions afterward.

## Files and receipts

The existing durable MediaDeletionJob pipeline handles failures and checks shared
references before deleting files. Its allowlist now includes the actual uploader
folder `bengol_spices/delivery_partners/`; other accounts and unsafe paths remain
rejected. Pending/failed jobs can be retried after database deletion.

AdminAudit action: `PURGE_TEST_DELIVERY_PARTNER`, with additive `sourcePartnerId`.
Receipts retain ID/name, actor, removed counts, time, test-data confirmation and
cleanup batch. Passwords, bank details, document numbers and URLs are not copied.
No Agent Web, Delivery Web or mobile source changes are part of this feature.

## Validation and release

Backend full suite: **87/87 passed**. New isolated cases cover exact confirmation,
Admin-only access, stale data, preserved stores/agents/unrelated business, shared
partners/rewards, assignment races, audit rollback, idempotency, shared files and
retryable storage failures. Extra assertions added afterward are checked below.
The final extra refusal assertions passed in an isolated rerun. The complete
Admin browser suite passed **132/132**, including all four new cleanup cases.
Frontend production build and Admin lint passed. Browser checks use intercepted
APIs; backend checks use an
isolated replica set and stubbed storage. No production services were started.

The offline source/import inventory passes: 147 modules, 619 relative imports and
172 registered method/path entries. Phone review screenshot inspected; content
scrolls inside the dialog and typed fields stay within its width.

One initial run exposed a transient 409 between sequential collection calls;
that unchanged collection case passed in isolation and the complete rerun passed.
The intended store-lock retry behavior remains; payment logic was not changed.

Deploy compatible backend and frontend together. No migration or automatic
account deletion is performed. Admin must review/confirm a particular account in
the UI. No commit, push or deployment is included in this implementation turn.
