import { View, Text, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Truck, MapPin, Phone } from "lucide-react-native";
import { AppHeader } from "@/components/ui/AppHeader";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useAssignedOrders } from "@/hooks/useOrders";
import { getErrorMessage } from "@/api/client";
import { colors } from "@/theme/colors";
import type { AssignedOrder } from "@/types/api";
import { SafeAreaView } from "react-native-safe-area-context";

const STATUS_ORDER: Record<string, number> = { ASSIGNED: 0, SHIPPED: 1, OUT_FOR_DELIVERY: 2 };

export default function DeliveriesScreen() {
  const { data, isLoading, isError, isFetching, refetch, error } = useAssignedOrders();

  const sorted = [...(data ?? [])].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <AppHeader title="Deliveries" />

      {isLoading ? (
        <LoadingState message="Loading your deliveries…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load your deliveries.")} onRetry={refetch} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 10 }}
          refreshing={isFetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <EmptyState
              icon={<Truck size={24} color={colors.ink[500]} />}
              title="No deliveries assigned"
              subtitle="New deliveries assigned to you will show up here."
            />
          }
          renderItem={({ item }) => <DeliveryRow order={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function DeliveryRow({ order }: { order: AssignedOrder }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/deliveries/${order.orderId}`)}
      className="rounded-2xl border border-sand bg-white p-4 active:opacity-80"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="font-sans-bold text-sm text-ink" numberOfLines={1}>
            {order.store?.storeName ?? order.deliveryAddress.storeName}
          </Text>
          <Text className="mt-0.5 font-sans text-xs text-ink-500">{order.orderId}</Text>
        </View>
        <OrderStatusBadge status={order.status} />
      </View>

      <View className="mt-2 flex-row items-center gap-1.5">
        <MapPin size={12} color={colors.ink[500]} />
        <Text className="flex-1 font-sans text-xs text-ink-500" numberOfLines={1}>
          {order.deliveryAddress.street}, {order.deliveryAddress.city}
        </Text>
      </View>
      <View className="mt-1 flex-row items-center gap-1.5">
        <Phone size={12} color={colors.ink[500]} />
        <Text className="font-sans text-xs text-ink-500">{order.deliveryAddress.phone}</Text>
      </View>
    </Pressable>
  );
}
