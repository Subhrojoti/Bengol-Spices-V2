import { View, Text, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Trophy, Bell, ArrowUpRight, ArrowDownLeft, Clock, Coins, Sparkles } from "lucide-react-native";
import { IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { HeroCard, HeroDivider, HeroStat, Eyebrow, SectionHeader, Pill } from "@/components/ui/HeroCard";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useIncentiveHistory, useIncentiveSummary } from "@/hooks/useIncentive";
import { useNotifications } from "@/hooks/useNotifications";
import { formatCurrency } from "@/utils/currency";
import { formatDateTime } from "@/utils/date";
import { getErrorMessage } from "@/api/client";
import { colors } from "@/theme/colors";
import type { IncentiveLedgerEntry } from "@/types/api";

export default function WalletScreen() {
  const router = useRouter();
  const summaryQuery = useIncentiveSummary();
  const historyQuery = useIncentiveHistory();
  const { data: notifications } = useNotifications();
  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  const isLoading = summaryQuery.isLoading || historyQuery.isLoading;
  const isError = summaryQuery.isError || historyQuery.isError;
  const walletError = summaryQuery.error ?? historyQuery.error;
  const totals = summaryQuery.data;
  const creditedPct = totals && totals.totalEarned > 0 ? Math.min(100, Math.round((totals.totalCredited / totals.totalEarned) * 100)) : 0;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
        <Text className="font-display-bold text-2xl text-ink">My Wallet</Text>
        <View className="flex-row items-center gap-2.5">
          <IconButton onPress={() => router.push("/leaderboard")} className="bg-white">
            <Trophy size={19} color={colors.gold.DEFAULT} />
          </IconButton>
          <IconButton onPress={() => router.push("/notifications")} className="bg-white">
            <View>
              <Bell size={19} color={colors.ink[700]} />
              {unreadCount > 0 ? (
                <View className="absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded-full bg-chili-600">
                  <Text className="font-sans-bold text-[9px] text-white">{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              ) : null}
            </View>
          </IconButton>
          <ProfileAvatar />
        </View>
      </View>

      {isLoading ? (
        <LoadingState message="Loading wallet…" />
      ) : isError || !summaryQuery.data ? (
        <ErrorState
          message={getErrorMessage(walletError, "Couldn't load your wallet.")}
          onRetry={() => {
            summaryQuery.refetch();
            historyQuery.refetch();
          }}
        />
      ) : (
        <FlatList
          data={historyQuery.data}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 10 }}
          ListHeaderComponent={
            <View className="mb-1">
              <HeroCard>
                <View pointerEvents="none" className="absolute -bottom-6 -right-4 opacity-[0.08]">
                  <Coins size={150} color={colors.saffron[100]} />
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Sparkles size={12} color={colors.gold.DEFAULT} />
                  <Eyebrow light>Total incentives earned</Eyebrow>
                </View>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                  className="mt-3 font-display-black text-[40px] text-white"
                  style={{ lineHeight: 46 }}
                >
                  {formatCurrency(summaryQuery.data.totalEarned)}
                </Text>
                <View className="mt-5">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-sans text-xs text-saffron-100">Credited to you</Text>
                    <Text className="font-sans-bold text-xs text-white">{creditedPct}%</Text>
                  </View>
                  <View className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                    <LinearGradient
                      colors={[colors.saffron[400], colors.gold.DEFAULT]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ width: `${creditedPct}%`, height: "100%", borderRadius: 999 }}
                    />
                  </View>
                </View>
                <View className="my-5">
                  <HeroDivider />
                </View>
                <View className="flex-row items-center">
                  <HeroStat icon={ArrowDownLeft} label="Credited" value={formatCurrency(summaryQuery.data.totalCredited)} className="pr-4" />
                  <HeroDivider vertical />
                  <HeroStat icon={Clock} label="Pending" value={formatCurrency(summaryQuery.data.totalPending)} className="pl-4" />
                </View>
              </HeroCard>
              <SectionHeader title="Activity" subtitle="Incentives and payouts" right={<Pill label={`${historyQuery.data?.length ?? 0} entries`} />} />
            </View>
          }
          ListEmptyComponent={<EmptyState icon={<ArrowUpRight size={22} color={colors.ink[500]} />} title="No wallet activity yet" />}
          renderItem={({ item }) => <LedgerRow entry={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  TARGET: "Target reward",
  ORDER: "Order commission",
  MANUAL: "Manual",
};

function LedgerRow({ entry }: { entry: IncentiveLedgerEntry }) {
  // 🔥 FIX: ledger entries are typed EARNING or PAYOUT with a positive amount.
  // The old check (type "MANUAL" and a negative amount) never matched, so
  // every payout was listed as "+ Incentive Earned".
  const isPayout = entry.type === "PAYOUT";
  return (
    <Card className="flex-row items-center gap-3">
      <View className={`h-10 w-10 items-center justify-center rounded-full ${isPayout ? "bg-chili-100" : "bg-cardamom-100"}`}>
        {isPayout ? <ArrowUpRight size={18} color={colors.chili[600]} /> : <ArrowDownLeft size={18} color={colors.cardamom[600]} />}
      </View>
      <View className="flex-1">
        <Text className="font-sans-bold text-sm text-ink">{isPayout ? "Payout" : "Incentive Earned"}</Text>
        <Text className="font-sans text-xs text-ink-500" numberOfLines={2}>
          {(!isPayout && entry.note) || SOURCE_LABEL[entry.source ?? ""] || entry.type} · {formatDateTime(entry.createdAt)}
        </Text>
      </View>
      <Text className={`font-sans-bold text-sm ${isPayout ? "text-chili-600" : "text-cardamom-700"}`}>
        {isPayout ? "-" : "+"}{formatCurrency(Math.abs(entry.amount))}
      </Text>
    </Card>
  );
}
