# Admin Orders workspace - 29 October 2026

Status: implemented/tested locally, not committed, pushed or deployed. No live
business record or settings were changed. Owner approved the generated concept
and asked for implementation using the current theme without unrelated redesign.

29 October visual follow-up: the owner requested colorful order action buttons.
Only these styles changed: Download invoice blue, Confirm order green, Cancel
order red, with white labels and focus states. Layout and handlers are unchanged.
Light/dark computed-color checks and visual review passed; text contrast ratios
are 5.17, 5.48 and 4.70 respectively. The existing action/invoice/trail browser
case, Admin lint and isolated SPA build pass after this change. Preview crops
are in `output/orders-workspace/order-action-buttons-light.png` and
`order-action-buttons-dark.png`. The earlier full-suite results below remain
the evidence for the feature implementation; no backend runtime changed here.

## Current behavior

29 October Agent-row follow-up (frontend only): `AgentManagement.jsx` now shows
non-active access states such as Blocked as a rose badge beside the application
status, matching its height and vertical center. The badges wrap when needed.
Access rules and status values are unchanged. Local synthetic light/dark browser
checks confirmed equal 26.75px heights and centers; Admin lint passes. Preview
crops: `output/orders-workspace/agent-status-alignment-{light,dark}.png`.
This small visual change is also local and not deployed.

Admin Orders defaults to All orders across stores, newest first with an ObjectId
tie-breaker. Summary shortcuts and an always-available status control expose
Placed/Awaiting confirmation, Confirmed, Assigned, Shipped, Out for delivery,
Delivered and Cancelled. In transit combines Assigned/Shipped/Out for delivery.
Counts use search/agent/store/date filters but exclude the selected status so
switching status remains meaningful. Matching result total includes status.

Search matches order/store/agent identifiers, saved order contact/address fields
and current agent/store names. Searchable agent/store lookups load at most 30
matches plus the selected value. Date presets Today, Last 7 days and This month
use India time; Custom supports inclusive calendar dates and one-sided ranges.
All dates is the default so older work is not silently hidden.

Rows show order/date, store, original order agent, status and total/open due.
Defaults to 25 per page, with 10/25/50 controls. URL parameters retain filters,
page and selected order; clearing/changing filters resets the page. Opening an
order requests its full detail independently of the filtered list, preserving
dashboard/live-notification `?order=` links even outside the current results.
Desktop uses a side panel; smaller screens use the existing themed MUI dialog.
Closing restores focus to the trigger where available. Live order refresh keeps
filters/page, refreshes counts/details, and aborts superseded reads.

Details show saved items/quantities, totals/payment/due, address, status history,
invoice download, optional delivery trail, confirmation and cancellation. Existing
ConfirmDialog, CancelDialog, StatusPill, StorePhoto and mutation endpoints are
reused. Order guards and cancelled-order zero-open-due logic were moved unchanged
to a shared utility. No payment, stock, order-transition, invoice or attribution
rule was changed. Original order agent attribution remains historical.

By store retains the previous OrderManagement component, including its local
search/pagination/photo controls and confirmations. Employee configuration still
imports that original component. No agent/delivery app or web implementation was
changed. The new Admin route lazy-loads AdminOrdersWorkspace only for Admin.

## Backend API

All routes are under protect + isAdmin; Employee permissions do not grant them:

| Route | Contract |
|---|---|
| GET /admin/order-workspace | q, status, agentId, consumerId, from, to, page, pageSize; bounded rows, total, page/pages and status counts |
| GET /admin/order-workspace/options | type=agent/store, q, selected; labels/IDs only |
| GET /admin/order-workspace/:orderId | Full order plus invoice number, agent/store labels and delivery-partner name |
| GET /admin/order-workspace/export | Same filters; full matching CSV streamed in 100-order batches |

Search is escaped literal text, limited to 100 characters. Date validity/order,
scalar query types, status and page limits are validated. Page size is capped at
50; out-of-range pages clamp to the last page. Reads/errors use no-store. No new
schema, index, dependency, environment value or data migration is required.
Legacy `/agent/orders/all` retains its full-list response for other consumers.

List rows omit products/history; the chosen order is loaded separately. Agent/
store labels are fetched only for that page. Counts aggregate matching orders;
they still do database work across the matching set. Broad text search can scan
records; do not claim page-sized database work or production latency improvements
from transfer-size measurements alone. Count/list queries can observe concurrent
changes between reads; refresh supplies current state.

CSV exports all matches, not only the current page. It uses saved order address
and payment fields, original attribution, invoice numbers, packet units, raw
numeric monetary values and cancelled-order open due of zero. User-entered text
is formula-guarded and CSV-escaped, with a UTF-8 BOM. Dates are labelled IST.
Cursor/backpressure handling bounds server memory; closing/aborting stops work.
Export is a read over current data, not an accounting snapshot transaction.
The browser aborts an obsolete export when filters change or the component closes.

## Validation

- All **61 backend tests pass**: five new cases cover global filters/stable pages/
  counts, current and saved labels/literal search, role/validation guards, full
  multi-batch CSV escaping/read-only behavior, and payload measurement. Existing
  invoice/cash/target/cleanup/authorization/stock regressions also pass.
- On 1,000 synthetic orders, unchanged legacy response: **905,661 bytes**; new
  first page (25 rows): **7,288 bytes**, about 99.2% smaller. One isolated sample
  measured 47.63 ms versus 11.22 ms. This is a fixture observation, not a p50,
  sustained benchmark or production timing guarantee.
- All **12 frontend unit cases pass**, including India-date rollover/seven-day
  ranges, unchanged action/open-due semantics and JSON/blob error messages.
- Full Chrome Admin/Employee suite: **92 passed**. Eleven new workspace cases
  cover pagination/filter combinations, stale searches, complete export scope,
  actions/invoice/trail contracts, deep links, cookie metadata/headers, live
  refresh, error recovery and layouts at 390/768/1440px. Legacy order/photo cases
  now select By store explicitly and still test their original flows.
- Four final layout/dark-theme cases pass (three viewport rechecks plus one new
  1600px dark-theme/full-navigation case): **93 distinct browser cases** covered.
  Desktop light/dark and phone screenshots were visually inspected.
- Admin/shared lint and production build/prerender pass. Existing shared-entry
  size warning remains. Help-question prerender fetch timed out in the build;
  Help HTML was generated with its existing browser-loading fallback. No help
  implementation changed.
- Initial new search/trail fixture expectations were corrected to reflect the
  saved address and actual delivery-trail response shape. The final isolated
  full suite passes; no production data was used to work around fixture issues.

## Continuation and rollout

Isolated candidate: `FrontEnd/.admin-audit.local/orders-workspace-release/src/`,
based on HEAD `9143f4b436b02c494c26e21a15b479259f27fc5b` with the 17 runtime/test
files listed in `runtime-files.json` alongside it. Logs and synthetic screenshots
are local/ignored; durable recovery information is in source/tests/these notes.
Unrelated Product Sales/mobile edits and the staged mobile rename are preserved.

Actual implementation previews are under `output/orders-workspace/`. They are
synthetic fixtures, not production customer/order data.

Before rollout, make a scoped commit excluding unrelated files, rebuild from
that commit and deploy backend first, then the Admin website using the existing
API/database/website backups and health checks. Keep previous assets for open
tabs. Smoke-test normal Admin auth, list/detail/export, deep links and existing
invoice/order flows with read-only production checks. Employee/agent/delivery
legacy contracts remain available. A frontend rollback restores the old Admin
entry; the additive read endpoints require no database rollback.
