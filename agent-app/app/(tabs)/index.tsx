import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import type { LucideIcon } from "lucide-react-native";
import {
  Store,
  Wallet2,
  Target,
  HandCoins,
  Bell,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  PackageCheck,
  CirclePlus,
  Trophy,
  Undo2,
  HelpCircle,
  ChevronRight,
  Sparkles,
  Crown,
} from "lucide-react-native";
import { Screen, ScreenPadding } from "@/components/ui/Screen";
import { IconButton } from "@/components/ui/Button";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { HeroCard, HeroDivider, HeroStat, Eyebrow, SectionHeader, Pill } from "@/components/ui/HeroCard";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { PerformanceLineChart } from "@/components/charts/PerformanceLineChart";
import { StatusDonutChart } from "@/components/charts/StatusDonutChart";
import { useDashboard, useLeaderboard, useProfile } from "@/hooks/useAgent";
import { useNotifications } from "@/hooks/useNotifications";
import { formatCurrency } from "@/utils/currency";
import { colors, gradients } from "@/theme/colors";
import { getErrorMessage } from "@/api/client";
import type { LeaderboardEntry } from "@/types/api";

const styles = StyleSheet.create({
  tileShadow: { shadowColor: colors.maroon[900], shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  chip: { backgroundColor: "rgba(255,255,255,0.14)" },
  track: { backgroundColor: "rgba(255,255,255,0.15)" },
});

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function parseGrowth(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function OverviewScreen() {
  const router = useRouter();
  const { data, isLoading, isError, isFetching, refetch, error } = useDashboard();
  const { data: agent } = useProfile();
  const { data: notifications } = useNotifications();
  const { data: board } = useLeaderboard();
  const firstName = agent?.name?.split(" ")[0];
  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  const summary = data?.summary;
  const totalSales = summary?.totalSalesAmount ?? 0;
  const collectedPct = totalSales > 0 ? Math.min(100, Math.round(((summary?.totalCollected ?? 0) / totalSales) * 100)) : 0;
  // Growth is meaningless (and reported as 100%) when there are no sales at all.
  const growth = totalSales > 0 ? parseGrowth(data?.growth?.salesGrowth) : null;
  const bestMonth =
    data?.monthly.reduce<{ month: string; sales: number } | null>((best, m) => (m.sales > (best?.sales ?? 0) ? m : best), null) ?? null;
  const myRank = board && agent ? board.findIndex((e) => e.agentId === agent.agentId) + 1 : 0;
  const myEntry = board && myRank > 0 ? board[myRank - 1] : undefined;

  return (
    <Screen onRefresh={refetch} refreshing={isFetching && !isLoading}>
      <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
        <View className="flex-1 pr-2">
          <Eyebrow color={colors.saffron[700]}>{greetingForNow()}</Eyebrow>
          <Text className="mt-0.5 font-display-bold text-2xl text-ink" numberOfLines={1}>
            Hi, {firstName ?? "there"} 👋
          </Text>
        </View>

        <Image source={require("../../assets/images/logo.png")} style={{ width: 64, height: 43 }} resizeMode="contain" />

        <View className="ml-3 flex-row items-center gap-2.5">
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
        <LoadingState message="Loading your overview…" />
      ) : isError || !data || !summary ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load your dashboard.")} onRetry={refetch} />
      ) : (
        <ScreenPadding>
          <HeroCard>
            <View pointerEvents="none" className="absolute -bottom-6 -right-4 opacity-[0.08]">
              <TrendingUp size={160} color={colors.saffron[100]} />
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <Sparkles size={12} color={colors.gold.DEFAULT} />
                <Eyebrow light>Total sales · last 30 days</Eyebrow>
              </View>
              {growth != null ? <GrowthChip value={growth} /> : null}
            </View>

            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              className="mt-3 font-display-black text-[40px] text-white"
              style={{ lineHeight: 46 }}
            >
              {formatCurrency(totalSales)}
            </Text>

            <View className="mt-5">
              <View className="flex-row items-center justify-between">
                <Text className="font-sans text-xs text-saffron-100">Collected so far</Text>
                <Text className="font-sans-bold text-xs text-white">{collectedPct}%</Text>
              </View>
              <View className="mt-2 h-2 overflow-hidden rounded-full" style={styles.track}>
                <LinearGradient
                  colors={[colors.saffron[400], colors.gold.DEFAULT]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ width: `${collectedPct}%`, height: "100%", borderRadius: 999 }}
                />
              </View>
            </View>

            <View className="my-5">
              <HeroDivider />
            </View>

            <View className="flex-row items-center">
              <HeroStat icon={HandCoins} label="Collected" value={formatCurrency(summary.totalCollected)} className="pr-4" />
              <HeroDivider vertical />
              <HeroStat icon={Wallet2} label="Due" value={formatCurrency(summary.totalDue)} className="pl-4" />
            </View>
          </HeroCard>

          <View className="mt-4 flex-row gap-2.5">
            <QuickAction icon={CirclePlus} label="Add Store" onPress={() => router.push("/(tabs)/stores/create")} />
            <QuickAction icon={Trophy} label="Leaderboard" onPress={() => router.push("/leaderboard")} />
            <QuickAction icon={Undo2} label="Returns" onPress={() => router.push("/returns")} />
            <QuickAction icon={HelpCircle} label="Help" onPress={() => router.push("/help")} />
          </View>

          <SectionHeader title="Your Overview" subtitle="Last 30 days at a glance" />
          <View className="flex-row gap-3">
            <StatCard
              icon={<Store size={18} color={colors.white} />}
              watermarkIcon={<Store size={64} color={colors.saffron[600]} />}
              label="Stores Created"
              value={String(summary.totalStoresCreated)}
            />
            <StatCard
              icon={<PackageCheck size={18} color={colors.white} />}
              watermarkIcon={<PackageCheck size={64} color={colors.saffron[600]} />}
              label="Orders Delivered"
              value={String(summary.totalOrdersDelivered)}
            />
          </View>
          <View className="mt-3 flex-row gap-3">
            <StatCard
              icon={<HandCoins size={18} color={colors.white} />}
              watermarkIcon={<Wallet2 size={64} color={colors.saffron[600]} />}
              label="Incentive Earned"
              value={formatCurrency(summary.totalIncentive)}
              valueClassName="text-cardamom-700"
            />
            <StatCard
              icon={<Target size={18} color={colors.white} />}
              watermarkIcon={<Target size={64} color={colors.saffron[600]} />}
              label="Targets Achieved"
              value={String(summary.targetAchievedCount)}
            />
          </View>

          {board && board.length > 0 ? (
            <StandingCard rank={myRank} entry={myEntry} total={board.length} onPress={() => router.push("/leaderboard")} />
          ) : null}

          <SectionHeader
            title="Monthly Performance"
            subtitle="Sales trend"
            right={bestMonth && bestMonth.sales > 0 ? <Pill tone="gold" label={`Best: ${bestMonth.month}`} /> : undefined}
          />
          <Card>
            <PerformanceLineChart data={data.monthly.map((m) => ({ month: m.month, sales: m.sales }))} />
          </Card>

          <SectionHeader title="Sales Status" subtitle="Delivered, cancelled and returned" />
          <Card className="relative mb-4 overflow-hidden">
            <View className="absolute -bottom-6 -right-6 opacity-[0.05]" pointerEvents="none">
              <ShoppingBag size={140} color={colors.maroon[900]} />
            </View>
            <StatusDonutChart delivered={summary.totalOrdersDelivered} cancelled={summary.totalCancelled} returns={summary.totalReturns} />
          </Card>
        </ScreenPadding>
      )}
    </Screen>
  );
}

function GrowthChip({ value }: { value: number }) {
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <View className="flex-row items-center gap-1 rounded-full px-2.5 py-1" style={styles.chip}>
      <Icon size={12} color={up ? colors.saffron[400] : colors.chili[100]} />
      <Text className="font-sans-bold text-[11px] text-white">
        {up ? "+" : ""}
        {value.toFixed(1)}%
      </Text>
    </View>
  );
}

function QuickAction({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 items-center rounded-2xl border border-sand bg-white py-3 active:opacity-80" style={styles.tileShadow}>
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-saffron-50">
        <Icon size={18} color={colors.saffron[700]} />
      </View>
      <Text className="mt-2 font-sans-semibold text-[11px] text-ink-700" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function StandingCard({ rank, entry, total, onPress }: { rank: number; entry?: LeaderboardEntry; total: number; onPress: () => void }) {
  const ranked = !!entry && rank > 0;
  const title = ranked ? (rank === 1 ? "You're leading the board" : `You're ranked #${rank} of ${total}`) : "Not on the board yet";
  const subtitle =
    entry && ranked
      ? `${formatCurrency(entry.earnedAmount)} earned · ${entry.ordersDelivered} orders delivered`
      : "Complete targets to earn your place on the leaderboard.";

  return (
    <Card onPress={onPress} className="mt-4 flex-row items-center gap-3">
      {ranked ? (
        <LinearGradient
          colors={gradients.saffronWash}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" }}
        >
          <Text className="font-display-bold text-base text-white">#{rank}</Text>
        </LinearGradient>
      ) : (
        <View className="h-12 w-12 items-center justify-center rounded-full bg-sand">
          <Trophy size={20} color={colors.ink[500]} />
        </View>
      )}
      <View className="flex-1">
        <Text className="font-sans-bold text-sm text-ink">{title}</Text>
        <Text className="mt-0.5 font-sans text-xs text-ink-500" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {ranked && rank === 1 ? <Crown size={18} color={colors.gold.DEFAULT} /> : <ChevronRight size={16} color={colors.ink[500]} />}
    </Card>
  );
}
