# Delivery Partner Performance — 1 November 2026

## Owner request and existing features

The owner requested a bug review of Admin → Delivery Partner → Performance,
details of which partner delivered which items, and appropriate employee access
without a redesign. The existing tab already provided counts, date-basis/period
filters, partner paging and collection history. Dispatch, failed-delivery actions,
partner approval and the delivery audit trail already existed in other sections.
Those workflows are reused rather than duplicated.

This review is **local only**. No push, deployment, production database repair or
live business mutation was performed. Existing working-tree and staged changes
were retained. No mobile-app or Agent/Delivery Web source changed in this task.

## Reproduced calculation defects

1. Historical membership considered the current partner, assignment `partnerId`
   and ASSIGNED events, but omitted `assignmentHistory.previousPartnerId`.
   An older order's first reassignment can be the first history entry. In that
   case the former partner vanished from its historical workload and could also
   lose their collection amount in the report.
2. Collections were counted only inside the assignment grouping. A valid receipt
   from a collector whose old assignment was not retained could disappear even
   though Collection history still showed the receipt.

The new service takes a union of normalized partner IDs from the current order,
both sides of assignment history and delivery events, once per order. Repeated
assignments/events do not multiply orders. Current responsibility remains separate:

- Delivered/pending/cancelled counts refer to the current linked partner.
- Reassigned-away orders are historical work, excluded from current workload.
- Completion remains `delivered / (delivered + current pending) × 100`.
- Failure attempts count COULD_NOT_DELIVER events for the selected partner;
  distinct failed orders count each affected order once. Rejected code/GPS checks
  are audit events, not failed-delivery attempts.

Receipts are aggregated independently by actual collector over the same order-date
cohort. A collector-only receipt does not invent an assignment or delivery. Added
rejected totals alongside recorded/verified/pending, rounded to paise. Verification
policy and original sales-agent attribution are unchanged. These are collection
records, **not eligible sales/incentive totals**; receipts on cancelled orders can
remain present and are labelled accordingly. Existing ledger APIs retain their
current response contracts.

Regression example: a delivered order moved from FIRST to SECOND with only a
`previousPartnerId` entry now gives FIRST one reassigned historical order and
SECOND one current delivered order. FIRST's pending/approved/rejected receipts
remain in FIRST's collection totals. Repeated identical history entries still
count that order once.

## Orders and items

From a partner's existing performance card choose **Orders and items**. The view
initially shows their currently linked delivered orders. Available views:

- Delivered by this partner.
- Current pending deliveries.
- All assigned history.
- Orders with reported failures.
- Cancelled while assigned.
- Reassigned away.

Each view retains the main report's Placed/Confirmed/Delivered date basis and
India date range. Search matches order/store/phone/original agent ID/item names;
search is literal, bounded and paged on the server (25 orders, stable ID tie-break).
Changing filters/pages hides obsolete rows while loading; superseded/unmounted
reads are cancelled or ignored. Read failures offer a retry.

Each order shows its ID, store, original sales agent, saved delivery-address and
contact snapshot, order items and quantities with existing unit formatting,
delivery/assignment dates in India time, current linked partner, reported failure
count and recorded assignment history (previous/new partner, actor, mode and time).
For delivered orders, a retained DELIVERED event supplies the handover partner;
older orders fall back to the current order record and explicitly label that
source. The view does not claim unrecorded historic handover evidence exists.

The existing Delivery trail can be opened and closed without losing the partner
view's search/filter position. Eligible active orders link to existing Dispatch,
which retains all server reassignment restrictions. No new mutation workflow was
introduced. Existing colours, cards, typography, tabs and light/dark theme remain;
only missing report controls/details were added. Visual review also corrected a
stretched status chip and reused the existing plural packet formatter.

## API and employee permissions

- `GET /admin/delivery-performance`: original response fields remain; adds phone,
  rejected amount and calculation marker `DELIVERY_RESPONSIBILITY_V2`.
- `GET /admin/delivery-performance/:partnerId/orders`: additive read-only endpoint.
  Supports `dateBasis`, `from`, `to`, `scope`, `q`, `page`; validates IDs, dates,
  scalar filters, bounds and known scopes; returns 400/404 for invalid/missing
  partners. Responses have `Cache-Control: no-store`.
- Both reads require ADMIN or EMPLOYEE with **View Delivery Partners**
  (`canGetAllDeliveryPartners`). The authentication middleware reloads current
  employee permissions; revoking that permission blocks subsequent API requests.
- Delivery trail retains its existing **Assign Delivery OR View All Orders**
  permission. Merely viewing partner reports does not grant the trail or dispatch.
- Open dispatch is shown only for Admin or **Assign Delivery** employees, and only
  for eligible statuses. Actual changes still use the existing guarded endpoints.
- Approvals/rejections remain in Partner Approval under existing Manage Delivery
  Partners permission. Mapping/test-partner cleanup remain Admin-controlled.

The new order DTO explicitly projects/maps permitted fields. It does not return
store verification codes, order OTPs, price fields, identity documents, bank data
or raw GPS validation internals. Search strings are escaped regular expressions.
Frontend visibility is a convenience; backend guards remain authoritative.

## Validation and limits

- Full isolated backend suite: **89/89 pass**. Includes real in-memory MongoDB
  aggregation tests for prior/current partners, duplicates, collector-only
  receipts, pending/approved/rejected amounts, failure counts, date boundaries,
  stable paging, literal bracket search, handover source and employee revocation.
  Agent and delivery-partner tokens are refused; verification secrets/prices are
  absent from the response.
- Admin lint, SPA build and **13/13** frontend unit tests pass.
- New browser coverage checks product quantities, preserved date cohorts,
  search/paging, loading/error recovery, Dispatch handoff, trail return state and
  separate employee controls at 390/1440px, with dark-theme inspection.
- Full Admin browser suite: **143/143 pass**, including the seven new delivery-
  performance cases and existing orders, payments, incentives, targets, partner
  cleanup, store reports, session, permission and responsive-navigation cases.
- Offline source inventory: **148** JS/MJS modules, **622** relative imports and
  **173** registered endpoints. Regenerated API reference/source fingerprints.

All browser business requests were intercepted with synthetic records; backend
tests used an isolated replica set without loading production dotenv/server.js.
No live data discrepancy was measured or repaired. No assertion of production
latency or live deployment is made. Existing inconsistent/manual database edits
can leave handover evidence different from the currently linked partner; the UI
shows both sources, while performance counts retain the documented current-
responsibility definition. No historic assignment dates/names are fabricated.

Deploy the backend and Admin build together when authorised; the Orders and items
button requires the new endpoint. No database migration or existing order/payment
rewrite is required for this additive reporting change.
