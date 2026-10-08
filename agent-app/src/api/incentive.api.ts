import { api } from "./client";
import type { IncentiveLedgerEntry } from "@/types/api";

export interface IncentiveSummary {
  totalEarned: number;
  totalCredited: number;
  totalPending: number;
}

export const incentiveApi = {
  getSummary: (): Promise<IncentiveSummary> =>
    api.get("/api/incentives/summary").then((r) => {
      // 🔥 FIX: React Query requires a query function to NEVER resolve to
      // undefined — if the actual response shape doesn't match what was
      // assumed, r.data.data (or similar) can be undefined, and the whole
      // query crashes hard. This defensively checks a couple of plausible
      // shapes and always falls back to a real, zeroed object instead of
      // ever letting undefined escape this function.
      const body = r.data ?? {};
      const payload = body.data ?? body;
      return {
        totalEarned: Number(payload?.totalEarned ?? 0),
        totalCredited: Number(payload?.totalCredited ?? 0),
        // 🔥 FIX: the backend has always named this "pending", so reading only
        // "totalPending" showed ₹0 pending no matter what was owed.
        totalPending: Number(payload?.totalPending ?? payload?.pending ?? 0),
      };
    }),

  getHistory: (): Promise<IncentiveLedgerEntry[]> =>
    api.get("/api/incentives/history").then((r) => {
      const body = r.data ?? {};
      const payload = body.data ?? body;
      return Array.isArray(payload) ? payload : [];
    }),
};
