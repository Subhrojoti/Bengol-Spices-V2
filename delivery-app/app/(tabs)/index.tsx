import { View, Text, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Package, Undo2, Clock3, Bell } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Screen, ScreenPadding } from "@/components/ui/Screen";
import { IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { DeliveryTrendChart } from "@/components/charts/DeliveryTrendChart";
import { YearlyComparisonChart } from "@/components/charts/YearlyComparisonChart";
import { useDashboard } from "@/hooks/useProfile";
import { useProfile } from "@/hooks/useProfile";
import { useNotifications } from "@/hooks/useNotifications";
import { colors, gradients } from "@/theme/colors";
import { getErrorMessage } from "@/api/client";

export default function DashboardScreen() {
  const router = useRouter();
  const { data, isLoading, isError, isFetching, refetch, error } = useDashboard();
  const { data: partner } = useProfile();
  const { data: notifications } = useNotifications();
  const firstName = partner?.name?.split(" ")[0];
  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <Screen onRefresh={refetch} refreshing={isFetching && !isLoading}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
        <View className="shrink pr-3">
          <Text className="font-display-bold text-2xl text-ink" numberOfLines={1}>
            Hi, {firstName ?? "there"} 👋
          </Text>
          <Text className="font-sans text-xs text-ink-500">Welcome back!</Text>
        </View>

        <Image source={require("../../assets/images/logo.png")} style={{ width: 68, height: 45 }} resizeMode="contain" />

        <View className="flex-row items-center gap-2.5">
          <IconButton onPress={() => router.push("/notifications")} className="bg-white">
            <View className="shrink pr-3">
              <Bell size={19} color={colors.ink[700]} />
              {unreadCount > 0 ? (
                <View className="absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded-full bg-chili-600">
                  <Text className="font-sans-bold text-[9px] text-white">{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              ) : null}
            </View>
          </IconButton>
          <IconButton onPress={() => router.push("/profile")} className="overflow-hidden bg-maroon-700">
            <Text className="font-sans-bold text-xs text-white">
              {partner?.name?.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </Text>
          </IconButton>
        </View>
      </View>

      {isLoading ? (
        <LoadingState message="Loading your dashboard…" />
      ) : isError || !data ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load your dashboard.")} onRetry={refetch} />
      ) : (
        <ScreenPadding>
          <View
            className="rounded-3xl"
            style={{ shadowColor: colors.maroon[900], shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 8 }}
          >
            <LinearGradient
              colors={gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="overflow-hidden rounded-3xl border border-saffron-400/20"
            >
              <LinearGradient
                colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.7, y: 0.9 }}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                pointerEvents="none"
              />

              {/* Top: headline stat + icon badge */}
              <View className="flex-row items-center px-6 pb-5 pt-6">
                <View className="flex-1 pr-4">
                  <Text className="font-sans-semibold text-sm text-saffron-100">Total Delivered</Text>
                  <Text className="mt-2 font-display-black text-5xl text-white">{data.summary.totalDelivered}</Text>
                  <Text className="mt-2 font-sans text-sm text-saffron-100">Deliveries completed</Text>
                </View>

                <View className="self-stretch" style={{ width: 1, backgroundColor: "rgba(227,168,87,0.25)" }} />

                <View className="pl-5">
                  <View className="h-20 w-20 items-center justify-center rounded-full border border-saffron-400/30 bg-white/5">
                    <Package size={30} color={colors.saffron[400]} />
                  </View>
                </View>
              </View>

              {/* Divider */}
              <View className="mx-6" style={{ height: 1, backgroundColor: "rgba(255,255,255,0.12)" }} />

              {/* Bottom: two sub-stats */}
              <View className="flex-row items-center px-6 py-5">
                <View className="flex-1 flex-row items-center gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                    <Package size={18} color={colors.saffron[400]} />
                  </View>
                  <View className="shrink pr-3">
                    <Text className="font-display-bold text-xl text-white">{data.summary.totalReturnsHandled}</Text>
                    <Text className="font-sans text-xs text-saffron-100">Returns Handled</Text>
                  </View>
                </View>

                <View className="self-stretch" style={{ width: 1, backgroundColor: "rgba(255,255,255,0.12)" }} />

                <View className="flex-1 flex-row items-center gap-3 pl-5">
                  <View className="h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                    <Clock3 size={18} color={colors.saffron[400]} />
                  </View>
                  <View className="shrink pr-3">
                    <Text className="font-display-bold text-xl text-white">{data.summary.totalPendingPickups}</Text>
                    <Text className="font-sans text-xs text-saffron-100">Pending Pickups</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>

          <Card className="mt-4">
            <Text className="font-display-bold text-base text-ink">Monthly Deliveries</Text>
            <View className="mt-2">
              <DeliveryTrendChart data={data.monthlyDeliveryDistribution.map((m) => ({ month: m.month, delivered: m.delivered }))} />
            </View>
          </Card>

          <Card className="mb-4 mt-4">
            <Text className="mb-2 font-display-bold text-base text-ink">Yearly Comparison</Text>
            <YearlyComparisonChart data={data.yearlyComparison} />
          </Card>
        </ScreenPadding>
      )}
    </Screen>
  );
}
