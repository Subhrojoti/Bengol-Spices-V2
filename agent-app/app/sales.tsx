import { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, PackageSearch } from "lucide-react-native";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card } from "@/components/ui/Card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useProductSales } from "@/hooks/useSalesTarget";
import { formatCurrency } from "@/utils/currency";
import { formatQuantity } from "@/utils/uom";
import { getErrorMessage } from "@/api/client";
import { colors } from "@/theme/colors";
import type { ProductSalesRow } from "@/types/api";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");

// The month it is in India now, "2026-10", whatever zone the phone is set to
const currentMonth = () => new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 7);

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

const rupees = (value: number) => formatCurrency(Math.round(value * 100) / 100);

/**
 * The signed-in agent's own business for a month, with three figures kept
 * apart:
 *
 *   COLLECTED     the payments taken in the month. This is the agent's
 *                 sales: what the sales target and incentive count.
 *   ORDER VALUE   what stores ordered in the month, product by product.
 *   OUTSTANDING   what is still to be collected on those orders.
 *
 * The server only ever answers for the agent who is signed in.
 */
export default function MySalesScreen() {
  const thisMonth = useMemo(currentMonth, []);
  const [month, setMonth] = useState(thisMonth);
  const { data, isLoading, isError, refetch, error } = useProductSales(month);
  const [refreshing, setRefreshing] = useState(false);

  const products = data?.products ?? [];
  const ordered = products.filter((p) => p.quantity > 0);
  const best = ordered.length > 1 ? ordered[0] : null;
  const lowest = ordered.length > 1 ? ordered[ordered.length - 1] : null;
  // Nothing ordered and nothing collected on it this month
  const idle = products.filter((p) => p.quantity === 0 && p.collected === 0).length;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const header = (
    <View className="gap-3">
      {/* one month at a time; never past the month it is now */}
      <View className="flex-row items-center justify-between rounded-2xl border border-sand bg-white px-2 py-1.5">
        <Pressable onPress={() => setMonth((m) => shiftMonth(m, -1))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Previous month" className="h-9 w-9 items-center justify-center rounded-full active:bg-sand">
          <ChevronLeft size={20} color={colors.ink.DEFAULT} />
        </Pressable>
        <Text className="font-display-bold text-base text-ink">{monthLabel(month)}</Text>
        <Pressable
          onPress={() => setMonth((m) => shiftMonth(m, 1))}
          disabled={month >= thisMonth}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          className={`h-9 w-9 items-center justify-center rounded-full active:bg-sand ${month >= thisMonth ? "opacity-30" : ""}`}
        >
          <ChevronRight size={20} color={colors.ink.DEFAULT} />
        </Pressable>
      </View>

      {data ? (
        <Card>
          <Text className="font-sans text-xs text-ink-500">COLLECTED SALES · {monthLabel(month).toUpperCase()}</Text>
          <Text className="mt-1 font-display-black text-3xl text-ink">{rupees(data.totals.collected)}</Text>
          <Text className="mt-1 font-sans text-[11px] leading-4 text-ink-500">
            {data.totals.earlierDues > 0
              ? `Payments you collected this month. ${rupees(data.totals.towardTarget)} of it counts toward your sales target; ${rupees(data.totals.earlierDues)} was on orders from earlier months, which do not count.`
              : "Payments you collected this month. This is what your sales target counts."}
          </Text>
          {data.totals.awaitingVerification > 0 ? (
            <Text className="mt-1 font-sans-semibold text-[11px] leading-4 text-saffron-700">+ {rupees(data.totals.awaitingVerification)} in cash awaiting verification, not counted yet</Text>
          ) : null}

          <View className="mt-3 flex-row gap-2">
            <View className="flex-1 rounded-xl bg-cream-100 px-3 py-2">
              <Text className="font-sans text-[10px] text-ink-500">ORDER VALUE</Text>
              <Text className="font-sans-bold text-sm text-ink">{rupees(data.totals.orderValue)}</Text>
              <Text className="font-sans text-[10px] text-ink-500">
                {data.totals.orders} {data.totals.orders === 1 ? "order" : "orders"} placed
              </Text>
            </View>
            <View className="flex-1 rounded-xl bg-cream-100 px-3 py-2">
              <Text className="font-sans text-[10px] text-ink-500">OUTSTANDING</Text>
              <Text className={`font-sans-bold text-sm ${data.totals.outstanding > 0 ? "text-chili-600" : "text-ink"}`}>{rupees(data.totals.outstanding)}</Text>
              <Text className="font-sans text-[10px] text-ink-500">still to collect on them</Text>
            </View>
          </View>

          <Text className="mt-3 font-sans text-[11px] leading-4 text-ink-500">
            Your sales target counts only payments on orders placed in the same month. A payment on an earlier month's order is shown here as collected, but does not count toward a target. Cash counts
            once the office has verified it. Cancelled and returned orders are not counted.
          </Text>
        </Card>
      ) : null}

      {products.length > 0 ? (
        <View className="mt-1 flex-row items-end justify-between">
          <Text className="font-display-bold text-lg text-ink">Product-wise</Text>
          <Text className="font-sans text-xs text-ink-500">
            {ordered.length} of {products.length} ordered{idle > 0 ? ` · ${idle} not yet` : ""}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <AppHeader title="My Sales" showBack />

      {isLoading ? (
        <LoadingState message="Loading your sales…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load your sales.")} onRetry={refetch} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item, index) => item.productId ?? `${item.name}-${index}`}
          contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 32, gap: 10, flexGrow: 1 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState icon={<PackageSearch size={22} color={colors.ink[500]} />} title="No products to show" />}
          renderItem={({ item }) => <ProductRow row={item} tag={item === best ? "best" : item === lowest ? "lowest" : item.quantity === 0 && item.collected === 0 ? "none" : null} />}
        />
      )}
    </SafeAreaView>
  );
}

const TAGS = {
  best: { label: "Most ordered", box: "bg-cardamom-100", text: "text-cardamom-700" },
  lowest: { label: "Least ordered", box: "bg-saffron-50", text: "text-saffron-700" },
  none: { label: "Not ordered yet", box: "bg-chili-100", text: "text-chili-700" },
} as const;

function Figure({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <View className="flex-1">
      <Text className="font-sans text-[10px] text-ink-500">{label}</Text>
      <Text className={`font-sans-bold text-sm ${tone}`}>{value}</Text>
    </View>
  );
}

function ProductRow({ row, tag }: { row: ProductSalesRow; tag: keyof typeof TAGS | null }) {
  const none = row.quantity === 0 && row.collected === 0;
  const badge = tag ? TAGS[tag] : null;

  return (
    <Card>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className={`font-sans-bold text-sm ${none ? "text-ink-500" : "text-ink"}`} numberOfLines={2}>
            {row.name}
          </Text>
          <Text className="mt-0.5 font-sans text-xs text-ink-500">
            {row.quantity > 0
              ? `${formatQuantity(row.quantity, row.uom)} ordered · ${row.orders} ${row.orders === 1 ? "order" : "orders"}`
              : none
                ? "Nothing ordered this month"
                : "Collected on earlier orders"}
          </Text>
        </View>
        {badge ? (
          <View className={`rounded-full px-2 py-0.5 ${badge.box}`}>
            <Text className={`font-sans-bold text-[10px] ${badge.text}`}>{badge.label}</Text>
          </View>
        ) : null}
      </View>

      {none ? null : (
        <>
          <View className="mt-3 flex-row gap-3 border-t border-sand pt-2.5">
            <Figure label="ORDER VALUE" value={rupees(row.orderValue)} />
            <Figure label="COLLECTED" value={rupees(row.collected)} tone="text-cardamom-700" />
            <Figure label="OUTSTANDING" value={rupees(row.outstanding)} tone={row.outstanding > 0 ? "text-chili-600" : "text-ink-500"} />
          </View>

          {row.quantity > 0 ? (
            <View className="mt-2.5 flex-row items-center gap-2.5">
              <View className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
                <View className="h-full rounded-full bg-saffron-600" style={{ width: `${Math.min(100, Math.max(2, row.share))}%` }} />
              </View>
              <Text className="w-24 text-right font-sans-semibold text-[11px] text-ink-500">{Math.round(row.share)}% of orders</Text>
            </View>
          ) : null}
        </>
      )}
    </Card>
  );
}
