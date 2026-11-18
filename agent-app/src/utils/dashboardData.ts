import type { AgentDashboardData } from "@/types/api";

/** Reject incomplete summaries before they reach chart/native layout code.
 * Never turn an invalid financial response into a successful zero-sales view. */
export function dashboardData(value: unknown): AgentDashboardData {
  const data = value as AgentDashboardData | null;
  const fields = ["totalStoresCreated", "totalCollected", "totalIncentive", "targetAchievedCount",
    "totalSalesAmount", "totalDue", "totalOrdersDelivered", "totalCancelled", "totalReturns"] as const;
  if (!data?.summary || !fields.every(key => Number.isFinite(data.summary[key])) ||
      !Array.isArray(data.monthly) || !data.monthly.every(row => row && typeof row.month === "string" && Number.isFinite(row.sales))) {
    throw new Error("The overview response is incomplete. Please refresh or try again shortly.");
  }
  return data;
}
