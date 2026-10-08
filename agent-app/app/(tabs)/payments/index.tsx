import { useMemo, useState } from "react";
import { View, Text, Image, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ReceiptText, Download, ChevronDown, Store as StoreIcon, Package } from "lucide-react-native";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useDueOrders, useMyOrders } from "@/hooks/useOrders";
import { useMyStores } from "@/hooks/useStores";
import { useInvoiceDownload } from "@/hooks/useInvoiceDownload";
import { formatCurrency } from "@/utils/currency";
import { formatDate, isOverdue } from "@/utils/date";
import { getErrorMessage } from "@/api/client";
import { colors } from "@/theme/colors";
import type { Order } from "@/types/api";

type Tab = "DUE" | "OVERDUE" | "COMPLETED";

const EMPTY_COPY: Record<Tab, { title: string; subtitle: string }> = {
  DUE: { title: "No pending dues", subtitle: "Orders with an outstanding balance will show up here." },
  OVERDUE: { title: "Nothing overdue", subtitle: "None of your stores have missed a due date." },
  COMPLETED: { title: "No completed payments yet", subtitle: "Fully paid orders will be listed here." },
};

interface StoreGroup {
  consumerId: string;
  storeName: string;
  ownerName: string;
  city: string;
  state: string;
  imageUrl?: string;
  orders: Order[];
}

// 🔥 Groups orders by store, matching the organized "each store as its own
// section" layout — deliveryAddress is a real, always-populated field on
// every order (confirmed against the actual schema), so no extra API call
// or cross-referencing against the stores list is needed to get store info.
function groupByStore(orders: Order[], imagesByConsumerId: Map<string, string>): StoreGroup[] {
  const map = new Map<string, StoreGroup>();
  for (const order of orders) {
    const existing = map.get(order.consumerId);
    if (existing) {
      existing.orders.push(order);
    } else {
      map.set(order.consumerId, {
        consumerId: order.consumerId,
        storeName: order.deliveryAddress?.storeName ?? order.consumerId,
        ownerName: order.deliveryAddress?.ownerName ?? "",
        city: order.deliveryAddress?.city ?? "",
        state: order.deliveryAddress?.state ?? "",
        imageUrl: imagesByConsumerId.get(order.consumerId),
        orders: [order],
      });
    }
  }
  return Array.from(map.values());
}

export default function PaymentsScreen() {
  const [tab, setTab] = useState<Tab>("DUE");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const dueQuery = useDueOrders();
  const myOrdersQuery = useMyOrders();
  const { data: stores } = useMyStores();
  const { downloadInvoice, downloading } = useInvoiceDownload();

  const imagesByConsumerId = useMemo(() => {
    const map = new Map<string, string>();
    stores?.forEach((s) => {
      if (s.image?.url) map.set(s.consumerId, s.image.url);
    });
    return map;
  }, [stores]);

  const dueOrders = dueQuery.data ?? [];
  const due = dueOrders.filter((o) => !isOverdue(o.dueDate));
  const overdue = dueOrders.filter((o) => isOverdue(o.dueDate));
  const completed = (myOrdersQuery.data ?? []).filter((o) => o.dueAmount === 0 && o.status !== "CANCELLED");

  const isLoading = tab === "COMPLETED" ? myOrdersQuery.isLoading : dueQuery.isLoading;
  const isError = tab === "COMPLETED" ? myOrdersQuery.isError : dueQuery.isError;
  const error = tab === "COMPLETED" ? myOrdersQuery.error : dueQuery.error;
  const refetch = tab === "COMPLETED" ? myOrdersQuery.refetch : dueQuery.refetch;

  const list = tab === "DUE" ? due : tab === "OVERDUE" ? overdue : completed;
  const groups = useMemo(() => groupByStore(list, imagesByConsumerId), [list, imagesByConsumerId]);

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
          data={groups}
          keyExtractor={(item) => item.consumerId}
          contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 10 }}
          ListEmptyComponent={
            <EmptyState icon={<ReceiptText size={22} color={colors.ink[500]} />} title={EMPTY_COPY[tab].title} subtitle={EMPTY_COPY[tab].subtitle} />
          }
          renderItem={({ item }) => (
            <StoreGroupCard
              group={item}
              isExpanded={expanded.has(item.consumerId)}
              onToggle={() => toggleGroup(item.consumerId)}
              onDownload={(orderId) => downloadInvoice(orderId)}
              downloading={downloading}
              showDue={tab !== "COMPLETED"}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function StoreGroupCard({
  group,
  isExpanded,
  onToggle,
  onDownload,
  downloading,
  showDue,
}: {
  group: StoreGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onDownload: (orderId: string) => void;
  downloading: boolean;
  showDue: boolean;
}) {
  return (
    <View className="overflow-hidden rounded-2xl border border-sand bg-white">
      <Pressable onPress={onToggle} className="flex-row items-center gap-3 p-4 active:opacity-80">
        {group.imageUrl ? (
          <Image source={{ uri: group.imageUrl }} className="h-11 w-11 rounded-full border border-sand-dark" />
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
        <ChevronDown size={16} color={colors.ink[500]} style={{ transform: [{ rotate: isExpanded ? "180deg" : "0deg" }], marginLeft: 6 }} />
      </Pressable>

      {isExpanded ? (
        <View className="border-t border-sand">
          {group.orders.map((order) => (
            <OrderLine key={order._id} order={order} onDownload={() => onDownload(order.orderId)} downloading={downloading} showDue={showDue} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function OrderLine({ order, onDownload, downloading, showDue }: { order: Order; onDownload: () => void; downloading: boolean; showDue: boolean }) {
  const router = useRouter();
  const firstProduct = order.products[0];
  const extraCount = order.products.length - 1;

  return (
    <Pressable onPress={() => router.push(`/orders/${order.orderId}`)} className="flex-row items-center gap-3 border-b border-sand p-4 last:border-b-0 active:opacity-80">
      {firstProduct?.image ? (
        <Image source={{ uri: firstProduct.image }} className="h-11 w-11 rounded-lg" />
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
      </View>

      <View className="items-end gap-1">
        {showDue ? (
          <Badge label={`Due ${formatCurrency(order.dueAmount)}`} variant={isOverdue(order.dueDate) ? "danger" : "warning"} />
        ) : (
          <Badge label="Paid" variant="success" />
        )}
        <Text className="font-sans-bold text-sm text-ink">{formatCurrency(order.totalAmount)}</Text>
      </View>

      <Pressable onPress={onDownload} disabled={downloading} hitSlop={8} className="ml-2">
        <Download size={16} color={colors.ink[500]} />
      </Pressable>
    </Pressable>
  );
}
