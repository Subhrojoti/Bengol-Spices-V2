import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { View, Text, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Truck, MapPin, Phone, TriangleAlert, ChevronRight } from "lucide-react-native";
import { AppHeader } from "@/components/ui/AppHeader";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useAssignedOrders } from "@/hooks/useOrders";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { getErrorMessage } from "@/api/client";
import { colors } from "@/theme/colors";
import type { AssignedOrder } from "@/types/api";
import { SafeAreaView } from "react-native-safe-area-context";

const STATUS_ORDER: Record<string, number> = { ASSIGNED: 0, SHIPPED: 1, OUT_FOR_DELIVERY: 2 };

export default function DeliveriesScreen() {
  useRefetchOnFocus(["orders"]);
  const router = useRouter();
  const { data, isLoading, isError, refetch, error } = useAssignedOrders();
  const { pulling, onPull } = usePullToRefresh(refetch);

  const sorted = [...(data ?? [])].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <AppHeader title="Deliveries" />
      <View className="px-5 pb-3"><Pressable accessibilityRole="button" onPress={() => router.push("/delivery-map")} className="flex-row items-center gap-3 rounded-2xl border border-cardamom-100 bg-cardamom-100 p-4 active:opacity-80"><View className="h-10 w-10 items-center justify-center rounded-xl bg-white"><MapPin size={21} color={colors.cardamom[700]} /></View><View className="flex-1"><Text className="font-sans-bold text-sm text-cardamom-700">Map and plan stops</Text><Text className="mt-1 font-sans text-xs text-ink-700">View destinations and arrange your delivery stops</Text></View><ChevronRight size={18} color={colors.cardamom[700]} /></Pressable></View>

      {isLoading ? (
        <LoadingState message="Loading your deliveries…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load your deliveries.")} onRetry={refetch} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 10 }}
          refreshing={pulling}
          onRefresh={onPull}
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
      <View className="flex-row flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
        <View className="max-w-full shrink">
          <Text className="font-sans-bold text-sm text-ink" numberOfLines={2}>
            {order.store?.storeName ?? order.deliveryAddress.storeName}
          </Text>
          <Text className="mt-0.5 font-sans text-xs text-ink-500">{order.orderId}</Text>
        </View>
        <OrderStatusBadge status={order.status} />
      </View>

      <View className="mt-2 flex-row items-center gap-1.5">
        <MapPin size={12} color={colors.ink[500]} />
        <Text className="flex-1 font-sans text-xs text-ink-500" numberOfLines={2}>
          {order.deliveryAddress.street}, {order.deliveryAddress.city}
        </Text>
      </View>
      <View className="mt-1 flex-row items-center gap-1.5">
        <Phone size={12} color={colors.ink[500]} />
        <Text className="font-sans text-xs text-ink-500">{order.deliveryAddress.phone}</Text>
      </View>
      {order.delivery?.couldNotDeliver?.at ? (
        <View className="mt-2 flex-row items-center gap-1.5">
          <TriangleAlert size={12} color={colors.chili[700]} />
          <Text className="flex-1 font-sans-semibold text-xs text-chili-700">Reported as not delivered. Waiting for the office.</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
