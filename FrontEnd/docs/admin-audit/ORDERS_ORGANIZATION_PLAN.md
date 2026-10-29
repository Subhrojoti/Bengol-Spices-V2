# Proposed Admin Orders organization - 29 October 2026

Status: owner approved the generated demo and implementation on 29 October 2026.
The workspace is implemented/tested locally, not pushed/deployed. See
[implementation and validation](../../../BackEnd/docs/ADMIN_ORDERS_WORKSPACE.md).
The proposal below records the original rationale. Unrelated working edits
were not modified.

## Existing features

Orders currently groups by store and requires selection before showing orders.
Store search includes store/agent/order identifiers and address/contact terms.
Pagination already offers 10/25/50 items; status buttons appear only when the
selected store has multiple statuses. These controls can be reused. There is no
all-store status filter. `/agent/orders/all` loads the entire order list, with
invoice-number enrichment, before browser filtering and pagination.

## Recommended workspace

- Default to All orders across stores, newest first. Keep By store available for
  store-history work. Retain the current theme, status meanings and permissions.
- Place a persistent filter area above results: order/store/phone/agent search,
  status, searchable agent/store selectors and date range. Include Clear filters
  and a visible result count. Always expose all lifecycle statuses; a selected
  store should not be needed to find Assigned, Shipped or Delivered orders.
- Keep compact summary cards; make useful queues such as Awaiting confirmation,
  Ready for dispatch and In transit clickable. Exact statuses remain available
  in the status control. Use a dropdown on phones to avoid cramped status tabs.
- Show compact order rows: order ID/date, store, agent, status, total/due and
  permitted action. Open items, address, status history, invoice and delivery
  trail in an expandable detail area or side panel. Confirm/cancel retain the
  existing confirmation and permission rules.
- Default to 25 results, reuse the existing 10/25/50 selector, and preserve
  filter/page state when returning from an order. Reset to page one when a filter
  changes. Keep dashboard/live-notification `?order=` navigation working.
- Add quick date presets such as Today, Last 7 days and This month, plus Custom
  and All dates. Use India time. Show active filters explicitly and label CSV
  export as Export filtered orders so its scope is clear.

## Implementation and production checks

Start with Admin. Keep existing Employee/agent/delivery workflows and legacy API
response contracts. At scale, add an authenticated, paginated read API for the
new workspace with server-side search, filtering, sorting and count summaries;
request only the rows needed for the current page. Do not present browser-only
pagination as reduced backend transfer. Keep exports complete for the chosen
filters, and measure load time, payload size and interaction responsiveness.

Reuse existing mutation endpoints for confirmation, cancellation and dispatch;
no order/payment/stock/invoice business rule change is part of this proposal.
Verify combined filters/counts, page changes, stale responses, live refresh,
deep links, invoice downloads, export scope, permissions, order actions and
desktop/phone layouts with synthetic regression fixtures before deployment.

Build and review the Admin workspace first, validate its query/performance
behavior, then deploy through the existing backup/health-check process after
the owner requests implementation and rollout.
