import { useQuery } from "@tanstack/react-query";
import { agentApi } from "@/api/agent.api";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: agentApi.getProfile,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => agentApi.getDashboard(),
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => agentApi.getLeaderboard(),
  });
}
