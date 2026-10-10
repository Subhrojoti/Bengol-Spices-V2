import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { targetApi } from "@/api/target.api";
import { describeTarget } from "@/utils/targets";
import { toast } from "@/utils/toast";

export function useTodayTargets() {
  return useQuery({
    queryKey: ["targets", "today"],
    queryFn: targetApi.getTodayTargets,
  });
}

/**
 * Congratulates the agent the moment a target is reached.
 *
 * Placing an order, registering a store or collecting a payment reloads the
 * targets. A target that was short before the reload and is achieved after
 * it was reached by what the agent just did, wherever in the app they are.
 * Targets already achieved when the app opens are not announced again; the
 * Targets tab shows them as achieved.
 */
export function useTargetCelebration() {
  const { data } = useTodayTargets();
  // target id → was it achieved, as of the previous load
  const before = useRef<Map<string, boolean> | null>(null);

  useEffect(() => {
    if (!data) {
      // Signed out, or another agent signing in: start again
      before.current = null;
      return;
    }

    const now = new Map(data.map(({ target, progress }) => [target._id, describeTarget(target, progress).achieved]));

    if (before.current) {
      const previous = before.current;
      const reached = data.filter(({ target }) => now.get(target._id) && previous.get(target._id) === false).map(({ target }) => target.name);

      // One notice even when a single order finishes several targets: a
      // second notice would replace the first before it could be read
      if (reached.length === 1) {
        toast.success("Congratulations!", `You have successfully achieved your target: ${reached[0]}`);
      } else if (reached.length > 1) {
        toast.success("Congratulations!", `You have successfully achieved ${reached.length} targets: ${reached.join(", ")}`);
      }
    }

    before.current = now;
  }, [data]);
}
