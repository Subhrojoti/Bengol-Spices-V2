import { View, Text, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Target as TargetIcon, CircleCheck } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/HeroCard";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useTodayTargets } from "@/hooks/useTargets";
import { formatCurrency } from "@/utils/currency";
import { getErrorMessage } from "@/api/client";
import { colors } from "@/theme/colors";
import type { Target, TargetProgress, TargetType } from "@/types/api";

// What achievedValue counts for each target type, so "3 / 10" has a unit.
const TARGET_UNIT: Record<TargetType, string> = {
  STORE_CREATION: "stores",
  ORDER: "units ordered",
  PAYMENT: "payments",
};

export default function TargetsScreen() {
  const { data, isLoading, isError, isFetching, refetch, error } = useTodayTargets();
  const achievedCount =
    data?.filter((t) => t.progress.isCompleted || (t.target.targetValue > 0 && t.progress.achievedValue >= t.target.targetValue)).length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-1 pt-2">
        <Text className="font-display-bold text-2xl text-ink">Targets</Text>
        {data && data.length > 0 ? <Pill tone="gold" label={`${achievedCount}/${data.length} achieved`} /> : null}
      </View>

      {isLoading ? (
        <LoadingState message="Loading targets…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load targets.")} onRetry={refetch} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.target._id}
          contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 12 }}
          refreshing={isFetching}
          onRefresh={refetch}
          ListEmptyComponent={<EmptyState icon={<TargetIcon size={22} color={colors.ink[500]} />} title="No active targets right now" />}
          renderItem={({ item }) => <TargetCard target={item.target} progress={item.progress} />}
        />
      )}
    </SafeAreaView>
  );
}

function TargetCard({ target, progress }: { target: Target; progress: TargetProgress }) {
  // Guard against a zero target so the bar never shows NaN%.
  const pct = target.targetValue > 0 ? Math.min(100, Math.round((progress.achievedValue / target.targetValue) * 100)) : 0;
  const achieved = progress.isCompleted || pct >= 100;
  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 font-display-bold text-base text-ink" numberOfLines={1}>
          {target.name}
        </Text>
        <View className={`flex-row items-center gap-1 rounded-full px-3 py-1 ${achieved ? "bg-cardamom-100" : "bg-saffron-50"}`}>
          {achieved ? <CircleCheck size={12} color={colors.cardamom[700]} /> : null}
          <Text className={`font-sans-bold text-xs ${achieved ? "text-cardamom-700" : "text-saffron-700"}`}>{achieved ? "Achieved" : `${pct}%`}</Text>
        </View>
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="font-sans text-xs text-ink-500">
          {progress.achievedValue} / {target.targetValue} {TARGET_UNIT[target.type] ?? ""}
        </Text>
        <Text className="font-sans-semibold text-xs text-ink-700">Reward: {formatCurrency(target.rewardAmount)}</Text>
      </View>
      <View className="mt-2 h-2 overflow-hidden rounded-full bg-sand">
        <View className={`h-full rounded-full ${achieved ? "bg-cardamom-600" : "bg-saffron-600"}`} style={{ width: `${pct}%` }} />
      </View>
    </Card>
  );
}
