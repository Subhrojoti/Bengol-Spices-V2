import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, CircleCheck, Clock, Gift, History, Info, Lock, PackageSearch, PartyPopper, ShieldCheck, Sparkles, TrendingUp, XCircle } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useProfile } from "@/hooks/useAgent";
import { useStartIncentive } from "@/hooks/useSalesTarget";
import { celebrateOnce } from "@/utils/celebrate";
import { formatCurrency } from "@/utils/currency";
import { getErrorMessage } from "@/api/client";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";
import type { SalesTargetRow, SalesTargetView } from "@/types/api";

const rupees = (value: number) => formatCurrency(Math.round(value));

/* Colours that replace the card's own are given as styles: two class names
   for the same property do not reliably win in the order they are written. */
const styles = StyleSheet.create({
  done: { borderColor: colors.cardamom[600] },
  offer: { borderColor: colors.gold.DEFAULT },
  invite: { borderColor: colors.gold.DEFAULT, backgroundColor: colors.gold[100] },
});

const STATUS_LABEL: Record<SalesTargetRow["status"], string> = {
  ACHIEVED: "Achieved",
  IN_PROGRESS: "In progress",
  DAY_OFF: "Day off",
  NO_TARGET: "No target",
  NOT_ACHIEVED: "Not achieved",
};

function Bar({ percent, done, tall = false }: { percent: number; done: boolean; tall?: boolean }) {
  return (
    <View className={`${tall ? "h-3" : "h-2"} overflow-hidden rounded-full bg-sand`} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
      <View className={`h-full rounded-full ${done ? "bg-cardamom-600" : "bg-saffron-600"}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </View>
  );
}

/* One line of the breakdown: Daily, Weekly or Monthly. Target, collected
   and what is left of it, with its percentage and a bar. */
function BreakdownRow({ label, row, note }: { label: string; row: SalesTargetRow; note?: string }) {
  const done = row.status === "ACHIEVED";
  const dayOff = row.status === "DAY_OFF";
  // The month's target was met before this day or week began: nothing is asked
  const met = Boolean(row.targetMet);
  const plain = dayOff || met;

  return (
    <View className="py-2.5">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="w-16 font-sans-bold text-xs text-ink">{label}</Text>
        <Text className="flex-1 font-sans text-xs text-ink-700" numberOfLines={1}>
          {dayOff ? "Day off, no target" : met ? `${rupees(row.achieved)} collected` : `${rupees(row.achieved)} of ${rupees(row.target)}`}
        </Text>
        {plain ? null : <Text className={`font-sans-bold text-xs ${done ? "text-cardamom-700" : "text-ink"}`}>{row.percent}%</Text>}
        <View className={`rounded-full px-2 py-0.5 ${done ? "bg-cardamom-100" : dayOff ? "bg-cream-100" : "bg-saffron-50"}`}>
          <Text className={`font-sans-bold text-[10px] ${done ? "text-cardamom-700" : dayOff ? "text-ink-500" : "text-saffron-700"}`}>{met ? "Month met" : STATUS_LABEL[row.status]}</Text>
        </View>
      </View>
      {plain ? null : (
        <View className="mt-1.5">
          <Bar percent={row.percent} done={done} />
        </View>
      )}
      {plain || done ? null : <Text className="mt-1 font-sans text-[11px] text-ink-500">{rupees(row.remaining)} to go{note ? ` · ${note}` : ""}</Text>}
    </View>
  );
}

/* Cash the agent has taken that is not in the figures above: waiting for
   the office to verify it, or rejected. Tapping it opens the list. */
function CashWaitingNotice({ view, onPress }: { view: SalesTargetView; onPress: () => void }) {
  const waiting = view.verification;
  if (!waiting || !(waiting.pending > 0 || waiting.rejected > 0)) return null;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="mt-3 gap-2 rounded-xl border border-sand bg-cream-100 p-3 active:opacity-80">
      {waiting.pending > 0 ? (
        <View className="flex-row items-start gap-2.5">
          <Clock size={15} color={colors.saffron[700]} />
          <View className="flex-1">
            <Text className="font-sans-bold text-xs text-ink">{rupees(waiting.pending)} in cash awaiting verification</Text>
            <Text className="mt-0.5 font-sans text-[11px] leading-4 text-ink-500">
              {waiting.pendingCount} {waiting.pendingCount === 1 ? "payment" : "payments"}. Not counted above yet: it is added once the office confirms the deposit.
            </Text>
          </View>
          <ChevronRight size={14} color={colors.ink[300]} />
        </View>
      ) : null}
      {waiting.rejected > 0 ? (
        <View className="flex-row items-start gap-2.5">
          <XCircle size={15} color={colors.chili[600]} />
          <View className="flex-1">
            <Text className="font-sans-bold text-xs text-chili-700">{rupees(waiting.rejected)} in cash was not verified</Text>
            <Text className="mt-0.5 font-sans text-[11px] leading-4 text-ink-500">Tap to see why. It does not count until it is settled with the office.</Text>
          </View>
          {waiting.pending > 0 ? null : <ChevronRight size={14} color={colors.ink[300]} />}
        </View>
      ) : null}
    </Pressable>
  );
}

/* Money collected this month on orders from earlier months. It is real and
   the office has it, but a month's target counts only that month's own
   orders, so it is shown here and is in none of the figures above. */
function EarlierDuesNotice({ view }: { view: SalesTargetView }) {
  const earlier = view.earlierDues;
  if (!earlier || !(earlier.collected > 0)) return null;

  return (
    <View className="mt-3 flex-row items-start gap-2.5 rounded-xl border border-sand bg-cream-100 p-3">
      <Info size={15} color={colors.ink[500]} />
      <View className="flex-1">
        <Text className="font-sans-bold text-xs text-ink">{rupees(earlier.collected)} collected on earlier months' orders</Text>
        <Text className="mt-0.5 font-sans text-[11px] leading-4 text-ink-500">
          {earlier.payments} {earlier.payments === 1 ? "payment" : "payments"}. Not counted above: each month's target counts only orders placed in that month.
        </Text>
      </View>
    </View>
  );
}

function LinkRow({ icon, label, hint, onPress }: { icon: React.ReactNode; label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="flex-1 flex-row items-center gap-2.5 rounded-2xl border border-sand bg-white p-3 active:opacity-80">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-saffron-50">{icon}</View>
      <View className="flex-1">
        <Text className="font-sans-bold text-xs text-ink" numberOfLines={1}>
          {label}
        </Text>
        <Text className="font-sans text-[10px] text-ink-500" numberOfLines={1}>
          {hint}
        </Text>
      </View>
      <ChevronRight size={14} color={colors.ink[300]} />
    </Pressable>
  );
}

/**
 * The top of the Targets tab: the month's mandatory sales target with its
 * daily, weekly and monthly progress, then (once it is achieved) the
 * additional incentive, and the way into history and product-wise sales.
 *
 * `view` is null when there is nothing to show yet: no answer from the
 * server, or one from a server that does not have this feature. The links
 * below still work then.
 */
export function SalesTargetSection({ view }: { view: SalesTargetView | null | undefined }) {
  const router = useRouter();
  const startIncentive = useStartIncentive();
  const { data: agent } = useProfile();
  const agentId = agent?.agentId;

  const month = view?.month;
  const achieved = Boolean(view?.mandatory.isAchieved);
  const earned = Boolean(view?.incentive.isEarned);

  /* Confetti the first time this phone shows the achievement. An agent who
     reached the target while the app was closed (or on another phone) still
     gets their moment, once, when they open this tab. */
  useEffect(() => {
    if (!month || !agentId) return;
    if (earned) celebrateOnce(`${agentId}_${month}_incentive`);
    else if (achieved) celebrateOnce(`${agentId}_${month}_target`);
  }, [month, agentId, achieved, earned]);

  const handleStart = async () => {
    try {
      await startIncentive.mutateAsync();
    } catch (e) {
      toast.error("Couldn't start incentives", getErrorMessage(e));
    }
  };

  const openCash = () => router.push("/cash-payments");

  const links = (
    <View className="gap-2.5">
      <View className="flex-row gap-2.5">
        <LinkRow icon={<PackageSearch size={16} color={colors.saffron[700]} />} label="My sales" hint="Ordered, collected, due" onPress={() => router.push("/sales")} />
        <LinkRow icon={<History size={16} color={colors.saffron[700]} />} label="Target history" hint="Past months" onPress={() => router.push("/target-history")} />
      </View>
      <View className="flex-row">
        <LinkRow icon={<ShieldCheck size={16} color={colors.saffron[700]} />} label="Cash verification" hint="Where each cash payment stands with the office" onPress={openCash} />
      </View>
    </View>
  );

  if (!view || !view.hasTarget) {
    return (
      <View className="gap-3">
        {view ? (
          <Card>
            <Text className="font-display-bold text-base text-ink">Sales target · {view.monthLabel}</Text>
            <Text className="mt-1 font-sans text-xs text-ink-500">No mandatory sales target has been set for you this month.</Text>
            <Text className="mt-2 font-sans-semibold text-xs text-ink-700">
              Collected so far: {rupees(view.sales)} in {view.payments} {view.payments === 1 ? "payment" : "payments"}
            </Text>
            <EarlierDuesNotice view={view} />
            <CashWaitingNotice view={view} onPress={openCash} />
          </Card>
        ) : null}
        {links}
      </View>
    );
  }

  const { mandatory, breakdown, incentive } = view;
  /* The incentive's own card appears once the agent has chosen to go for
     it (or has earned it). Until then they are shown the invitation, even
     if the order that reached the target went a little past it: those extra
     sales already count, and the invitation says so. */
  const showIncentive = incentive.offered && incentive.unlocked && (incentive.started || incentive.isEarned);

  return (
    <View className="gap-3">
      {/* ── the mandatory target ── */}
      <Card style={achieved ? styles.done : undefined}>
        <View className="flex-row items-start gap-3">
          <View className={`h-10 w-10 items-center justify-center rounded-full ${achieved ? "bg-cardamom-100" : "bg-saffron-50"}`}>
            {achieved ? <CircleCheck size={18} color={colors.cardamom[700]} /> : <TrendingUp size={18} color={colors.saffron[600]} />}
          </View>
          <View className="flex-1">
            <Text className="font-display-bold text-base text-ink">Mandatory sales target</Text>
            <Text className="mt-0.5 font-sans text-xs text-ink-500">{view.monthLabel} · counted on payments collected</Text>
          </View>
          <View className="items-end">
            <Text className={`font-display-black text-2xl ${achieved ? "text-cardamom-700" : "text-ink"}`} accessibilityLabel={`${mandatory.percent} percent achieved`}>
              {mandatory.percent}%
            </Text>
            <Text className={`font-sans-semibold text-[10px] ${achieved ? "text-cardamom-700" : "text-ink-500"}`}>{achieved ? "ACHIEVED" : "ACHIEVED SO FAR"}</Text>
          </View>
        </View>

        <View className="mt-3">
          <Bar percent={mandatory.percent} done={achieved} tall />
        </View>

        <View className="mt-3 flex-row gap-2">
          <View className="flex-1 rounded-xl bg-cream-100 px-3 py-2">
            <Text className="font-sans text-[10px] text-ink-500">TARGET</Text>
            <Text className="font-sans-bold text-sm text-ink">{rupees(mandatory.target)}</Text>
          </View>
          <View className="flex-1 rounded-xl bg-cream-100 px-3 py-2">
            <Text className="font-sans text-[10px] text-ink-500">COLLECTED</Text>
            <Text className="font-sans-bold text-sm text-ink">{rupees(mandatory.achieved)}</Text>
          </View>
          <View className="flex-1 rounded-xl bg-cream-100 px-3 py-2">
            <Text className="font-sans text-[10px] text-ink-500">REMAINING</Text>
            <Text className="font-sans-bold text-sm text-ink">{rupees(mandatory.remaining)}</Text>
          </View>
        </View>

        {/* The same target, as it stands for today and for this week */}
        <View className="mt-3 border-t border-sand pt-1">
          {breakdown.daily ? <BreakdownRow label="Daily" row={breakdown.daily} note="fixed for today" /> : null}
          {breakdown.weekly ? <BreakdownRow label="Weekly" row={breakdown.weekly} note="fixed for this week" /> : null}
          <BreakdownRow label="Monthly" row={{ ...mandatory, status: achieved ? "ACHIEVED" : "IN_PROGRESS" }} />
        </View>
        {achieved ? null : (
          <Text className="mt-1 font-sans text-[11px] leading-4 text-ink-500">
            {breakdown.daily?.status === "DAY_OFF" && breakdown.nextWorkingDay
              ? `Your next working day will ask ${rupees(breakdown.dailyTarget)}: `
              : "Today's target is "}
            what is left of your monthly target divided by your {breakdown.workingDaysLeft} working {breakdown.workingDaysLeft === 1 ? "day" : "days"} left. It is set again each morning, so
            what you collect today makes tomorrow lighter. Sales count as payments are collected on this month's orders, not when an order is placed. Dues from earlier months do not
            count. Cash counts once the office has verified it.
          </Text>
        )}

        <EarlierDuesNotice view={view} />
        <CashWaitingNotice view={view} onPress={openCash} />

        {achieved ? (
          <View className="mt-3 flex-row items-start gap-2.5 rounded-xl bg-cardamom-100 p-3">
            <PartyPopper size={18} color={colors.cardamom[700]} />
            <View className="flex-1">
              <Text className="font-sans-bold text-sm text-cardamom-700">Congratulations! You've achieved your mandatory sales target!</Text>
              <Text className="mt-0.5 font-sans text-xs text-cardamom-700">
                {rupees(mandatory.target)} for {view.monthLabel} is complete.
              </Text>
            </View>
          </View>
        ) : incentive.offered ? (
          <View className="mt-3 flex-row items-center gap-2 rounded-xl bg-cream-100 px-3 py-2.5">
            <Lock size={13} color={colors.ink[500]} />
            <Text className="flex-1 font-sans text-xs text-ink-500">An additional incentive unlocks when you achieve this target.</Text>
          </View>
        ) : null}
      </Card>

      {/* ── the invitation, only once the target is achieved ── */}
      {incentive.offered && incentive.unlocked && !showIncentive ? (
        <Card style={styles.invite}>
          <View className="flex-row items-center gap-2.5">
            <Sparkles size={18} color={colors.saffron[700]} />
            <Text className="flex-1 font-display-bold text-base text-ink">Want to earn more?</Text>
          </View>
          <Text className="mt-1.5 font-sans text-xs leading-5 text-ink-700">
            Collect {rupees(incentive.target)} more this month and earn an extra {rupees(incentive.reward)}.
            {incentive.achieved > 0 ? ` You are already ${rupees(Math.min(incentive.achieved, incentive.target))} of the way there.` : ""}
          </Text>
          <Button label="Start making incentives!" icon={<Gift size={16} color={colors.white} />} onPress={handleStart} loading={startIncentive.isPending} fullWidth className="mt-3" />
        </Card>
      ) : null}

      {/* ── the additional incentive ── */}
      {showIncentive ? (
        <Card style={earned ? styles.done : styles.offer}>
          <View className="flex-row items-start gap-3">
            <View className={`h-10 w-10 items-center justify-center rounded-full ${earned ? "bg-cardamom-100" : "bg-gold-100"}`}>
              <Gift size={18} color={earned ? colors.cardamom[700] : colors.saffron[700]} />
            </View>
            <View className="flex-1">
              <Text className="font-display-bold text-base text-ink">Additional incentive</Text>
              <Text className="mt-0.5 font-sans text-xs text-ink-500">
                {rupees(incentive.target)} more collected earns {rupees(incentive.reward)}
              </Text>
            </View>
            <View className="items-end">
              <Text className={`font-display-black text-2xl ${earned ? "text-cardamom-700" : "text-ink"}`} accessibilityLabel={`${incentive.percent} percent of the additional target`}>
                {incentive.percent}%
              </Text>
              <Text className={`font-sans-semibold text-[10px] ${earned ? "text-cardamom-700" : "text-ink-500"}`}>{earned ? "EARNED" : "SO FAR"}</Text>
            </View>
          </View>

          <View className="mt-3">
            <Bar percent={incentive.percent} done={earned} tall />
          </View>

          <View className="mt-2 flex-row items-center justify-between gap-3">
            <Text className="font-sans-semibold text-xs text-ink-700">
              {rupees(Math.min(incentive.achieved, incentive.target))} of {rupees(incentive.target)}
            </Text>
            {earned ? null : <Text className="font-sans text-xs text-ink-500">{rupees(incentive.remaining)} to go</Text>}
          </View>

          {earned ? (
            <View className="mt-3 flex-row items-start gap-2.5 rounded-xl bg-cardamom-100 p-3">
              <PartyPopper size={18} color={colors.cardamom[700]} />
              <View className="flex-1">
                <Text className="font-sans-bold text-sm text-cardamom-700">Congratulations! You've earned {rupees(incentive.amountEarned)}!</Text>
                <Text className="mt-0.5 font-sans text-xs text-cardamom-700">Your additional incentive has been added to your wallet.</Text>
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}

      {links}
    </View>
  );
}
