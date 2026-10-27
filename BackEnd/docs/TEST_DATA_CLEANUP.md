# Permanent test-agent cleanup and invoice logo follow-up

**27 October follow-up, deployed/verified `215430d`:** individual stores now have a
separate cancelled-test-history cleanup preview/action that preserves the agent
and other stores. See [STORE_TEST_CLEANUP.md](STORE_TEST_CLEANUP.md) for current
scope, guards, test results and rollout requirements. The individual-store
limitations described below document the earlier implementation.

25 October 2026. The owner explicitly requested a complete deletion option for
fake/test agents, their stores, orders and files; clearer management UI; and use
of `All Assets/invoice logo.png`. This supplements and overrides the earlier
soft-delete-only decisions in PRODUCTION_ENHANCEMENTS.md. Local implementation
only: no production record, uploaded file, credential or deployment was changed.

## How to use the admin UI

Open Admin → Agents → **Manage agents & stores**, or **Manage** on an agent row.
The dialog is divided into **Account access**, **Stores**, **Transfer stores**
and **History**. It keeps the existing theme and responsive dialog/table styles.

For a fake agent:

1. Select the agent. Under Account access, block or deactivate access first.
2. Stop test activity and office actions for that agent, including order/payment,
   target/incentive and delivery activity. Cleanup is a maintenance action for
   disposable records, not an online replacement for normal business workflows.
3. Select **Review permanent deletion** in the test-data section. Review exact
   category counts, file cleanup tasks, retained shared data and any blockers.
4. Optionally restore quantities from noncancelled test orders to the product
   catalogue stock. This starts unchecked: use it only if those fake orders
   actually deducted inventory. Cancelled orders are excluded to avoid restoring
   quantities twice; absent products are not recreated.
5. Type the agent ID and **DELETE TEST DATA**, then check the explicit test-data
   confirmation. Confirm deletion. The account, its stores and related database
   records are permanently deleted; identity email/phone uniqueness is released.
6. Review file-cleanup status. Failed/waiting files can be retried immediately or
   later through History → **Check / retry file cleanup**. A completed database
   deletion is not undone by a storage failure.

For individual stores, use the Stores section: search by name/ID, filter active
or archived records and choose **Delete / archive** on any agent's store.
Business-history stores retain the archive protections. A store with no business
dependencies can be deleted permanently. The complete test-agent action above
also physically deletes its test stores with their orders/history. Individual
store removal does not erase an agent's unrelated business history.

Normal **Remove account, keep records** remains available for real agents.
It remains a retained soft deletion, distinct from permanent test cleanup.

## Deletion scope and boundaries

The preview traverses original/current store assignment and agent/order/store
references. Complete deletion removes:

- Agent identity, credentials, current documents and prior application snapshots.
- Its stores, orders, payments, invoices, returns, delivery events and local
  gateway-payment tracking records, including orphaned agent-owned test records.
- Agent territories, target progress, incentive ledger, monthly sales periods,
  agent sales settings and settings-change history.
- Exclusively assigned targets. Shared targets retain the other assigned agents;
  their assignment list is never emptied into an unintended global target.
- Notifications for the agent or linked to the removed orders/payments/stores.
- Uploaded unshared identity documents, old application documents, store photos
  and invoice PDFs that can be identified in the configured Cloudinary account.

Administrative deletion receipts/audit records and file-cleanup jobs remain.
Other agents, employees, delivery accounts, global settings, shared targets and
product catalogue records are not deleted. Stock changes require the separate
explicit choice. Local gateway deletion does not refund money or erase the
gateway provider's own records; there is no automatic refund in this operation.

Complete deletion refuses transferred/inherited/shared-store cases, records
owned by other agents, an active approved account, processing gateway claims,
and exclusive targets with another agent's progress. Review/reassign shared
business data separately; the endpoint must not silently erase another agent's
history. There is a 1000-store and 5000-record-per-category limit per operation;
larger datasets require a reviewed offline cleanup.

## Transaction, locking, replay and file cleanup

Signed previews expire after ten minutes and contain a fingerprint of the
records, not just counts. Added/changed records require a fresh preview. The
agent/store IDs and deletion phrase are validated on the server. Only ADMIN is
authorized; employees cannot obtain previews or execute cleanup.

Database records, shared-target assignment updates, optional stock restoration,
the deletion audit and file-deletion outbox all commit in one MongoDB transaction.
No storage API is called before commit. Existing store locks are shared with
order/payment/return operations; agent-management and incentive-payout locks
coordinate account creation/payout interactions. Store registration holds its
agent-management lock through upload, save and target updates, and rechecks
account access after acquiring it. Stop other test/office workflows before
cleanup: this is not a global lock across every administrative/read-and-sync
workflow or external gateway event. Preview fingerprints and transaction write
conflicts protect the transaction; they cannot recall arbitrary work already
running outside the coordinated paths after commit.

Completed request IDs return their recorded result. Duplicate retries do not
repeat stock increments or database deletion. Refused IDs require a new reviewed
request. Expired previews must be renewed. Audit failures roll the transaction
back and queue no files.

MediaDeletionJob is a durable outbox. Each entry records batch ID, public ID,
resource type, original cloud account, state/attempts and a sanitized error.
Cleanup handles up to 40 files per request, four at a time, with a storage timeout.
Retry continues unfinished work; already deleted/not-found files are successful.
Changing Cloudinary accounts prevents deletion in the wrong account. Configured
Cloudinary files whose account/path cannot be matched block full-agent cleanup;
other external/unrecognized file references are counted for manual review.

Files still referenced by another agent, store, invoice, product, employee or
delivery account are retained and marked SHARED. Version/format/URL-encoded
references are checked. Application-owned folder checks prevent a caller from
asking the server to delete arbitrary files. Known current/legacy invoice public
IDs account for the old .pdf naming convention. Shared-file checks are best
effort across separate cloud/database systems; the UI requires test activity to
have stopped, and storage retries recheck references before deletion.

Store option B now queues its unshared uploaded photo for deletion as well as
removing the photo reference; previously B only removed the reference. Option C
also queues the unused store's photo. Option A keeps photos. The same retry/status
mechanism applies to store cleanup batches. Externally cached/downloaded copies
cannot be recalled by this application.

## APIs and schema

All endpoints below require protect + isAdmin:

| Endpoint | Contract |
|---|---|
| GET /admin/agents/:agentId/purge-preview | Counts, eligibility/blockers, category descriptions, optional stock quantities, expiring confirmationToken |
| POST /admin/agents/:agentId/purge | confirmationToken, unique requestId, confirmIdentifier matching agentId, confirmPhrase exactly DELETE TEST DATA, testDataConfirmed:true, restoreStock boolean |
| GET /admin/data-cleanups/:requestId | Cleanup status, only for completed agent/store deletion audit batches |
| POST /admin/data-cleanups/:requestId/retry-media | Continue pending/failed file cleanup for that completed batch |

GET /admin/store-management additionally supports literal search (name/ID) and
status ACTIVE/INACTIVE, preserving pagination/agent filtering. Removal responses
can include cleanupBatchId, cleanup and unrecognizedFiles.

New collection/model: MediaDeletionJob, with a batchId index and unique
batchId/assetKey index. Existing indexes are retained. No destructive migration,
new environment variable, runtime dependency or data backfill is required.
Ensure the new collection/indexes are ready and Cloudinary delete permission is
available before enabling the action. MongoDB replica-set/sharded transaction
support remains required. Deploy new backend code to all workers before using
the UI. Do not mix old/new workers for deletion workflows.

Rollback can disable the new UI/routes while keeping audit/outbox and normal
authorization enforcement. Permanent database/cloud deletion itself requires
independent backups for recovery; a code rollback cannot restore it. Keep pending
cleanup jobs until resolved/reviewed rather than deleting their retry metadata.

## Invoice logo

`BackEnd/assets/invoice-logo.png` is an unchanged byte copy of the owner's
`All Assets/invoice logo.png`. The PDF renderer loads it relative to the module,
independent of working directory or static hosting. It fits the image to the
left seller area, preserves aspect ratio and centers it vertically beside the
company details. Company text, requested heading, secondary Tax Invoice label,
tax calculations, totals, table geometry and existing issued PDFs are unchanged.
Only newly generated or existing legitimate regeneration paths use this logo.
Ship the new asset in backend deployment packages; the earlier generic bundled
logo is no longer used. There are no other separate invoice image views: clients
download the same generated/stored PDF through the existing invoice endpoint.

## Verification

- **21/21 isolated tests passed**, including the original 16 regressions and five
  new tests for full graph deletion, typed/admin/access/shared-data guards, stale
  previews, rollback before media calls, durable retry after storage failure,
  shared/encoded file references, inventory restoration exactly once, preservation
  of global/shared targets and other accounts, literal store search and uploaded
  store-image removal. Storage calls are stubbed; no live files were deleted.
- PDFs generated/rendered for 2 and 65 products. New logo/heading appear on every
  page; short and multi-page final layouts were visually inspected. Original tax
  and amount assertions pass.
- Touched frontend JSX/JS: ESLint passed. Production SPA build passed (14,247
  modules); existing chunk-size warning remains.
- node --check passed all **115** backend JS/MJS files. Static linking/inventory:
  **409** relative imports and **141** registered method/path entries. Regenerated
  API_REFERENCE.md and SOURCE_MAP.md provide current fingerprints.
- Browser inventory was empty and opening the in-app browser reported unavailable.
  Interactive desktop/tablet/mobile dialog checks remain for staging; there is no
  claim of browser QA or live Cloudinary/gateway/production verification.

Changed/added since the previous report: agentPurge.service.js,
mediaCleanup.service.js, MediaDeletionJob.js, admin management service/controller/
routes, storeOperation.service.js/store routes, frontend API helpers and agent
management dialog/entry label, invoice renderer and invoice-logo.png, targeted
tests and continuation documentation. Pre-existing ProductSales/mobile edits
and the supplied All Assets source logo were not modified.
