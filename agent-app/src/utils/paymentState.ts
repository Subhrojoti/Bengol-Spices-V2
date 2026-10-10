import type { Order } from "@/types/api";

/* =====================================================================
   WHERE AN ORDER'S PAYMENT STANDS

   An order's paid amount goes up the moment the agent records a payment,
   cash included. But cash is only the agent's word until the office has
   verified it, so "paid" on its own was saying more than anyone knew.

   What was paid is therefore split three ways:

     paid          verified by the office, or never needing it (online, QR)
     awaiting      cash recorded, waiting for the office to verify it
     notVerified   cash the office rejected

   with `outstanding` being what the store still owes on the order. One
   status is picked from those, the one the agent most needs to see first.
   Every screen that names an order's payment status reads it from here, so
   they cannot disagree.
   ===================================================================== */

export type PaymentStateKey = "CASH_NOT_VERIFIED" | "CASH_PENDING" | "PAID" | "PARTIAL" | "UNPAID";

export interface PaymentState {
  key: PaymentStateKey;
  label: string;
  variant: "success" | "danger" | "warning" | "info" | "neutral";
  /** Verified, or paid in a way that needs no verifying. */
  paid: number;
  /** Cash waiting for the office. */
  awaiting: number;
  /** Cash the office rejected, and why (the latest reason). */
  notVerified: number;
  rejectionReason: string | null;
  /** What the store still owes on the order. */
  outstanding: number;
}

const LABELS: Record<PaymentStateKey, { label: string; variant: PaymentState["variant"] }> = {
  CASH_NOT_VERIFIED: { label: "Cash Not Verified", variant: "danger" },
  CASH_PENDING: { label: "Cash Verification Pending", variant: "warning" },
  PAID: { label: "Paid", variant: "success" },
  PARTIAL: { label: "Partially Paid", variant: "info" },
  UNPAID: { label: "Payment Pending", variant: "neutral" },
};

const amount = (value: unknown) => (Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);
const round2 = (value: number) => Math.round(value * 100) / 100;

export function paymentStateOf(order: Pick<Order, "paidAmount" | "dueAmount" | "cashVerification">): PaymentState {
  const recorded = amount(order.paidAmount);
  // Never more than was recorded as paid, whatever a server might send
  const awaiting = Math.min(amount(order.cashVerification?.pending), recorded);
  const notVerified = Math.min(amount(order.cashVerification?.rejected), round2(recorded - awaiting));
  const paid = round2(recorded - awaiting - notVerified);
  const outstanding = amount(order.dueAmount);

  /* A rejection needs the agent to do something, so it comes first; then
     cash still waiting; then how much of the order is paid. */
  const key: PaymentStateKey = notVerified > 0 ? "CASH_NOT_VERIFIED" : awaiting > 0 ? "CASH_PENDING" : outstanding <= 0 ? "PAID" : recorded > 0 ? "PARTIAL" : "UNPAID";

  return { key, ...LABELS[key], paid, awaiting, notVerified, rejectionReason: order.cashVerification?.rejectionReason ?? null, outstanding };
}

/** The filters the order history offers, and whether an order belongs under each. */
export type PaymentFilter = "ALL" | "OUTSTANDING" | "CASH_PENDING" | "PAID";

export function matchesPaymentFilter(state: PaymentState, filter: PaymentFilter): boolean {
  if (filter === "OUTSTANDING") return state.outstanding > 0;
  if (filter === "CASH_PENDING") return state.awaiting > 0 || state.notVerified > 0;
  if (filter === "PAID") return state.key === "PAID";
  return true;
}
