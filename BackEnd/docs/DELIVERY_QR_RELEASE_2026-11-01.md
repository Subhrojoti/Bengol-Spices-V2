# Delivery UPI QR collection

1 November 2026. The owner requested adding QR if absent, then pushing and
deploying. Delivery previously offered Cash and manually recorded UPI only;
Agent QR flows were inspected and retained unchanged.

## Behavior

- Delivery order > Collections and payment history > enter a collection amount
  > Collect using UPI QR. Supports partial/full dues of at least INR 1 on current
  assigned, shipped, out-for-delivery or delivered orders. Existing Cash/recorded
  UPI forms, instalments and office verification remain intact.
- Razorpay single-use fixed-amount `upi_qr`, expiring after 20 minutes. Owner,
  order, original sales agent and purpose are server-controlled gateway notes.
- Gateway status alone cannot mark payment received. Verification checks captured
  INR UPI payments and their exact total against the QR's fixed amount. Failed
  attempts on the same QR do not prevent a later captured payment being applied.
- Payment uses existing transactional order locks, invoice/payment updates,
  target/incentive rules, unique gateway claims and refund/office-review handling.
  Actual collector is the delivery partner; sales credit stays with Order.agentId.
  Only this server-verified path opts delivery payments into method RAZORPAY.
  Body flags cannot make manually recorded payments verified.
- Generation is serialized per order and durably records QR_OPEN before exposing
  the image. Repeated creation returns the pending QR. Server and SecureStore
  recovery restore the same attempt; local data is saved before displaying it.
- Recovery metadata includes image URL, expiry and collector. QR_OPEN/QR_CLOSED
  are additional GatewayPayment states; an additive compound index supports
  order/collector/status recovery. Legacy gateway states/Agent APIs remain.
- Hiding does not forget the QR. Offline collection is blocked on that screen
  while a QR/recovery is unresolved. Close unpaid QR checks for received funds;
  paid/racing-close cases must verify, not be silently discarded. Expired unpaid
  QR is marked QR_CLOSED and allows a fresh QR.
- Paid QR cannot currently be applied after reassignment/cancellation/overpayment:
  the existing safe-refusal refund mechanism handles it once. Failed refunds and
  recording failures remain recorded for office review/retry. No new refund
  policy or gateway credentials were introduced.
- Existing store-management locks cover creation/verification. Destructive test
  cleanup preserves delivery gateway traces, including traces linked to an agent.

## New delivery-only endpoints

Under `/delivery-partner/orders/:orderId/payment-qr`:

- POST: create/reuse QR.
- GET: recover the caller's unresolved QR.
- GET `/:qrCodeId`: check gateway status.
- POST `/:qrCodeId/verify`: verify/apply or replay/refund.
- POST `/:qrCodeId/close`: close safely.

All enforce normal delivery-partner authentication. QR reads/closure/verification
require matching server gateway notes; creation additionally requires current
order responsibility and an unpaid eligible order. Recovery is allowed for the
original collector after reassignment so received funds can still be settled.

Provider API checked against [Razorpay's QR SDK documentation](https://github.com/razorpay/razorpay-node/blob/master/documents/qrcode.md).

## Validation and deployment scope

Four focused disposable-database cases pass: scope/reuse/recovery/exactly-once
credit, wrong evidence and manual-verification forgery, one-time refund after
reassignment, and safe close/expiry/cleanup protection. Gateway calls are mocked;
no real payment was taken or settled. Delivery typecheck and 11/11 mobile
regressions pass. A production-API Android Hermes bundle exports successfully to
ignored `output/delivery-qr-2026-11-01`; this is not a signed APK/AAB.
Final complete backend run: 98/98 pass, including the final cleanup/store-lock
guards. Source inventory: 152 backend modules, 644 imports and 182 endpoints.

Final follow-up, 2 November: backend/website deployed and live checks passed.
The owner connected a phone; Expo Go QR display, hide/resume, simulated captured
payment, balance/collector/agent credit and duplicate-verification checks passed
against disposable data. Real banking-app scanning and live settlement remain
untested. VPS deployment does not update installed mobile apps or publish to
Play Store. See [final release evidence](../../deploy/releases/2026-11-02-delivery-qr-bills.md).
