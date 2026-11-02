# Employee feature access and stock validation

2 November 2026. Released as application `2c40b98`; see
[verified deployment evidence](../../deploy/releases/2026-11-02-permissions-delivery-codes.md).

## Findings and employee behavior

Existing employee permissions were present, but newer workflows still used
Admin-only route middleware and pathname-based visibility. Employee Orders also
mounted the older store-only component instead of the Admin workspace. These
restrictions prevented full-access staff from using otherwise authorized tools.

The shared UI retains the current Admin layout and business validation. Employee
Orders now supports All orders and By store, filters, detail and export. Confirm,
cancel, due extensions and delivery-code controls remain separately permissioned.
Navigation is recalculated after the profile loads; the backend reads current
employee permissions independently on every request.

| Feature | Employee permission |
| --- | --- |
| Orders workspace/list/detail/export | `canGetAllOrders` |
| Confirm / cancel | `canConfirmOrders` / `canCancelOrders` |
| Agent access, store transfers/archive/removal and test-agent/store cleanup | `canManageAgents` |
| Agent collection performance | `canSeePaymentInfo` |
| Partner approval and guarded test-partner cleanup | `canManageDeliveryPartners` |
| Delivery dispatch, automatic mappings/revoke and geofence settings | `canAssignDelivery` |
| Return dispatch | `canAssignReturn` |
| Partner performance | `canGetAllDeliveryPartners` |
| Product editing and category minimum quantities | `canManageProducts` |
| Refund / manually settle online payment issues | Both `canSeePaymentInfo` and new `canResolvePaymentIssues` |

Other existing dashboard, reporting, Bills, verification, targets, incentives,
notifications, store-review, code-reveal and extension permissions remain.
Employee account creation, deletion, listing and permission administration remain
Admin-only; employees cannot grant themselves or another employee access.

Related fixes:

- Dispatch fetches only permitted order/return queues, with the required partner
  lookup permitted to assignment staff. Read-only partner staff get Performance,
  not mutation tabs that would fail at the API.
- Location-only staff receive a minimal agent dropdown (ID, name, status), not
  identity documents, passwords or account management access.
- Cleanup status/retry and audit reads are scoped by the relevant agent/partner
  management permission. Existing typed confirmation, expiring preview, stale
  state, financial dependency, transactional and media deletion guards remain.
- The refund permission defaults OFF, including for existing employees. Viewing
  payment data alone never authorizes a refund. Admin must explicitly enable it
  for staff who should refund/settle issues. Existing claims and gateway replay
  protections remain; `GatewayPayment.officeActions` records the action, actual
  actor, timestamp and settlement note atomically with the claim before a refund
  is sent. This is additive metadata, with no backfill or new index.
- Already-granted management permissions now include the management operations
  above. Review the intended staff assignments when rolling out; no permissions
  are silently enabled and no production employee record was changed locally.

## Stock findings and backend-only correction

Order persistence already reserved stock transactionally and refused overselling.
However, the ordering catalogue selected all ACTIVE products and omitted stock,
so unavailable products remained selectable until checkout rejected them.

- The store-specific catalogue now includes available stock and returns only
  active products with enough stock for that store category's minimum quantity.
  Existing clients keep the same response shape with an additive stock field.
- The authenticated Agent's general product list excludes zero-stock products.
  Public website browsing and internal product-management stock views remain.
- These ordering catalogue responses send `Cache-Control: no-store`.
- Cash placement validates combined product quantities against current stock
  early and gives a clear out-of-stock/insufficient-quantity response. Existing
  transactional stock reservation remains the final race-safe guard.
- Checkout/QR preflight rechecks available stock before calling the payment
  gateway, with clearer errors. Product IDs are normalized before combining
  duplicate preflight lines, avoiding uppercase-ID lookup mismatches.

No Agent or Delivery mobile/web source was changed. No AAB rebuild is required
for backend enforcement or refreshed catalogue filtering. Existing mobile query
caches/carts can remain stale temporarily (catalogue staleTime is ten minutes);
reopen/reload the catalogue to see the filtered list. A stale cart can still reach
the server, but cannot successfully order unavailable stock.

Preflight intentionally retains legacy amount-only clients that send no cart.
They cannot be checked before payment initiation without changing their request
format; final order creation still checks stock and retains the existing
failed-payment refund/review workflow. Even a validated cart can lose stock to
another order before gateway payment completes, so final validation stays in place.

## Validation

- Final pre-deployment recheck, including the active-code follow-up: 106/106
  backend tests, 168/168 full Admin/Employee browser checks, 13/13 frontend units,
  lint and production SPA build pass. No further code change was needed.
- Complete isolated backend suite: 103/103 pass. New coverage includes delegated
  access/revocation, employee-administration denial, scoped cleanup receipts,
  explicit refund rights/audit/replay, minimal location-agent lookup, catalogue
  filtering, zero-stock Cash/online/QR refusal and two stores competing for the
  last inventory. No real database, email or payment gateway was used.
- Frontend units: 13/13 pass. Admin lint, additional Employee/config/hook lint
  and production SPA build pass.
- Broad Admin/Employee browser run: 161/162 pass. The remaining test expected
  view-only partner staff to enter Partner Approval; it was updated to assert
  the now-correct Performance-only access and absence of mutation controls.
  Final affected browser rerun: 24/24 pass, including that corrected case,
  full-access/restricted employees, all business sections, financial controls,
  invoice downloads, Bills, collector tabs and partner-cleanup safeguards.
- Inspected synthetic Employee Orders screenshots at 390px and 1440px in dark
  theme, including the phone detail dialog after its transition completes. No
  horizontal page overflow, JavaScript errors or unexpected API requests. Existing
  Admin layout retained; screenshots/logs stay in ignored `.admin-audit.local`.
- Offline source inventory refreshed: 152 backend modules, 646 imports,
  182 endpoints. Existing account data, invoices, balances and credit dates were
  not migrated or edited. Backend and website deployment is verified in the
  linked release record.
