import { useQuery } from "@tanstack/react-query";
import { targetApi } from "@/api/target.api";

export function useTodayTargets() {
  return useQuery({
    queryKey: ["targets", "today"],
    queryFn: targetApi.getTodayTargets,
  });
}
