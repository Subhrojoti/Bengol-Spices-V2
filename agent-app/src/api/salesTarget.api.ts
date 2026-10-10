import { api } from "./client";
import type { CashPayment, CashPayments, ProductSalesReport, ProductSalesRow, SalesTargetHistoryRow, SalesTargetView } from "@/types/api";

/* The agent's own monthly sales target, its history, and their own
   product-wise sales. Every address here answers for the signed-in agent
   only; there is no way to ask for another agent's. */

// React Query must never be handed `undefined`. A server that answers in an
// unexpected shape gives "nothing set" rather than a crash.
function toView(body: unknown): SalesTargetView | null {
  const data = (body as { data?: SalesTargetView } | null)?.data;
  return data && typeof data === "object" && data.mandatory && data.breakdown && data.incentive ? data : null;
}

const number = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);

function toReport(body: unknown): ProductSalesReport {
  const res = (body ?? {}) as { from?: string; to?: string; data?: { totals?: Partial<ProductSalesReport["totals"]>; products?: Partial<ProductSalesRow>[] } };
  const products = Array.isArray(res.data?.products) ? res.data!.products! : [];

  return {
    from: res.from ?? "",
    to: res.to ?? "",
    totals: {
      orderValue: number(res.data?.totals?.orderValue),
      collected: number(res.data?.totals?.collected),
      outstanding: number(res.data?.totals?.outstanding),
      // A server that does not divide it counts all of it toward the target, as it then does
      towardTarget: number(res.data?.totals?.towardTarget ?? res.data?.totals?.collected),
      earlierDues: number(res.data?.totals?.earlierDues),
      awaitingVerification: number(res.data?.totals?.awaitingVerification),
      quantity: number(res.data?.totals?.quantity),
      orders: number(res.data?.totals?.orders),
      productsSold: number(res.data?.totals?.productsSold),
    },
    products: products.map((p) => ({
      productId: p.productId ?? null,
      name: p.name ?? "Product",
      uom: p.uom ?? "",
      quantity: number(p.quantity),
      orderValue: number(p.orderValue),
      collected: number(p.collected),
      outstanding: number(p.outstanding),
      orders: number(p.orders),
      share: number(p.share),
    })),
  };
}

const STATUSES = ["PENDING", "APPROVED", "REJECTED"];

/* A server without cash verification answers 404, which is an error the
   screen shows. One that answers in an unexpected shape gives an empty
   list rather than a crash. */
function toCashPayments(body: unknown): CashPayments {
  const res = (body ?? {}) as { summary?: Partial<CashPayments["summary"]>; payments?: Partial<CashPayment>[] };
  const part = (value?: { count?: number; amount?: number }) => ({ count: number(value?.count), amount: number(value?.amount) });
  const payments = Array.isArray(res.payments) ? res.payments : [];

  return {
    summary: { pending: part(res.summary?.pending), approved: part(res.summary?.approved), rejected: part(res.summary?.rejected) },
    payments: payments
      .filter((p) => p && typeof p.id === "string" && STATUSES.includes(String(p.status)))
      .map((p) => ({
        id: p.id as string,
        orderId: p.orderId ?? "",
        storeName: p.storeName ?? null,
        amount: number(p.amount),
        method: p.method ?? "CASH",
        collectedAt: p.collectedAt ?? "",
        status: p.status as CashPayment["status"],
        decidedAt: p.decidedAt ?? null,
        reason: p.reason ?? null,
        countsFor: p.countsFor ?? "",
        countsTowardTarget: p.countsTowardTarget !== false,
      })),
  };
}

export const salesTargetApi = {
  /** This month's target with its daily and weekly breakdown, or null when none could be read. */
  getMine: (): Promise<SalesTargetView | null> => api.get("/targets/agent/sales-target").then((r) => toView(r.data)),

  /** Every month on record, newest first. */
  getHistory: (): Promise<SalesTargetHistoryRow[]> =>
    api.get("/targets/agent/sales-target/history").then((r) => {
      const data = (r.data as { data?: unknown } | null)?.data;
      return Array.isArray(data) ? (data as SalesTargetHistoryRow[]) : [];
    }),

  /** "Start making incentives": allowed only once the mandatory target is achieved. */
  startIncentive: (): Promise<SalesTargetView | null> => api.post("/targets/agent/sales-target/incentive/start").then((r) => toView(r.data)),

  /** The agent's own cash payments, newest first, and whether the office has verified each. */
  getCashPayments: (): Promise<CashPayments> => api.get("/agent/cash-payments").then((r) => toCashPayments(r.data)),

  /** The agent's own order value, collected sales and outstanding, product by product, for a month ("2026-10"). */
  getProductSales: (month: string): Promise<ProductSalesReport> => api.get("/agent/sales/products", { params: { month } }).then((r) => toReport(r.data)),
};
