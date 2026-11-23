# Production Admin tuning and access review, 23 November 2026

Application commit `ac78bac402e6a24cabed4f4d53e4011f2c04d21c` was pushed to
`main` and deployed to the VPS on 23 November 2026 (Asia/Calcutta).

## Changes in production

- Dispatch and other non-review staff now receive a compact partner directory
  without identity documents, full addresses, or bank details. Admin and
  employees with `canManageDeliveryPartners` can still review applications.
  Admin dispatch also requests the compact view.
- Bills calculates the totals and current page in the same MongoDB aggregation
  for ordinary page reads, reusing the invoice-to-order join. A request for a
  page beyond the results falls back to the last available page.
- Store Dues history loads at most 20 payment records per page. MongoDB sums
  the entire matching ledger by verification status before returning the
  totals. Amounts, paid balances, receipt notes and audit history retain
  their existing semantics.
- Employee logout revokes that session on the API. Delayed responses and
  permission refreshes preserve current sessions. Employee sections load on
  demand. Store Details blocks stale actions and conceals previously displayed
  codes during report changes. Store Dues returns to the last available page
  after settlement and preserves the original reference for receipt retries.
- The Stores directory has direct access to the existing test-store cleanup
  review and can restore an archived store whose assigned agent is active.
  Restoration requires the signed preview and typed confirmation.

Pending Chain pricing and Agent and Delivery App changes were kept in the local
workspace for their coordinated release.

## Verification

- The exact candidate passed 181 Chrome browser tests, 125 isolated backend
  tests, 18 frontend unit tests, lint, the production build and prerender.
  Frontend and backend npm audits found zero known dependency advisories.
- Three cold runs in throttled Chrome with intercepted test data measured
  494,261 encoded JavaScript bytes at Employee profile startup on the previous
  production build and 248,664 on the new one, a 49.7% reduction. The Admin
  dashboard transferred 355,826 and 355,339 bytes respectively.
- All 192 deployed API files and 222 website files match the release. The
  initial hash comparison found 15 text files whose line endings changed
  during Windows Git archive export. Their contents match the tested source
  after newline normalization, and the deployed bytes match the archive.
- Public, Admin, Employee, Agent Web and Delivery Web entry pages responded.
  The API database health check passed over HTTP/2. The production API
  settings fingerprint and the running HR process were verified unchanged.
- Read-only Admin smoke checks passed for Bills, Store Dues and payment history,
  Orders, delivery-code listing, partner dispatch and review, store reporting,
  returns, mappings and employee permissions. No real order, financial or
  permission action was submitted. The temporary Admin session was revoked.

Existing public identity-document URLs still need a storage migration.
[Identity-document review](../../BackEnd/docs/ADMIN_SESSION_HARDENING.md).

## Backups and rollback

- Private backup and release directory
  `/root/bengol-release-admin-20261123` contains the verified source and website
  archives, the production settings fingerprint and the previous asset manifest.
- Database snapshot `/var/backups/bengol-spices/2026-11-23_1514` contains 1,762
  documents across 30 collections. Every gzip archive passed its integrity check.
- Previous API directory
  `/var/www/Bengol-Spices-V2/BackEnd.previous-admin-20261123` and previous website
  `/var/www/Bengol-Spices-V2/FrontEnd/dist.previous-admin-20261123` were retained.
  Previous JS and CSS assets are still available for open browser tabs.
- Restore the code and website together if rollback is needed. Consult current
  office activity before using any database snapshot. The release did not
  restore or migrate stored business data.
