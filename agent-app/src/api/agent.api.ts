import { api } from "./client";
import { unwrapList, unwrapObject } from "./unwrap";
import type { Agent, AgentDashboardData, LeaderboardEntry } from "@/types/api";

export const agentApi = {
  getProfile: (): Promise<Agent> =>
    api.get("/agent/profile").then((r) => {
      // Profile is critical, foundational data used across the whole app —
      // if the shape doesn't match what's expected, treat it as a real
      // error (so screens show "couldn't load" + retry) rather than
      // silently succeeding with a fake/empty profile.
      const agent = (r.data ?? {}).agent ?? unwrapObject<Agent>(r.data);
      if (!agent) throw new Error("Unexpected response shape from /agent/profile");
      return agent as Agent;
    }),

  getDashboard: (from?: string, to?: string): Promise<AgentDashboardData> =>
    api.get("/agent/dashboard", { params: { from, to } }).then((r) => {
      const data = unwrapObject<AgentDashboardData>(r.data);
      // Dashboard is a summary view — degrade gracefully to a zeroed
      // shape instead of crashing the whole query if something's off.
      return (
        data ?? {
          summary: {
            totalStoresCreated: 0,
            totalCollected: 0,
            totalIncentive: 0,
            targetAchievedCount: 0,
            totalSalesAmount: 0,
            totalDue: 0,
            totalOrdersDelivered: 0,
            totalCancelled: 0,
            totalReturns: 0,
          },
          monthly: [],
        }
      );
    }),

  getLeaderboard: (from?: string, to?: string, limit = 10): Promise<LeaderboardEntry[]> =>
    api.get("/agent/leaderboard", { params: { from, to, limit } }).then((r) => unwrapList<LeaderboardEntry>(r.data)),
};
