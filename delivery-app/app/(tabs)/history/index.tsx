import { useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { History as HistoryIcon, MapPin, CheckCircle2 } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@/components/ui/AppHeader";
import { ScreenPadding } from "@/components/ui/Screen";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { OrderStatusBadge, ReturnStatusBadge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useDeliveryHistory } from "@/hooks/useProfile";
import { formatCurrency } from "@/utils/currency";
import { formatDate } from "@/utils/date";
import { getErrorMessage } from "@/api/client";
import { colors } from "@/theme/colors";
import type { AssignedOrder, AssignedReturn } from "@/types/api";

type Tab = "DELIVERIES" | "RETURNS";

export default function HistoryScreen() {
  const [tab, setTab] = useState<Tab>("DELIVERIES");
  const { data, isLoading, isError, isFetching, refetch, error } = useDeliveryHistory();

  const deliveries = data?.deliveredOrders ?? [];
  const returns = data?.completedReturns ?? [];

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <AppHeader title="History" />
      <ScreenPadding>
        <SegmentedControl
          segments={[
            { value: "DELIVERIES", label: "Deliveries", count: deliveries.length },
            { value: "RETURNS", label: "Returns", count: returns.length },
          ]}
          value={tab}
          onChange={setTab}
        />
      </ScreenPadding>

      <View className="flex-1">
        {isLoading ? (
          <LoadingState message="Loading history…" />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error, "Couldn't load your history.")} onRetry={refetch} />
        ) : tab === "DELIVERIES" ? (
          <FlatList
            data={deliveries}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 10 }}
            refreshing={isFetching}
            onRefresh={refetch}
            ListEmptyComponent={
              <EmptyState icon={<HistoryIcon size={22} color={colors.ink[500]} />} title="No completed deliveries yet" />
            }
            renderItem={({ item }) => <DeliveryHistoryRow order={item} />}
          />
        ) : (
          <FlatList
            data={returns}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 10 }}
            refreshing={isFetching}
            onRefresh={refetch}
            ListEmptyComponent={
              <EmptyState icon={<HistoryIcon size={22} color={colors.ink[500]} />} title="No completed pickups yet" />
            }
            renderItem={({ item }) => <ReturnHistoryRow item={item} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function DeliveryHistoryRow({ order }: { order: AssignedOrder }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/deliveries/${order.orderId}`)}
      className="rounded-2xl border border-sand bg-white p-4 active:opacity-80"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="font-sans-bold text-sm text-ink" numberOfLines={1}>{order.store?.storeName ?? order.deliveryAddress.storeName}</Text>
          <Text className="mt-0.5 font-sans text-xs text-ink-500">{order.orderId} · {formatDate(order.updatedAt)}</Text>
        </View>
        <OrderStatusBadge status={order.status} />
      </View>
      <View className="mt-2 flex-row items-center gap-1.5">
        <MapPin size={12} color={colors.ink[500]} />
        <Text className="flex-1 font-sans text-xs text-ink-500" numberOfLines={1}>
          {order.deliveryAddress.street}, {order.deliveryAddress.city}
        </Text>
      </View>
      <Text className="mt-1.5 font-sans-bold text-sm text-cardamom-700">{formatCurrency(order.totalAmount)}</Text>
    </Pressable>
  );
}

function ReturnHistoryRow({ item }: { item: AssignedReturn }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/returns/${item.returnId}`)}
      className="rounded-2xl border border-sand bg-white p-4 active:opacity-80"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="font-sans-bold text-sm text-ink" numberOfLines={1}>{item.storeDetails?.storeName ?? "Store"}</Text>
          <Text className="mt-0.5 font-sans text-xs text-ink-500">{item.returnId} · Order {item.orderId}</Text>
        </View>
        <ReturnStatusBadge status={item.status} />
      </View>
      <View className="mt-2 flex-row items-center gap-1.5">
        <CheckCircle2 size={12} color={colors.cardamom[600]} />
        <Text className="font-sans text-xs text-ink-500">Refund: {item.refundStatus.status}</Text>
      </View>
    </Pressable>
  );
}
