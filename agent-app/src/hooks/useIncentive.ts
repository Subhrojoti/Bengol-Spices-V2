import { useIsFocused } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { incentiveApi } from "@/api/incentive.api";

export function useIncentiveSummary() {
  const focused = useIsFocused();
  return useQuery({
    queryKey: ["wallet", "summary"],
    enabled: focused,
    queryFn: incentiveApi.getSummary,
  });
}

export function useIncentiveHistory() {
  const focused = useIsFocused();
  return useQuery({
    queryKey: ["wallet", "history"],
    enabled: focused,
    queryFn: incentiveApi.getHistory,
  });
}
