# Bills and collector-specific verification

1 November 2026. New work is local and not deployed. The earlier application
release `abf72b3` is live; this document describes subsequent changes.

## Existing feature reused

Orders already includes Delivery verification code > Reveal delivery code:
Admin opens an All orders detail; employees expand an order in By store.
`StoreDeliveryCode` deliberately reveals/hides the code, and the backend checks
`canViewDeliveryCodes` and audits access. Employees also need order-view access
to open Orders. No duplicate code field or automatic code disclosure was added.
New browser cases verify this existing flow for both Admin and permitted staff.

## Cash Verification

- Added All collectors / Agents / Delivery partners tabs, retaining the existing
  status/date/search filters and office approval/rejection workflow.
- New optional `collectorRole` API query scopes both rows and summary tiles;
  omission retains the old all-collectors response behavior.
- Classification uses recorded `collectedBy`, not the sales agent attached to
  the order. Missing collectors remain in All; they are not guessed to be agents.
- Switching tabs clears bulk selections, local agent filtering and the old
  history dialog. Existing latest-read/stale-row guards prevent old actions.
- Sales ownership, verification rules, payment records, incentives and amounts
  are unchanged. Added stable ID tie-breakers to existing payment sorting.

## Bills

- New Operations > Bills navigation for Admin and staff holding the separate
  default-off **View Bills & Download Invoices** (`canViewBills`) permission.
- Paginated issued-invoice list with original invoice store name, sales agent,
  invoice/order IDs, status, bill amount and current remaining balance. Details
  show saved items, recorded paid amount and due date. Cancelled orders retain
  their bill history but have no active outstanding balance.
- Filter by store, original sales agent, search, date basis (Invoice / Placed /
  Confirmed / Delivered), India-calendar period/custom dates and remaining balance.
- Single PDFs reuse the existing authenticated invoice download. Only the new
  permission was added to its staff allowlist; existing permissions still work.
- Download all matching builds one ZIP across every matching page. It renders
  PDFs using the existing invoice template/logo from saved invoice data; it
  never creates invoice numbers, revises invoice records or changes payments.
- ZIP generation writes privately to temporary disk, one PDF at a time, with
  at most two simultaneous preparations and one per actor. Names are sanitized
  and unique. Completed archives are delivered with a length; errors do not
  masquerade as successful partial archives. Disconnects abort work; temporary
  files are removed. Active downloads lock filters and cancel on page unmount.
- New protected routes: GET `/admin/bills`, `/admin/bills/options`,
  `/admin/bills/download`, `/admin/bills/:invoiceId`. Every route independently
  enforces login and `canViewBills`; agents/delivery partners cannot use them.
- Draft orders following the new confirmation policy are excluded. Listing and
  ZIP generation do not repair missing invoices or change historical snapshots.

## Dependencies and release notes

Pinned `zip-stream` 7.0.5 (Node >=18), using its sequential entry callback API;
see [upstream source/documentation](https://github.com/archiverjs/node-zip-stream).
The installed package's default export was checked directly. Patched only the
existing `follow-redirects` dependency alongside this addition. Production npm
audit reports zero advisories; unrelated development advisories were not forced
through breaking upgrades. Backend dependency installation is required at the
next deployment. No database migration, employee permission backfill or mobile
change is needed.

Large ZIPs require preparation time and temporary disk space. Current browser
timeout is five minutes; the existing API reverse proxy has a two-minute read
timeout. For unusually large exports, narrow the filters rather than retrying
simultaneously. This release does not introduce background export jobs or alter
production nginx settings.

## Validation

Backend full suite: 94/94 pass, including protected Bills access, stable paging,
India date boundaries, original store names, cancelled/current balances, literal
search, 26 real PDF entries in a ZIP across multiple pages, unchanged invoices/
counters and collector-scoped rows/summary. An initial full run had one failure
not reproduced by the enhancement-suite repeat or complete final repeat.

Admin lint, production SPA build and frontend units (13/13) pass. Initial broad
browser run: 151/155 passed. It caught the Bills picker expecting an object
instead of the shared component's ID string; corrected the wiring. Also fixed
custom-date capitalization and the details dialog's accessible title, corrected
a test selecting combined store/cell text, and updated the permission-save
expectation from 20 to 21 keys while asserting Bills stays off by default.

All nine final affected-flow browser cases pass on the rebuilt final source:
390px light / 1440px dark filters and downloads, list/ZIP failure recovery,
employee permission on/off, collector scopes/selection reset, existing Admin and
Employee delivery-code reveal, and permission-save preservation. The 151 broad
passes cover existing critical workflows; the entire suite was not repeated
after the isolated Bills picker/title correction. Desktop and phone screenshots
inspected in `.admin-audit.local/bills-{390,1440}.png`, with no outer horizontal
overflow. The phone table scrolls inside its container.

Endpoint/source inventories regenerated: 151 backend modules, 637 relative
imports, 177 endpoints; 172 parsed frontend modules, including 46 Admin modules.
No new-feature push or deployment was performed.
