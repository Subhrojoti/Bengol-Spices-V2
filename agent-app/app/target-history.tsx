import { useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CircleCheck, Gift, History } from "lucide-react-native";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card } from "@/components/ui/Card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useSalesTargetHistory } from "@/hooks/useSalesTarget";
import { formatCurrency } from "@/utils/currency";
import { formatDate } from "@/utils/date";
import { getErrorMessage } from "@/api/client";
import { colors } from "@/theme/colors";
import type { SalesTargetHistoryRow } from "@/types/api";

const rupees = (value: number | null | undefined) => formatCurrency(Math.round(value ?? 0));

const styles = StyleSheet.create({
  done: { borderColor: colors.cardamom[600] },
});

const STATUS: Record<SalesTargetHistoryRow["status"], { label: string; box: string; text: string }> = {
  ACHIEVED: { label: "Achieved", box: "bg-cardamom-100", text: "text-cardamom-700" },
  IN_PROGRESS: { label: "In progress", box: "bg-saffron-50", text: "text-saffron-700" },
  NOT_ACHIEVED: { label: "Not achieved", box: "bg-chili-100", text: "text-chili-700" },
  NO_TARGET: { label: "No target", box: "bg-cream-100", text: "text-ink-500" },
};

/**
 * Every month's mandatory target and what came of it: the amount, what was
 * sold, whether it was achieved and when, and any additional incentive
 * earned. A month that is over stays as it ended, whatever the target is
 * changed to afterwards.
 */
export default function TargetHistoryScreen() {
  const { data, isLoading, isError, refetch, error } = useSalesTargetHistory();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <AppHeader title="Target History" showBack />

      {isLoading ? (
        <LoadingState message="Loading your history…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load your target history.")} onRetry={refetch} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.month}
          contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 32, gap: 12, flexGrow: 1 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListHeaderComponent={
            data && data.length > 0 ? <Text className="font-sans text-xs text-ink-500">Your mandatory sales target month by month, measured on the payments you collected on each month's own orders, with the incentives you earned. Newest first.</Text> : null
          }
          ListEmptyComponent={<EmptyState icon={<History size={22} color={colors.ink[500]} />} title="No history yet" subtitle="Each month's target and what you achieved will be kept here." />}
          renderItem={({ item }) => <MonthCard row={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="font-sans text-xs text-ink-500">{label}</Text>
      <Text className={`${strong ? "font-sans-bold" : "font-sans-semibold"} text-xs text-ink`}>{value}</Text>
    </View>
  );
}

function MonthCard({ row }: { row: SalesTargetHistoryRow }) {
  const status = STATUS[row.status] ?? STATUS.NO_TARGET;
  const achieved = row.status === "ACHIEVED";
  const hasTarget = row.mandatoryTarget > 0;
  const earned = row.incentiveStatus === "EARNED";

  return (
    <Card style={achieved ? styles.done : undefined}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="font-display-bold text-base text-ink">{row.monthLabel}</Text>
          <Text className="mt-0.5 font-sans text-xs text-ink-500">{row.closed ? "Completed month" : "This month, still running"}</Text>
        </View>
        <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${status.box}`}>
          {achieved ? <CircleCheck size={12} color={colors.cardamom[700]} /> : null}
          <Text className={`font-sans-bold text-[11px] ${status.text}`}>{status.label}</Text>
        </View>
      </View>

      {hasTarget ? (
        <>
          <View className="mt-3 flex-row items-end justify-between">
            <Text className="font-sans-semibold text-xs text-ink-700">
              {rupees(row.sales)} of {rupees(row.mandatoryTarget)}
            </Text>
            <Text className={`font-display-black text-xl ${achieved ? "text-cardamom-700" : "text-ink"}`}>{row.percent}%</Text>
          </View>
          <View className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sand" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: row.percent }}>
            <View className={`h-full rounded-full ${achieved ? "bg-cardamom-600" : "bg-saffron-600"}`} style={{ width: `${Math.min(100, row.percent)}%` }} />
          </View>
        </>
      ) : null}

      <View className="mt-3 border-t border-sand pt-2">
        <Line label="Mandatory target" value={hasTarget ? rupees(row.mandatoryTarget) : "None set"} />
        <Line label="Collected sales" value={`${rupees(row.sales)} · ${row.payments ?? 0} ${row.payments === 1 ? "payment" : "payments"}`} strong />
        {(row.awaitingVerification ?? 0) > 0 ? <Line label="Cash awaiting verification" value={`${rupees(row.awaitingVerification)} · not counted yet`} /> : null}
        {(row.rejected ?? 0) > 0 ? <Line label="Cash not verified" value={rupees(row.rejected)} /> : null}
        {hasTarget ? <Line label="Achievement" value={`${row.percent}%`} /> : null}
        {hasTarget ? <Line label="Completed on" value={row.completedAt ? formatDate(row.completedAt) : "—"} /> : null}
      </View>

      {row.incentiveOffered ? (
        <View className={`mt-2 flex-row items-start gap-2.5 rounded-xl p-3 ${earned ? "bg-cardamom-100" : "bg-cream-100"}`}>
          <Gift size={16} color={earned ? colors.cardamom[700] : colors.ink[500]} />
          <View className="flex-1">
            <Text className={`font-sans-bold text-xs ${earned ? "text-cardamom-700" : "text-ink-700"}`}>
              {earned ? `Incentive earned: ${rupees(row.incentiveEarned)}` : row.incentiveStatus === "LOCKED" ? "Additional incentive not unlocked" : "Additional incentive not earned"}
            </Text>
            <Text className={`mt-0.5 font-sans text-[11px] ${earned ? "text-cardamom-700" : "text-ink-500"}`}>
              {rupees(row.incentiveTarget)} more collected for {rupees(row.incentiveReward)}
              {earned && row.incentiveEarnedAt ? ` · ${formatDate(row.incentiveEarnedAt)}` : ""}
            </Text>
          </View>
        </View>
      ) : null}
    </Card>
  );
}
