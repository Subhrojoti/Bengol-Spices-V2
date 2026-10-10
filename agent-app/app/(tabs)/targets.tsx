import { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Target as TargetIcon, CircleCheck, Clock3, PartyPopper, Store as StoreIcon, ShoppingCart, Banknote } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Pill, SectionHeader } from "@/components/ui/HeroCard";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { SalesTargetSection } from "@/components/targets/SalesTargetSection";
import { useTodayTargets } from "@/hooks/useTargets";
import { useSalesTarget } from "@/hooks/useSalesTarget";
import { formatCurrency } from "@/utils/currency";
import { TARGET_TYPE_LABEL, describeTarget, periodLabel, timeLeft } from "@/utils/targets";
import { getErrorMessage } from "@/api/client";
import { colors } from "@/theme/colors";
import type { Target, TargetProgress, TargetType } from "@/types/api";

const TYPE_ICON: Record<TargetType, typeof TargetIcon> = {
  STORE_CREATION: StoreIcon,
  ORDER: ShoppingCart,
  PAYMENT: Banknote,
};

// While this tab is open, progress and "time left" are brought up to date this often
const REFRESH_MS = 60 * 1000;

const styles = StyleSheet.create({
  done: { borderColor: colors.cardamom[600] },
});

/**
 * Two kinds of target, kept apart on purpose.
 *
 * At the top, the mandatory monthly SALES target: one amount for the month,
 * shown with its daily and weekly share, and the additional incentive that
 * opens once it is achieved.
 *
 * Below it, the ACTIVITY targets the office sets from time to time (so many
 * stores, orders or collections in a day, a week or a month).
 */
export default function TargetsScreen() {
  const { data, isLoading, isError, refetch, error } = useTodayTargets();
  const sales = useSalesTarget();
  const refetchSales = sales.refetch;
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  /* Progress also moves the moment an order, store or payment is recorded
     from this phone (those reload the targets). This covers the rest: a
     target the office has just set, changed or ended, and the countdown. */
  useFocusEffect(
    useCallback(() => {
      const refresh = () => {
        setNow(Date.now());
        // joins a load already under way rather than starting a second one
        refetch({ cancelRefetch: false });
        refetchSales({ cancelRefetch: false });
      };
      refresh();
      const timer = setInterval(refresh, REFRESH_MS);
      return () => clearInterval(timer);
    }, [refetch, refetchSales]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchSales()]);
      setNow(Date.now());
    } finally {
      setRefreshing(false);
    }
  };

  // Still to do first: what is required, then what closes soonest. Achieved last.
  const targets = useMemo(() => {
    const list = (data ?? []).map((entry) => ({ ...entry, view: describeTarget(entry.target, entry.progress) }));
    const rank = (entry: (typeof list)[number]) => (entry.view.achieved ? 2 : entry.target.isMandatory ? 0 : 1);
    return list.sort((a, b) => rank(a) - rank(b) || new Date(a.target.endDate).getTime() - new Date(b.target.endDate).getTime());
  }, [data]);

  const achievedCount = targets.filter((entry) => entry.view.achieved).length;

  /* The sales target is the top of the list. A server that cannot answer
     for it (an older one, or a passing failure) leaves it out without
     hiding the activity targets below. */
  const header = (
    <View>
      <SalesTargetSection view={sales.data} />
      <SectionHeader
        title="Other targets"
        subtitle="Set by the office for a day, a week or a month"
        right={targets.length > 0 ? <Pill tone="gold" label={`${achievedCount}/${targets.length} achieved`} /> : undefined}
      />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-1 pt-2">
        <Text className="font-display-bold text-2xl text-ink">Targets</Text>
        {sales.data?.hasTarget ? <Pill tone="gold" label={sales.data.monthLabel} /> : null}
      </View>

      {isLoading || sales.isLoading ? (
        <LoadingState message="Loading targets…" />
      ) : isError && !sales.data ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load targets.")} onRetry={onRefresh} />
      ) : (
        <FlatList
          data={targets}
          keyExtractor={(item) => item.target._id}
          contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 32, gap: 12 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <Card>
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-sand">
                  <TargetIcon size={18} color={colors.ink[500]} />
                </View>
                <View className="flex-1">
                  <Text className="font-sans-bold text-sm text-ink">{isError ? "Couldn't load these targets" : "No other targets right now"}</Text>
                  <Text className="mt-0.5 font-sans text-xs text-ink-500">{isError ? "Pull down to try again." : "When the office sets one, it appears here."}</Text>
                </View>
              </View>
            </Card>
          }
          renderItem={({ item }) => <TargetCard target={item.target} progress={item.progress} now={now} />}
        />
      )}
    </SafeAreaView>
  );
}

function Tag({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "required" | "personal" | "reward" }) {
  const box = { neutral: "bg-cream-100", required: "bg-chili-100", personal: "bg-gold-100", reward: "bg-saffron-50" }[tone];
  const text = { neutral: "text-ink-700", required: "text-chili-700", personal: "text-saffron-700", reward: "text-saffron-700" }[tone];
  return (
    <View className={`rounded-full px-2.5 py-1 ${box}`}>
      <Text className={`font-sans-bold text-[11px] ${text}`}>{label}</Text>
    </View>
  );
}

function TargetCard({ target, progress, now }: { target: Target; progress: TargetProgress; now: number }) {
  const { achieved, percent, progressText, remainingText } = describeTarget(target, progress);
  const TypeIcon = TYPE_ICON[target.type] ?? TargetIcon;
  const reward = Number(target.rewardAmount) || 0;
  const closing = timeLeft(target.endDate, now);

  return (
    <Card style={achieved ? styles.done : undefined}>
      <View className="flex-row items-start gap-3">
        <View className={`h-10 w-10 items-center justify-center rounded-full ${achieved ? "bg-cardamom-100" : "bg-saffron-50"}`}>
          {achieved ? <CircleCheck size={18} color={colors.cardamom[700]} /> : <TypeIcon size={18} color={colors.saffron[600]} />}
        </View>

        <View className="flex-1">
          <Text className="font-display-bold text-base text-ink" numberOfLines={2}>
            {target.name}
          </Text>
          <Text className="mt-0.5 font-sans text-xs text-ink-500">
            {TARGET_TYPE_LABEL[target.type] ?? "Target"} · {periodLabel(target)} target
          </Text>
        </View>

        {/* The achievement percentage, the first thing read on the card */}
        <View className="items-end">
          <Text className={`font-display-black text-2xl ${achieved ? "text-cardamom-700" : "text-ink"}`} accessibilityLabel={`${percent} percent achieved`}>
            {percent}%
          </Text>
          <Text className={`font-sans-semibold text-[10px] ${achieved ? "text-cardamom-700" : "text-ink-500"}`}>{achieved ? "ACHIEVED" : "ACHIEVED SO FAR"}</Text>
        </View>
      </View>

      <View className="mt-3 flex-row flex-wrap gap-1.5">
        {target.isMandatory ? <Tag tone="required" label="Mandatory" /> : null}
        {target.isIndividual ? <Tag tone="personal" label="Set for you" /> : null}
        <Tag tone={reward > 0 ? "reward" : "neutral"} label={reward > 0 ? `Reward ${formatCurrency(reward)}` : "No reward"} />
      </View>

      <View className="mt-3 h-2.5 overflow-hidden rounded-full bg-sand" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
        <View className={`h-full rounded-full ${achieved ? "bg-cardamom-600" : "bg-saffron-600"}`} style={{ width: `${percent}%` }} />
      </View>

      <View className="mt-2 flex-row items-center justify-between gap-3">
        <Text className="font-sans-semibold text-xs text-ink-700">{progressText}</Text>
        {remainingText ? <Text className="font-sans text-xs text-ink-500">{remainingText}</Text> : null}
      </View>

      {achieved ? (
        <View className="mt-3 flex-row items-start gap-2.5 rounded-xl bg-cardamom-100 p-3">
          <PartyPopper size={18} color={colors.cardamom[700]} />
          <View className="flex-1">
            <Text className="font-sans-bold text-sm text-cardamom-700">Congratulations! You have successfully achieved your target!</Text>
            {reward > 0 ? (
              <Text className="mt-0.5 font-sans text-xs text-cardamom-700">{formatCurrency(reward)} reward added to your wallet.</Text>
            ) : target.isMandatory ? (
              <Text className="mt-0.5 font-sans text-xs text-cardamom-700">This mandatory target is complete.</Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View className="mt-3 flex-row items-center gap-1.5">
          <Clock3 size={12} color={closing.urgent ? colors.chili[600] : colors.ink[500]} />
          <Text className={`font-sans-medium text-xs ${closing.urgent ? "text-chili-600" : "text-ink-500"}`}>{closing.label}</Text>
        </View>
      )}
    </Card>
  );
}
