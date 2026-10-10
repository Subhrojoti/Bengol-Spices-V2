import { useMemo, useState } from "react";
import { View, Text, SectionList, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronDown, ChevronLeft, Clock, Download, ReceiptText, Search, XCircle } from "lucide-react-native";
import { IconButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useOrdersByStore } from "@/hooks/useOrders";
import { useInvoiceDownload } from "@/hooks/useInvoiceDownload";
import { formatCurrency } from "@/utils/currency";
import { formatDate } from "@/utils/date";
import { matchesPaymentFilter, paymentStateOf, type PaymentFilter, type PaymentState } from "@/utils/paymentState";
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

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// The month an order was placed in, as in India whatever zone the phone is set to: "2026-10"
const monthKeyOf = (instant: string) => new Date(new Date(instant).getTime() + 330 * 60 * 1000).toISOString().slice(0, 7);
const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;

const FILTERS: { key: PaymentFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "OUTSTANDING", label: "Outstanding" },
  { key: "CASH_PENDING", label: "Cash verification" },
  { key: "PAID", label: "Paid" },
];

interface Row {
  order: Order;
  state: PaymentState;
}

interface Totals {
  orders: number;
  cancelled: number;
  orderValue: number;
  paid: number;
  awaiting: number;
  notVerified: number;
  outstanding: number;
}

/* What a set of orders adds up to. A cancelled order is counted as
   cancelled and left out of the money: nothing is owed on it. */
function totalsOf(rows: Row[]): Totals {
  const totals: Totals = { orders: 0, cancelled: 0, orderValue: 0, paid: 0, awaiting: 0, notVerified: 0, outstanding: 0 };

  for (const { order, state } of rows) {
    if (order.status === "CANCELLED") {
      totals.cancelled += 1;
      continue;
    }
    totals.orders += 1;
    totals.orderValue += order.totalAmount;
    totals.paid += state.paid;
    totals.awaiting += state.awaiting;
    totals.notVerified += state.notVerified;
    totals.outstanding += state.outstanding;
  }

  return totals;
}

interface MonthSection {
  key: string;
  title: string;
  totals: Totals;
  count: number;
  data: Row[];
}

/**
 * One store's orders, month by month with the newest month first. Each
 * month can be opened and closed, and says what was ordered, what has been
 * paid and what is still owed in it. An order shows its own value, paid and
 * outstanding amounts, its delivery status and where its payment stands,
 * with cash that the office has not verified kept apart from what is paid.
 *
 * The search finds an order by its ID, its date or a product in it; the
 * filters narrow the list to what is still owed, what is waiting on cash
 * verification, or what is fully paid.
 */
export default function StoreOrdersScreen() {
  const { consumerId, storeName } = useLocalSearchParams<{ consumerId: string; storeName: string }>();
  const router = useRouter();
  const { data: orders, isLoading, isError, isFetching, refetch, error } = useOrdersByStore(consumerId);
  const { downloadInvoice, downloading } = useInvoiceDownload();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PaymentFilter>("ALL");
  // Months the agent has opened or closed by hand; otherwise only the newest is open
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const rows = useMemo<Row[]>(() => (orders ?? []).map((order) => ({ order, state: paymentStateOf(order) })), [orders]);
  const overall = useMemo(() => totalsOf(rows), [rows]);

  const narrowed = query.trim() !== "" || filter !== "ALL";

  const months = useMemo(() => {
    const q = query.trim().toLowerCase();

    const matching = rows.filter(({ order, state }) => {
      // A cancelled order has no payment to chase: it is listed under All only
      if (filter !== "ALL" && order.status === "CANCELLED") return false;
      if (!matchesPaymentFilter(state, filter)) return false;
      if (!q) return true;
      const key = monthKeyOf(order.createdAt);
      return [order.orderId, formatDate(order.createdAt), monthLabel(key), state.label, order.status.replace(/_/g, " "), ...order.products.map((p) => p.name)].some((text) =>
        text.toLowerCase().includes(q),
      );
    });

    const byMonth = new Map<string, Row[]>();
    for (const row of matching) {
      const key = monthKeyOf(row.order.createdAt);
      byMonth.set(key, [...(byMonth.get(key) ?? []), row]);
    }

    return [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, list]) => ({
        key,
        title: monthLabel(key),
        totals: totalsOf(list),
        count: list.length,
        rows: list.sort((a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime()),
      }));
  }, [rows, query, filter]);

  /* The newest month starts open. While a search or filter is on, every
     month it found is open, so a match is never hidden inside a closed one. */
  const isOpen = (key: string, index: number) => toggled[key] ?? (narrowed || index === 0);

  const sections: MonthSection[] = months.map((month, index) => ({
    key: month.key,
    title: month.title,
    totals: month.totals,
    count: month.count,
    data: isOpen(month.key, index) ? month.rows : [],
  }));

  const toggle = (key: string, index: number) => setToggled((prev) => ({ ...prev, [key]: !isOpen(key, index) }));

  /* A new search or filter forgets which months were opened or closed by
     hand: a month closed earlier must not hide what was just searched for. */
  const search = (text: string) => {
    setQuery(text);
    setToggled({});
  };
  const pick = (next: PaymentFilter) => {
    setFilter(next);
    setToggled({});
  };

  const header = (
    <View className="gap-3 pb-1">
      <View className="rounded-2xl border border-sand bg-white p-4">
        <Text className="font-sans text-xs text-ink-500">
          ALL ORDERS · {overall.orders} {overall.orders === 1 ? "ORDER" : "ORDERS"}
          {overall.cancelled > 0 ? ` · ${overall.cancelled} CANCELLED` : ""}
        </Text>
        <View className="mt-2.5 flex-row gap-2">
          <Figure label="ORDER VALUE" value={formatCurrency(overall.orderValue)} boxed />
          <Figure label="PAID" value={formatCurrency(overall.paid)} tone="text-cardamom-700" boxed />
          <Figure label="OUTSTANDING" value={formatCurrency(overall.outstanding)} tone={overall.outstanding > 0 ? "text-chili-600" : "text-ink"} boxed />
        </View>
        <Unverified awaiting={overall.awaiting} notVerified={overall.notVerified} className="mt-2.5" />
      </View>

      <Input placeholder="Order ID, date or product" value={query} onChangeText={search} autoCapitalize="characters" autoCorrect={false} leftIcon={<Search size={16} color={colors.ink[500]} />} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="tablist">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => pick(f.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              className={`rounded-full border px-3.5 py-1.5 ${active ? "border-saffron-600 bg-saffron-600" : "border-sand bg-white"}`}
            >
              <Text className={`font-sans-semibold text-xs ${active ? "text-white" : "text-ink-700"}`}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2">
        <IconButton onPress={() => router.back()} className="bg-white">
          <ChevronLeft size={22} color={colors.ink.DEFAULT} />
        </IconButton>
        <View className="ml-2 flex-1">
          <Text className="font-display-bold text-xl text-ink" numberOfLines={1}>
            {storeName ?? "Orders"}
          </Text>
          <Text className="font-sans text-xs text-ink-500">Order history</Text>
        </View>
      </View>

      {isLoading ? (
        <LoadingState message="Loading orders…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load orders for this store.")} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<ReceiptText size={22} color={colors.ink[500]} />} title="No orders yet for this store" />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.order._id}
          contentContainerStyle={{ padding: 20, paddingTop: 10, paddingBottom: 32 }}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          refreshing={isFetching}
          onRefresh={refetch}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState icon={<Search size={22} color={colors.ink[500]} />} title="No order matches" subtitle="Try another order ID or date, or clear the filter." />
          }
          renderSectionHeader={({ section }) => {
            const index = sections.findIndex((s) => s.key === section.key);
            const open = isOpen(section.key, index);
            return <MonthHeader section={section} open={open} onPress={() => toggle(section.key, index)} />;
          }}
          renderItem={({ item, index, section }) => (
            <OrderRow row={item} last={index === section.data.length - 1} onDownload={() => downloadInvoice(item.order.orderId)} downloading={downloading} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Figure({ label, value, tone = "text-ink", boxed = false }: { label: string; value: string; tone?: string; boxed?: boolean }) {
  return (
    <View className={`flex-1 ${boxed ? "rounded-xl bg-cream-100 px-3 py-2" : ""}`}>
      <Text className="font-sans text-[10px] text-ink-500">{label}</Text>
      <Text className={`font-sans-bold text-sm ${tone}`} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

/* Cash that is recorded as paid but not yet the company's to count: waiting
   to be verified, or rejected. Nothing is drawn when there is none. */
function Unverified({ awaiting, notVerified, className = "" }: { awaiting: number; notVerified: number; className?: string }) {
  if (!(awaiting > 0 || notVerified > 0)) return null;

  return (
    <View className={`gap-1 ${className}`}>
      {awaiting > 0 ? (
        <View className="flex-row items-center gap-1.5">
          <Clock size={12} color={colors.saffron[700]} />
          <Text className="font-sans-semibold text-[11px] text-saffron-700">{formatCurrency(awaiting)} cash awaiting verification</Text>
        </View>
      ) : null}
      {notVerified > 0 ? (
        <View className="flex-row items-center gap-1.5">
          <XCircle size={12} color={colors.chili[600]} />
          <Text className="font-sans-semibold text-[11px] text-chili-700">{formatCurrency(notVerified)} cash not verified</Text>
        </View>
      ) : null}
    </View>
  );
}

function MonthHeader({ section, open, onPress }: { section: MonthSection; open: boolean; onPress: () => void }) {
  const { totals } = section;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${section.title}, ${totals.orders} ${totals.orders === 1 ? "order" : "orders"}`}
      className={`mt-3 border border-sand bg-white p-4 active:opacity-80 ${open && section.data.length > 0 ? "rounded-t-2xl" : "rounded-2xl"}`}
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="font-display-bold text-base text-ink">{section.title}</Text>
          <Text className="mt-0.5 font-sans text-xs text-ink-500">
            {totals.orders} {totals.orders === 1 ? "order" : "orders"}
            {totals.cancelled > 0 ? ` · ${totals.cancelled} cancelled` : ""}
          </Text>
        </View>
        <ChevronDown size={18} color={colors.ink[500]} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </View>

      <View className="mt-3 flex-row gap-3 border-t border-sand pt-2.5">
        <Figure label="ORDER VALUE" value={formatCurrency(totals.orderValue)} />
        <Figure label="PAID" value={formatCurrency(totals.paid)} tone="text-cardamom-700" />
        <Figure label="OUTSTANDING" value={formatCurrency(totals.outstanding)} tone={totals.outstanding > 0 ? "text-chili-600" : "text-ink-500"} />
      </View>
      <Unverified awaiting={totals.awaiting} notVerified={totals.notVerified} className="mt-2" />
    </Pressable>
  );
}

function OrderRow({ row, last, onDownload, downloading }: { row: Row; last: boolean; onDownload: () => void; downloading: boolean }) {
  const router = useRouter();
  const { order, state } = row;
  const cancelled = order.status === "CANCELLED";
  const first = order.products[0];
  const extra = order.products.length - 1;

  return (
    <Pressable
      onPress={() => router.push(`/orders/${order.orderId}`)}
      className={`border-x border-b border-sand bg-white px-4 py-3.5 active:opacity-80 ${last ? "rounded-b-2xl" : ""}`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-sans-bold text-sm text-ink">{order.orderId}</Text>
          <Text className="mt-0.5 font-sans text-xs text-ink-500" numberOfLines={1}>
            {formatDate(order.createdAt)}
            {first ? ` · ${first.name}${extra > 0 ? ` +${extra} more` : ""}` : ""}
          </Text>
        </View>
        <Badge label={order.status.replace(/_/g, " ")} variant={STATUS_VARIANT[order.status] ?? "info"} />
      </View>

      <View className="mt-2.5 flex-row gap-3">
        <Figure label="ORDER VALUE" value={formatCurrency(order.totalAmount)} />
        <Figure label="PAID" value={formatCurrency(state.paid)} tone={cancelled ? "text-ink-500" : "text-cardamom-700"} />
        <Figure label="OUTSTANDING" value={cancelled ? "—" : formatCurrency(state.outstanding)} tone={!cancelled && state.outstanding > 0 ? "text-chili-600" : "text-ink-500"} />
      </View>

      <Unverified awaiting={state.awaiting} notVerified={state.notVerified} className="mt-2" />

      <View className="mt-2.5 flex-row items-center justify-between">
        {/* A cancelled order has no payment to chase; its status above says so */}
        {cancelled ? <View /> : <Badge label={state.label} variant={state.variant} />}
        <Pressable onPress={onDownload} disabled={downloading} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Download the invoice for ${order.orderId}`}>
          <Download size={16} color={colors.ink[500]} />
        </Pressable>
      </View>
    </Pressable>
  );
}
