import { useIsFocused } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { agentApi } from "@/api/agent.api";
import type { LeaderboardMetric } from "@/types/api";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: agentApi.getProfile,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDashboard() {
  const focused = useIsFocused();
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: ({ signal }) => agentApi.getDashboard(undefined, undefined, signal),
    enabled: focused,
  });
}

export function useLeaderboard(metric: LeaderboardMetric = "INCENTIVE") {
  const focused = useIsFocused();
  return useQuery({
    queryKey: ["leaderboard", metric],
    queryFn: ({ signal }) => agentApi.getLeaderboard(undefined, undefined, 10, signal, metric),
    enabled: focused,
  });
}
