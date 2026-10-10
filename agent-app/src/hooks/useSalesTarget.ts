import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { salesTargetApi } from "@/api/salesTarget.api";
import { useProfile } from "@/hooks/useAgent";
import { celebrateOnce } from "@/utils/celebrate";
import { formatCurrency } from "@/utils/currency";
import { toast } from "@/utils/toast";
import type { SalesTargetView } from "@/types/api";

/* Kept under "targets", so placing an order, registering a store or taking a
   payment (which already refresh everything under that name) bring the
   sales target up to date as well. */
const SALES_TARGET_KEY = ["targets", "sales"] as const;

/** This month's mandatory sales target, with its daily and weekly breakdown. */
export function useSalesTarget() {
  return useQuery({
    queryKey: SALES_TARGET_KEY,
    queryFn: salesTargetApi.getMine,
  });
}

export function useSalesTargetHistory() {
  return useQuery({
    queryKey: ["targets", "sales", "history"],
    queryFn: salesTargetApi.getHistory,
  });
}

/** "Start making incentives". The answer is the updated target, shown at once. */
export function useStartIncentive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: salesTargetApi.startIncentive,
    onSuccess: (view) => {
      if (view) queryClient.setQueryData<SalesTargetView | null>(SALES_TARGET_KEY, view);
      queryClient.invalidateQueries({ queryKey: SALES_TARGET_KEY });
    },
  });
}

/* The agent's own cash payments and whether the office has verified each.
   Under "sales", so taking a payment or placing an order refreshes it. */
export function useCashPayments() {
  return useQuery({
    queryKey: ["sales", "cash"],
    queryFn: salesTargetApi.getCashPayments,
  });
}

/** The agent's own sales, product by product, for one month ("2026-10"). */
export function useProductSales(month: string) {
  return useQuery({
    queryKey: ["sales", "products", month],
    queryFn: () => salesTargetApi.getProductSales(month),
  });
}

/**
 * Celebrates the moment the mandatory target is achieved, and the moment
 * the additional incentive is earned: a notice and confetti, wherever in
 * the app the agent is when the order that did it goes through.
 *
 * It compares each load of the target with the one before. An achievement
 * that was already there when the app opened is left to the Targets tab,
 * which celebrates it once the first time it is seen (celebrateOnce).
 */
export function useSalesTargetCelebration() {
  const { data } = useSalesTarget();
  const { data: agent } = useProfile();
  const agentId = agent?.agentId ?? "agent";
  const before = useRef<{ month: string; achieved: boolean; earned: boolean } | null>(null);

  useEffect(() => {
    if (!data) {
      // Signed out, or another agent signing in: start again
      before.current = null;
      return;
    }

    const now = { month: data.month, achieved: data.mandatory.isAchieved, earned: data.incentive.isEarned };
    const previous = before.current;
    before.current = now;

    // Nothing to compare with yet, or the month has turned over
    if (!previous || previous.month !== now.month) return;

    if (now.earned && !previous.earned) {
      toast.success("Congratulations!", `You've earned ${formatCurrency(data.incentive.amountEarned)} for your additional sales.`);
      celebrateOnce(`${agentId}_${data.month}_incentive`);
    } else if (now.achieved && !previous.achieved) {
      toast.success("Congratulations!", "You've achieved your mandatory sales target!");
      celebrateOnce(`${agentId}_${data.month}_target`);
    }
  }, [data, agentId]);
}
