# Individual test-store cleanup - 27 October 2026

Status: pushed, deployed and verified on 27 October 2026 (Asia/Calcutta).
Application commit: `215430d422d71b438f52b978cecbf8851f63d7d7`.
Deployment verification did not delete production records or uploaded files.
See [release evidence](../../deploy/releases/2026-10-27-store-test-cleanup.md).

## Why this was added

The owner identified `CS2026-0051` as a test store with one cancelled order,
payment and invoice. Existing unused-store deletion intentionally refuses any
business history, including cancelled history. Complete test-agent cleanup would
remove the account and its other stores. The owner explicitly requested a
separate store-only option; this does not weaken the normal deletion rules.

## Admin flow

1. Open Agents > Manage agents & stores > Stores. Find the store, then choose
   Delete / archive > Review test-store cleanup.
2. Review the store identity, exact record/file counts, retained data and blockers.
   All orders must already be cancelled; returns must be closed or cancelled.
3. Stop activity on that store. Type its store ID and `DELETE TEST STORE`, and
   check the explicit test-data/permanent-deletion confirmation.
4. Confirm. The database deletion and audit/outbox commit in one transaction.
   Check file status; retry pending/failed files in the result or History.

The new review uses the current dialog/theme. It preserves the selected agent
filter and other stores. It never calls the entire-agent purge endpoint.

## Scope and protections

Deletes the selected Store, its cancelled Orders, directly linked Payments,
Invoices, terminal Returns, DeliveryEvents and Notifications (store/order/
payment/return metadata). No agent-wide deletion query is used. Unshared owned
store photos and invoice PDFs are queued for Cloudinary cleanup. Current,
legacy and stored older-key PDF public IDs are considered. Shared files remain;
external/unrecognized URLs are counted for manual review. Unmatched Cloudinary
account/path references block cleanup instead of deleting in another account.

Preserves the agent account/documents, all other stores and their transactions,
territories, targets/progress, incentive ledger, sales settings/periods, products,
stock, counters and an administrative deletion receipt. Stock is not restored
again: normal order cancellation handles that operation. This cleanup does not
perform refunds, erase provider records or recall backups/downloaded copies.

The limited store cleanup refuses active/delivered orders, open returns,
transferred/shared-agent history, cross-store links, online/gateway payment
tracking (including applied/refunded rows), missing payment dates and potentially
affected target/reward accounting. Target progress has no per-store attribution;
matching target windows that could have received activity after creation require
separate review. Targets already ended before the relevant event are retained
without blocking it. Payment months with a closed/rewarded sales period also
require review. Agent-wide progress is never silently deleted or guessed at.

The screenshot's counts alone do not establish eligibility under all these
checks. Live verification found `CS2026-0051` already absent before rollout, with
a completed deletion receipt dated 27 October at 09:06:57 UTC (14:36:57 IST) and
four file jobs marked DELETED. The stored receipt lists one store, order, payment
and invoice removed. The record checksums/counts and receipt count stayed
unchanged during this deployment. No cause/actor of that prior cleanup is inferred.
The deployed missing-store preview correctly returns 404. Live UI verification
used another existing store and showed its active-order blocker without deleting.

## API and execution

Both routes require protect + isAdmin; Employee permissions cannot grant them:

- GET `/admin/store-management/:consumerId/purge-preview`: identity, allowed,
  blockers, category/file counts, removes/preserves/warnings and a signed preview.
- POST `/admin/store-management/:consumerId/purge`: confirmationToken, unique
  requestId, confirmIdentifier equal to consumerId, confirmPhrase exactly
  `DELETE TEST STORE`, testDataConfirmed:true. No stock-restore parameter.

Previews expire after ten minutes. A store-specific fingerprint includes the
complete selected records, relevant accounting blockers and file/reference
state. Execution replans in the transaction; any added/changed record requires
a fresh preview. Used/refused request IDs and completed retries retain the
existing management semantics. Replays do not repeat database deletion or stock
changes; unfinished media cleanup can continue independently after commit.

The new action is `PURGE_TEST_STORE`. Existing cleanup status/retry endpoints
recognize its completed audit batches. Deletion uses the existing store and
agent-management locks, MongoDB transaction and durable MediaDeletionJob outbox.
Invoice downloads/recovery and complete cash approval/rejection side effects
now share store locks as well, preventing orphan regeneration/notifications
mid-cleanup. The invoice test teardown waits for final lock release before
closing its isolated database. No global maintenance lock is claimed: stop
activity on the selected test store before confirming, as the UI requires.

## Validation and rollout

- All 56 backend tests pass (49 previous plus seven new cleanup cases). The
  final stored older-key PDF cleanup adjustment also passes the seven focused
  cases. Synthetic MongoDB and mocked file APIs only; no live environment loaded.
- Coverage: selected-store graph removal with an active agent; same-agent and
  other-agent store preservation; unchanged stock/counters/settings/incentives;
  Admin-only/typed/expired/wrong-scope guards; replay; blockers; stale preview;
  audit-failure rollback with no queued files; lock contention; file failure/
  retry and shared-photo retention. Existing invoice, cash verification, target,
  management and authentication regressions also pass.
- All 81 Chrome Admin/Employee browser cases pass, including five new review,
  confirmation, blocker, stale-response, media-retry/history and phone cases.
  Desktop and phone reviews were visually inspected; the phone review scrolls
  within the existing dialog. A final desktop confirmation probe also passes.
- Admin/shared lint, nine frontend unit tests and full production build/prerender
  pass. Existing bundle-size and Mongoose deprecation warnings remain. The initial
  unit-test process-spawn sandbox failure was rerun successfully with subprocess
  access. Intentional injected storage/audit errors demonstrate rollback/retry.
- Isolated build: `FrontEnd/.admin-audit.local/store-cleanup-release/src/`, based
  on `59939e9983cf587e289a02ed2b5f29f887d4c31b` plus only the ten affected runtime/
  test files. All ten matched the scoped release; deployment was rebuilt from
  the application commit. Unrelated Product Sales/mobile edits are excluded and
  preserved. All 142 backend and 205 website files match the deployed build.
- Normal production Admin sign-in, the store-only review, initially empty typed
  confirmations, disabled delete control, visible blocker, desktop/phone layout
  and unauthenticated GET/POST refusals passed. No authenticated purge was sent.
  The test session was revoked through normal logout; replay returned 401. The
  initial probe could not find the desktop logout button after switching to the
  phone viewport; using the existing logout API completed cleanup and verification.
- API/database health, catalogue, HTTPS/HTTP2, Admin/Employee pages, expected
  redirects/404 and the existing Orders Invoice button download pass. Private
  settings are unchanged. Only bengol-api reloaded; the HR API stayed running.

Backend and Admin website were deployed together. Existing replica-set
transaction, audit/outbox collections/indexes and storage-delete permissions
remain required; no new dependency, environment value or schema migration.
Back up API, website and database through the established deployment flow.
Code rollback can hide/disable the new action; it cannot undo a confirmed
database/cloud deletion. Recovery of deleted data requires independent backups.
