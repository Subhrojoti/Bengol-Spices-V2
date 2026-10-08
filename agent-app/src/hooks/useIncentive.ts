import { useQuery } from "@tanstack/react-query";
import { incentiveApi } from "@/api/incentive.api";

export function useIncentiveSummary() {
  return useQuery({
    queryKey: ["wallet", "summary"],
    queryFn: incentiveApi.getSummary,
  });
}

export function useIncentiveHistory() {
  return useQuery({
    queryKey: ["wallet", "history"],
    queryFn: incentiveApi.getHistory,
  });
}
