# Active-order delivery-code lookup

2 November 2026. Implemented locally; not pushed or deployed.

The existing lookup was Orders > open order > Reveal delivery code, with another
audited reveal in Store Details. The owner requested an easier separate section
for active orders. Added Orders > Delivery codes alongside All orders / By store,
using the existing panel styles and stored store verification codes. No codes
are generated/changed and no delivery, invoice or payment workflow is changed.

## Behavior and access

- Admin and employees with both `canGetAllOrders` and `canViewDeliveryCodes`.
  No new permission flag or implicit grant. Without code rights the view button
  is absent and a direct codes-view URL falls back to the permitted Orders view;
  backend list/reveal routes independently enforce both permissions.
- Active means PLACED, CONFIRMED, ASSIGNED, SHIPPED or OUT_FOR_DELIVERY.
  DELIVERED/CANCELLED orders never appear in this section.
- Search globally by order/store/phone/agent, filter agent/store/active status,
  and browse server pages of 25 orders. Includes older active orders; no default
  date range hides them. View-specific URL filters preserve the other Orders
  view's filters. An order link opens its existing details.
- Each card shows store name/ID, order ID, sales agent and status. Reveal/Hide
  reuses the existing code control. Codes are not fetched with the list, exposed
  in dropdown options or added to exports. The existing per-store/order-detail
  reveal remains available as before, including its established historical scope.
- Refresh, page/filter/view changes clear revealed codes. Focus and existing
  order/delivery live events refresh metadata. Pending reveals are aborted on
  unmount and cannot populate a different filter's rows.
- A reveal rechecks the order's current status. If it completed since the list
  loaded, return 409 without a code and refresh the list automatically. Ordinary
  open-browser metadata can briefly reflect its last read; the reveal check is
  authoritative. A missing order/store returns 404.

## Backend

- GET `/admin/delivery-codes`: bounded metadata using the existing workspace
  filtering/paging service, with a server-controlled active-only condition in
  `$and`. Supplying a terminal status or `activeOnly=false` cannot widen it.
- POST `/admin/delivery-codes/:orderId/reveal`: resolves the store from the order,
  checks active status, then uses the shared audited store-code helper.
- Both responses use `Cache-Control: no-store`. The audit must save before a code
  is returned. Uses `REVEAL_STORE_DELIVERY_CODE`, actual actor/store and an optional
  order ID; never saves the code in audit details. A supplied consumer ID cannot
  redirect the reveal to another store.
- No new collections, indexes, data migration or mobile changes. Offline source
  inventory updated: 152 backend modules, 648 imports, 184 endpoints.

## Validation

- Final pre-deployment recheck: no additional bug found. Full backend 106/106,
  full Admin/Employee browser suite 168/168, frontend units 13/13, Admin/Employee
  lint and production SPA build pass. See the eventual release record in
  `deploy/releases/` for live deployment evidence.
- Full isolated backend suite: 106/106 pass, including active-only pages/filters,
  both-permission checks, revocation, terminal-status recheck and audit-failure
  refusal. Existing store report/reveal behavior also passes.
- Frontend units: 13/13; Admin lint and SPA production build pass.
- Affected browser suite: 26/26 pass. Includes all new lookup tests plus existing
  Orders filters/actions/export/details and Bills/delivery-code permission tests.
  Tests use synthetic intercepted APIs; no production account/data was touched.
- Inspected light-theme Employee phone (390px) and dark-theme Admin desktop
  (1440px) screenshots. No page overflow. Reveal is deliberate, pagination and
  filtering clear codes, inactive orders are excluded, failed reads retry and
  late replies cannot reveal a previous row's code. Screenshots/logs remain in
  ignored `FrontEnd/.admin-audit.local/active-*` files.

This builds on the pending [employee/stock correction](EMPLOYEE_ACCESS_STOCK_FIX_2026-11-02.md).
Deployment must include backend and frontend together. No AAB rebuild is needed.
