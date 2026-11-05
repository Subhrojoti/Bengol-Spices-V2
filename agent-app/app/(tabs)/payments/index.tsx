import { useMemo, useState } from "react";
import { View, Text, Image, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ReceiptText, Download, ChevronDown, ChevronUp, Store as StoreIcon, Package } from "lucide-react-native";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useDueOrders, useMyOrders } from "@/hooks/useOrders";
import { useMyStores } from "@/hooks/useStores";
import { useInvoiceDownload } from "@/hooks/useInvoiceDownload";
import { formatCurrency } from "@/utils/currency";
import { formatDate, isOverdue } from "@/utils/date";
import { paymentStateOf } from "@/utils/paymentState";
import { sizedImage } from "@/utils/image";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { getErrorMessage } from "@/api/client";
import { colors } from "@/theme/colors";
import type { Order } from "@/types/api";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useVisibleClock } from "@/hooks/useVisibleClock";
import { groupPaymentStores, paymentBuckets, paymentListRows, type PaymentStoreGroup } from "@/utils/paymentList";

type Tab = "DUE" | "OVERDUE" | "COMPLETED";

const EMPTY_COPY: Record<Tab, { title: string; subtitle: string }> = {
  DUE: { title: "No pending dues", subtitle: "Orders with an outstanding balance will show up here." },
  OVERDUE: { title: "Nothing overdue", subtitle: "None of your stores have missed a due date." },
  COMPLETED: { title: "No completed payments yet", subtitle: "Fully paid orders will be listed here." },
};

const EMPTY_ORDERS: Order[] = [];

export default function PaymentsScreen() {
  const [tab, setTab] = useState<Tab>("DUE");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const now = useVisibleClock();
  const dueQuery = useDueOrders();
  const myOrdersQuery = useMyOrders();
  const { data: stores } = useMyStores();
  const { downloadInvoice, downloading } = useInvoiceDownload();
  // Dues and payments change while the agent is elsewhere in the app
  useRefetchOnFocus(["orders"]);
  const { pulling, onPull } = usePullToRefresh(dueQuery.refetch, myOrdersQuery.refetch);

  const imagesByConsumerId = useMemo(() => {
    const map = new Map<string, string>();
    stores?.forEach((s) => {
      if (s.image?.url) map.set(s.consumerId, s.image.url);
    });
    return map;
  }, [stores]);

  const { due, overdue, completed } = useMemo(() => paymentBuckets(dueQuery.data ?? EMPTY_ORDERS, myOrdersQuery.data ?? EMPTY_ORDERS, now), [dueQuery.data, myOrdersQuery.data, now]);

  const isLoading = tab === "COMPLETED" ? myOrdersQuery.isLoading : dueQuery.isLoading;
  const isError = tab === "COMPLETED" ? myOrdersQuery.isError : dueQuery.isError;
  const error = tab === "COMPLETED" ? myOrdersQuery.error : dueQuery.error;
  const refetch = tab === "COMPLETED" ? myOrdersQuery.refetch : dueQuery.refetch;

  const list = tab === "DUE" ? due : tab === "OVERDUE" ? overdue : completed;
  const groups = useMemo(() => groupPaymentStores(list, imagesByConsumerId), [list, imagesByConsumerId]);
  const rows = useMemo(() => paymentListRows(groups, expanded), [groups, expanded]);

  const toggleGroup = (consumerId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(consumerId)) next.delete(consumerId);
      else next.add(consumerId);
      return next;
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="px-5 pb-1 pt-2">
        <Text className="font-display-bold text-2xl text-ink">Payments</Text>
      </View>
      <View className="px-5 pb-3 pt-2">
        <SegmentedControl<Tab>
          segments={[
            { value: "DUE", label: "Due", count: due.length },
            { value: "OVERDUE", label: "Overdue", count: overdue.length },
            { value: "COMPLETED", label: "Completed", count: completed.length },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {isLoading ? (
        <LoadingState message="Loading payments…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load payments.")} onRetry={refetch} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ padding: 20, paddingTop: 0 }}
          refreshing={pulling}
          onRefresh={onPull}
          initialNumToRender={8}
          windowSize={7}
          ListEmptyComponent={
            <EmptyState icon={<ReceiptText size={22} color={colors.ink[500]} />} title={EMPTY_COPY[tab].title} subtitle={EMPTY_COPY[tab].subtitle} />
          }
          renderItem={({ item }) => item.kind === "store" ? (
            <StoreGroupCard
              group={item.group}
              isExpanded={item.expanded}
              onToggle={() => toggleGroup(item.group.consumerId)}
            />
          ) : <View className={`overflow-hidden border-x border-sand bg-white ${item.last ? "rounded-b-2xl border-b" : ""}`}>
            <OrderLine order={item.order} last={item.last} onDownload={() => downloadInvoice(item.order.orderId)} downloading={downloading} showDue={tab !== "COMPLETED"} />
          </View>}
        />
      )}
    </SafeAreaView>
  );
}

function StoreGroupCard({
  group,
  isExpanded,
  onToggle,
}: {
  group: PaymentStoreGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const ToggleIcon = isExpanded ? ChevronUp : ChevronDown;
  return (
    <View className={`mt-2.5 overflow-hidden border border-sand bg-white ${isExpanded ? "rounded-t-2xl" : "rounded-2xl"}`}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${group.storeName}, ${group.consumerId}, ${group.orders.length} orders`} accessibilityState={{ expanded: isExpanded }} onPress={onToggle} className="flex-row items-center gap-3 p-4 active:opacity-80">
        {group.imageUrl ? (
          <Image source={{ uri: sizedImage(group.imageUrl, 44) }} className="h-11 w-11 rounded-full border border-sand-dark" />
        ) : (
          <View className="h-11 w-11 items-center justify-center rounded-full bg-saffron-50">
            <StoreIcon size={18} color={colors.saffron[600]} />
          </View>
        )}
        <View className="flex-1">
          <Text className="font-sans-bold text-sm text-ink" numberOfLines={1}>
            {group.storeName} <Text className="font-sans text-xs text-ink-500">· {group.consumerId}</Text>
          </Text>
          <Text className="font-sans text-xs text-ink-500" numberOfLines={1}>
            {group.ownerName ? `Owner: ${group.ownerName} · ` : ""}
            {group.city}
            {group.state ? `, ${group.state}` : ""}
          </Text>
        </View>
        <View className="items-end">
          <Text className="font-sans text-[10px] text-ink-500">Orders</Text>
          <Text className="font-sans-bold text-sm text-ink">{group.orders.length}</Text>
        </View>
        <ToggleIcon size={16} color={colors.ink[500]} style={{ marginLeft: 6 }} />
      </Pressable>

    </View>
  );
}

function OrderLine({ order, onDownload, downloading, showDue, last }: { order: Order; onDownload: () => void; downloading: boolean; showDue: boolean; last: boolean }) {
  const router = useRouter();
  const firstProduct = order.products[0];
  const extraCount = order.products.length - 1;
  // Cash the office has not verified is not "paid" yet, and is said so
  const payment = paymentStateOf(order);

  return (
    <Pressable onPress={() => router.push(`/orders/${order.orderId}`)} className={`flex-row items-center gap-3 p-4 active:opacity-80 ${last ? "" : "border-b border-sand"}`}>
      {firstProduct?.image ? (
        <Image source={{ uri: sizedImage(firstProduct.image, 44) }} className="h-11 w-11 rounded-lg" />
      ) : (
        <View className="h-11 w-11 items-center justify-center rounded-lg bg-cream-100">
          <Package size={16} color={colors.ink[500]} />
        </View>
      )}

      <View className="flex-1 pr-2">
        <Text className="font-sans-bold text-sm text-ink" numberOfLines={1}>
          {order.orderId}
        </Text>
        <Text className="mt-0.5 font-sans text-xs text-ink-500" numberOfLines={1}>
          {firstProduct ? `${firstProduct.name}${extraCount > 0 ? ` +${extraCount} more` : ""}` : formatDate(order.createdAt)}
        </Text>
        {showDue && payment.notVerified > 0 ? (
          <Text className="mt-0.5 font-sans-semibold text-[11px] text-chili-700">{formatCurrency(payment.notVerified)} cash not verified</Text>
        ) : showDue && payment.awaiting > 0 ? (
          <Text className="mt-0.5 font-sans-semibold text-[11px] text-saffron-700">{formatCurrency(payment.awaiting)} cash awaiting verification</Text>
        ) : null}
      </View>

      <View className="items-end gap-1">
        {showDue ? (
          <Badge label={`Due ${formatCurrency(order.dueAmount)}`} variant={isOverdue(order.dueDate) ? "danger" : "warning"} />
        ) : (
          <Badge label={payment.label} variant={payment.variant} />
        )}
        <Text className="font-sans-bold text-sm text-ink">{formatCurrency(order.totalAmount)}</Text>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel={`Download invoice for ${order.orderId}`} onPress={event => { event.stopPropagation(); onDownload(); }} disabled={downloading} hitSlop={8} className="ml-2">
        <Download size={16} color={colors.ink[500]} />
      </Pressable>
    </Pressable>
  );
}
