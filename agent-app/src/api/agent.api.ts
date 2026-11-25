import { api } from "./client";
import { unwrapList, unwrapObject } from "./unwrap";
import { dashboardData } from "@/utils/dashboardData";
import type { Agent, AgentDashboardData, LeaderboardReport, LeaderboardMetric } from "@/types/api";

export const agentApi = {
  getProfile: (): Promise<Agent> =>
    api.get("/agent/profile").then((r) => {
      // Profile is critical, foundational data used across the whole app —
      // if the shape doesn't match what's expected, treat it as a real
      // error (so screens show "couldn't load" + retry) rather than
      // silently succeeding with a fake/empty profile.
      const agent = (r.data ?? {}).agent ?? unwrapObject<Agent>(r.data);
      if (!agent || typeof agent.name !== "string" || typeof agent.agentId !== "string") throw new Error("Couldn't load your profile. Please try again.");
      return agent as Agent;
    }),

  getDashboard: (from?: string, to?: string, signal?: AbortSignal): Promise<AgentDashboardData> =>
    api.get("/agent/dashboard", { params: { from, to }, signal }).then((r) => {
      const data = unwrapObject<AgentDashboardData>(r.data);
      return dashboardData(data);
    }),

  getLeaderboard: (from?: string, to?: string, limit = 10, signal?: AbortSignal, metric: LeaderboardMetric = "INCENTIVE"): Promise<LeaderboardReport> =>
    api.get("/agent/leaderboard", { params: { from, to, limit, metric, view: "mobile" }, signal }).then((r) => {
      if (metric === "SALES" && r.data?.metric !== metric) throw new Error("Sales ranking needs the latest server update. Please contact the office.");
      return { ...r.data, data: unwrapList(r.data), metric };
    }),
};
