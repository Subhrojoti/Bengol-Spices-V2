# Store dues and office receipts — 18 November 2026

## Scope and release state

Requested: a Cash Verification tab listing store balances, with manual recording
and approval when money reaches the company outside an Agent/Delivery collection.
Checked existing Bills, Cash Verification and collection APIs first: balance
reporting and verification existed, but permission-controlled office recording did
not. Added **Cash Verification → Store dues**, retaining the current panel design.

Local implementation only. No production data, employee grants, push or deployment
was performed. Earlier pending Agent/Delivery changes remain preserved. This
feature requires backend and Admin website deployment; it does not require a new
Agent/Delivery mobile binary.

## Operator workflow

1. Open **Cash Verification → Store dues**. Defaults to stores with outstanding
   balances; **All stores** includes clear/no-order stores. Search by store,
   business ID, owner, phone or responsible/creating Agent ID. Archived stores are
   retained because their outstanding money still requires attention.
2. Choose **View orders**, then **Record / review payment** for the order paid.
   The modal shows bill/recorded/verified/pending/rejected/outstanding amounts and
   paged payment history. Already recorded money must be approved, not recorded
   again. Cancelled orders are excluded from active dues and cannot receive a new
   office receipt.
3. Enter a partial or full amount, choose Cash / UPI / Bank transfer, and provide
   a receipt note or transaction reference. The backend records the actual office
   user, original order Agent and server timestamp. No collector, salesperson,
   verification status, gateway confirmation or historical date is accepted from
   the browser.
4. **Record receipt** saves a pending payment and reduces outstanding balances.
   **Approve this receipt** is a separate deliberate action confirming that the
   company received the funds, using the existing conditional approval endpoint.
   Existing pending receipts can also be selected from payment history for
   review/approval, avoiding duplicate office entries. A recorded receipt remains
   visible in **All collectors**, including after the
   store's balance reaches zero. Approval may also be completed later there.

Recorded/verified amounts retain existing meanings. Rejection does not reverse
the recorded receipt/balance; this is the existing reconciliation workflow, not a
refund/reversal feature. Existing eligibility and month/target rules apply;
collection through the office does not transfer sales credit to the office user
or falsely identify an Agent/Delivery Partner as the collector.

## Authorization and accounting

- All four new APIs use `protect` and `checkPermission("canVerifyPayments")`.
  Admin remains authorized. Employee rights are read from the live account on
  every request. Agents, Delivery Partners, unauthenticated users and employees
  without this permission cannot read or mutate the office workflow directly.
- Reused the existing verifier permission because the owner requested Admin and
  permitted payment employees. The permission editor now describes it as
  **Verify Payments & Record Office Receipts**. No default or existing grant was
  modified. Enabling it intentionally permits both office entry and verification.
- `Payment.collectedBy.role` adds ADMIN/EMPLOYEE. Office collector IDs/names are
  derived server-side. The original `Payment.agentId` stays tied to the order.
  Pending and approval steps preserve actor/time in verification history.
- Uses existing store-management locks, order-payment lock, MongoDB transaction,
  unique collector/request-ID index, invoice ledger and approval machinery.
  Simultaneous payments cannot consume the same remaining balance. An invoice
  write failure rolls back receipt/order writes. Ancillary PDF generation failure
  after commit returns a saved-receipt warning rather than suggesting no payment
  was recorded.
- Exact positive amounts with at most two decimals are enforced. Minimum ₹1,
  except clearing a final smaller balance. No overpayment, cancelled-order entry,
  fake Razorpay confirmation or manual Card method. Known unresolved due-payment
  gateway/QR records block office entry until reconciled. Existing store locks
  coordinate with transfer/removal and delivery QR requests.
- Every new receipt requires a retry reference. Same actor/reference/input returns
  the original payment, including after full settlement; changed input conflicts.
  The browser saves actor/order-scoped attempts in tab session storage before
  sending, locks uncertain input and reuses it across reloads. Storage problems
  fail closed. Stored recovery contains receipt input, never authentication tokens.
- Existing invoice number/buyer/item snapshots are retained; payment/balance fields
  and the receipt ledger update. No historical balance backfill, price, stock,
  delivery-code or credit-period change was made.

## Read API and pagination

| Method/path | Purpose |
| --- | --- |
| GET `/admin/store-dues?q=&balance=DUE\|ALL&page=` | Store balances, 25 per page, stable highest-due/business-ID ordering; totals cover all matching stores. |
| GET `/admin/store-dues/stores/:consumerId/orders?page=` | Non-cancelled positive-due orders, 20 per page; pending/rejected verification indicators. |
| GET `/admin/store-dues/orders/:orderId/payments?page=` | Current balances, verification breakdown and paged public receipt history; no gateway secrets or delivery code. |
| POST `/admin/store-dues/orders/:orderId/payments` | Record `{amount, method, note, clientRequestId}` as a pending office receipt. |

Read responses are `Cache-Control: no-store`. Search metacharacters are escaped;
malformed filters/pages are rejected. Store reporting groups Order balances once
instead of joining each payment into the store sum, avoiding duplicated balances.
Existing consumer-ID indexes support store/order lookup. No new index or data
migration is required beyond deploying the new code/schema.

## Validation

- Full offline backend suite: **120/120 pass**, including new authorization,
  literal filters, archived/clear/cancelled scopes, ledger/invoice consistency,
  full-settlement replay, approval, revoked permission, malformed/overpaid input,
  unresolved gateway, shared-lock conflicts, rollback and Agent/office races.
- Focused Admin browser suite: **14/14 pass** (new dues plus existing collector,
  Bills and delivery-code cases). Includes Admin desktop/phone and Employee,
  record-then-approve, disabled invalid amounts, lost-response reload/replay,
  refreshed concurrent approval and unauthorized route protection; all network
  calls use synthetic fixtures.
- Frontend units **13/13**, Admin lint and SPA production build pass. Existing
  large-chunk build advisory remains; no dependency change was made.
- Desktop dark and phone light receipt screenshots inspected: no clipping or
  horizontal page overflow. QA logs under `output/office-dues-*`; browser images
  under `FrontEnd/.admin-audit.local/store-dues-*`, excluded from release files.
- Full Admin/Employee browser regressions: **175/175 pass** (including orders,
  Bills, permissions, incentives, targets, returns, reporting, sessions and photo
  previews). A subsequent small receipt-refresh correction was built/linted and
  covered by the final 14 focused cases above, including the added concurrent
  approval regression.

Backend inventory regenerated offline: **154 modules, 660 relative imports,
191 endpoints**. No configured application server or operational production
script was started for validation.
