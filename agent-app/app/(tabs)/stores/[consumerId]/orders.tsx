import { View, Text, Image, FlatList, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ReceiptText, Download, Package } from "lucide-react-native";
import { IconButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useOrdersByStore } from "@/hooks/useOrders";
import { useInvoiceDownload } from "@/hooks/useInvoiceDownload";
import { formatCurrency } from "@/utils/currency";
import { formatDate } from "@/utils/date";
import { getErrorMessage } from "@/api/client";
import { colors } from "@/theme/colors";
import type { Order } from "@/types/api";

const STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "info"> = {
  DELIVERED: "success",
  CANCELLED: "danger",
  PLACED: "info",
  CONFIRMED: "info",
  ASSIGNED: "warning",
  SHIPPED: "warning",
  OUT_FOR_DELIVERY: "warning",
};

export default function StoreOrdersScreen() {
  const { consumerId, storeName } = useLocalSearchParams<{ consumerId: string; storeName: string }>();
  const router = useRouter();
  const { data: orders, isLoading, isError, isFetching, refetch, error } = useOrdersByStore(consumerId);
  const { downloadInvoice, downloading } = useInvoiceDownload();

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2">
        <IconButton onPress={() => router.back()} className="bg-white">
          <ChevronLeft size={22} color={colors.ink.DEFAULT} />
        </IconButton>
        <Text className="ml-2 flex-1 font-display-bold text-xl text-ink" numberOfLines={1}>
          {storeName ?? "Orders"}
        </Text>
      </View>

      {isLoading ? (
        <LoadingState message="Loading orders…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load orders for this store.")} onRetry={refetch} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 10 }}
          refreshing={isFetching}
          onRefresh={refetch}
          ListEmptyComponent={<EmptyState icon={<ReceiptText size={22} color={colors.ink[500]} />} title="No orders yet for this store" />}
          renderItem={({ item }) => <OrderRow order={item} onDownload={() => downloadInvoice(item.orderId)} downloading={downloading} />}
        />
      )}
    </SafeAreaView>
  );
}

function OrderRow({ order, onDownload, downloading }: { order: Order; onDownload: () => void; downloading: boolean }) {
  const router = useRouter();
  const firstProduct = order.products[0];
  const extraCount = order.products.length - 1;

  return (
    <Pressable onPress={() => router.push(`/orders/${order.orderId}`)} className="rounded-2xl border border-sand bg-white p-4 active:opacity-80">
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="font-display-bold text-base text-ink">{order.orderId}</Text>
          <Text className="mt-0.5 font-sans text-xs text-ink-500">{formatDate(order.createdAt)}</Text>
        </View>
        <Badge label={order.status.replace(/_/g, " ")} variant={STATUS_VARIANT[order.status] ?? "info"} />
      </View>

      {firstProduct ? (
        <View className="mt-2 flex-row items-center gap-2.5">
          {firstProduct.image ? (
            <Image source={{ uri: firstProduct.image }} className="h-9 w-9 rounded-lg" />
          ) : (
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-cream-100">
              <Package size={14} color={colors.ink[500]} />
            </View>
          )}
          <Text className="flex-1 font-sans-medium text-sm text-ink-700" numberOfLines={1}>
            {firstProduct.name}
            {extraCount > 0 ? ` +${extraCount} more` : ""}
          </Text>
        </View>
      ) : null}

      <View className="mt-2 flex-row items-center justify-between">
        <Text className="font-sans-bold text-base text-ink">{formatCurrency(order.totalAmount)}</Text>
        <Pressable onPress={onDownload} disabled={downloading} hitSlop={8}>
          <Download size={16} color={colors.ink[500]} />
        </Pressable>
      </View>
    </Pressable>
  );
}
