# Item returns and optional order advances

Date: 5 November 2026 (Asia/Calcutta). Local implementation; not deployed.

## Existing features checked

- Agent mobile Order details > Collect payment already accepts an explicitly
  typed partial amount, offers Use full balance, and supports later instalments.
  The backend already prevents overpayment, protects retries and retains office
  verification for offline money. This flow is retained.
- New PLACED orders already offer Edit order, where the Agent may remove products
  or change quantities before office confirmation. Existing payment/invoice
  safety restrictions remain. A pre-delivery edit is not a physical return.
- Previous Return requests meant the entire delivered order and allowed only
  one non-cancelled request. Delivery partners could process an assigned pickup,
  but could not record selected goods taken back at delivery.
- Placement forced a positive advance and the app reset it to the full cart
  total after each cart change. Those restrictions conflicted with this request.

## Owner-approved accounting boundary

The owner chose: **Keep office review; record selected items and quantities first.**
New return records use `accountingPolicy: OFFICE_REVIEW`. Creating a request,
taking goods back, warehouse receipt and completion are physical-goods events.
They do not change an invoice, order total, payment, due balance, inventory or
incentive automatically. No automatic refund, credit-note issuance, collection
write-off or inventory restock is introduced. Existing office financial controls
remain separate. The Returns screen and mobile forms state this explicitly.

Sales eligibility and Dashboard queries exclude these unadjusted item records
from the legacy whole-order-return exclusion. Otherwise completing a two-packet
return would erase the entire collected sale. Existing legacy whole-order and
recorded-refund rules remain. Multiple recorded partial refunds are summed once
per order rather than taking an arbitrary return record. Payments still count
only under their existing verification rules. No existing records are backfilled.

## Agent mobile behavior

- Store > Create order: advance starts at `0`, stays as typed when the cart
  changes, and can be zero, partial or full. Invalid, negative, excessive and
  over-precision text is refused rather than silently clamped.
- Zero uses the ordinary authenticated placement request with CASH and
  `paidAmount: 0`; no gateway is opened even if Online/QR was selected. The
  backend stores an unpaid order and reserves inventory transactionally, without
  creating a zero-value Payment or pending cash-verification entry.
- Positive Cash retains office verification. Positive Online/QR retains gateway
  verification and the existing gateway minimum. Numeric floating-point request
  compatibility is retained; the backend rounds numeric values to paise.
- Delivered Order details > Return Specific Items (or Return More Items) opens a
  product selector with remaining quantities and a reason. Only chosen items are
  submitted. The Agent must currently manage the store, including after transfer.
- A PLACED order continues to use Edit order; confirmed/in-transit orders are not
  silently edited or financially returned by this new flow.
- My Returns and order details show the recorded items and quantities.

## Delivery mobile behavior

- Assigned Order details > Products > Return Specific Items is available only
  while OUT_FOR_DELIVERY. The backend independently verifies the active partner
  and current assignment. Other partners and Agents cannot call this endpoint.
- Only selected items and quantities are recorded, directly as PICKED_UP with
  the current partner, actor, timestamps and a status history. They appear in
  the existing Returns tab for warehouse receipt/completion.
- The remaining delivery uses the existing delivery-code/GPS workflow. A return
  does not mark the order delivered, cancel it, or waive verification. If the
  entire delivery is refused, the existing Could not deliver workflow remains
  available; physical return entry itself does not complete a delivery.
- Partner options, pickup responses and history omit item prices/refund details.

## Backend and Admin

- Existing `POST /returns/:orderId/initiate` accepts optional `items` and
  `requestId`. Old clients sending only a reason still request the full order;
  no web-client request or response contract was removed.
- New `GET /returns/:orderId/options` returns only authorized, returnable goods
  and ordered/remaining quantities. Agent requires a delivered order/current
  store responsibility; partner requires their OUT_FOR_DELIVERY assignment.
- New `POST /returns/delivery/:orderId/initiate` requires selected lines and a
  retry identifier. It starts the existing warehouse return lifecycle at pickup.
- Requests identify original line indices and optional immutable line IDs.
  Server snapshots supply product IDs, names, units, prices and values; supplied
  names/prices are ignored. Duplicate lines, invalid/fractional/excess quantities
  and stale line IDs are refused. Different lines of the same product remain
  individually identifiable.
- All non-cancelled returns reserve their quantities, including completed ones.
  Cancellation releases the reservation. Legacy records without line snapshots
  reserve the entire order, so old full returns cannot be returned again.
- Store-management and return locks serialize quantities, status, reassignment
  and cleanup; a transaction commits the counter, snapshot and pickup. The
  partner cleanup activity guard runs for delivery-time returns.
- A retry with the same order/request reference returns the original record;
  altered payload or actor is refused. A partial unique
  `{orderId, clientRequestId}` index applies only to string references; legacy
  returns have no reference. Normal Mongoose index initialization creates it;
  no destructive migration or data rewrite is required.
- Admin/permitted Employee Returns > expand a return shows selected items,
  quantities, collector, delivery-time source and the office-review boundary
  within the existing card design. Existing permissions remain unchanged.
- Source inventory regenerated: 153 modules, 652 relative imports, 186 endpoints.

## Validation and release

- Full backend suite: **113/113 pass**. Final affected-file run: **86/86**.
  Covers zero/partial advances, subsequent collections, exact item selection,
  concurrent quantity reservation, cancellation, ownership, partner stages,
  replay/payload integrity, legacy full returns, financial/report consistency
  and existing security/invoice/payment/cleanup flows.
- Agent and Delivery TypeScript checks pass; both Android production JavaScript
  exports pass. These are local bundles, not signed app binaries.
- Both mobile offline suites: **15/15 pass**, including the new zero/partial/
  full advance parser checks. Run with Node 22 `--experimental-strip-types`.
- Admin lint and SPA build pass; frontend units **13/13**. Focused browser
  checks **3/3** cover new item details at 390/1440 px and existing refund
  rendering. Desktop dark and phone light screenshots were inspected.
- Android Pixel 6 emulator with Expo Go 56 and the actual updated backend,
  using a disposable replica set and synthetic accounts:
  - Agent selected only the second line, typed quantity 2/reason and created
    an INITIATED return. The saved snapshot matches that line and quantity.
  - Delivery partner selected one packet from the first line during
    OUT_FOR_DELIVERY; it was saved as PICKED_UP under that partner. Both
    original orders kept total 200, recorded 10 and due 190 unchanged.
  - Item selector, selected state and keyboard/submit layout were inspected
    in both app themes. No app runtime errors appeared in the Metro logs.
  - Agent added a product: advance remained 0. Increasing its quantity from
    10 to 11 kept advance 0. Selecting QR still offered placement without
    advance; that action created a PLACED order for 220 with paid 0/due 220,
    no Payment and no gateway call. Existing Edit order remained available.
- Ignored evidence: `output/item-return-*.log`, native screenshots and
  `output/item-return-native-results.json`; Admin screenshots under
  `FrontEnd/.admin-audit.local/item-return-review-*.png`.
- Earlier full runs exposed timing-sensitive test assertions when a response
  arrived before its store lock was released. QA now waits/retries only lock
  admission before checking invoice authorization and the same refund replay;
  the expected 404 and exactly-once refund assertions remain. Final full run
  passes. Runtime lock or invoice authorization logic was not changed for QA.

All API tests use disposable databases and mocked external services; no
production backend/server configuration is loaded. Browser checks use
intercepted synthetic responses. There was no live payment or production
business mutation. Emulator checks do not replace a signed-release smoke check
on a physical device. No new camera/GPS behavior is introduced here.

Deploy the backend and Admin bundle before releasing new Agent and Delivery
builds. Both mobile applications require new binaries to expose their new forms
and change the default advance. Older installed applications remain compatible
but keep their existing screens/defaults. No AAB/APK, cloud build, push or
production deployment is performed by this implementation task.
