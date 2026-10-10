import { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Banknote, CircleCheck, Clock, ShieldCheck, XCircle } from "lucide-react-native";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card } from "@/components/ui/Card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useCashPayments } from "@/hooks/useSalesTarget";
import { formatCurrency } from "@/utils/currency";
import { formatDate, formatDateTime } from "@/utils/date";
import { getErrorMessage } from "@/api/client";
import { colors } from "@/theme/colors";
import type { CashPayment, CashVerificationStatus } from "@/types/api";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "2026-10" → "October 2026"
function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} ${y}` : month;
}

const STATUS: Record<CashVerificationStatus, { label: string; box: string; text: string }> = {
  PENDING: { label: "Awaiting verification", box: "bg-saffron-50", text: "text-saffron-700" },
  APPROVED: { label: "Verified", box: "bg-cardamom-100", text: "text-cardamom-700" },
  REJECTED: { label: "Not verified", box: "bg-chili-100", text: "text-chili-700" },
};

const FILTERS: { key: CashVerificationStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Awaiting" },
  { key: "APPROVED", label: "Verified" },
  { key: "REJECTED", label: "Not verified" },
];

/**
 * The cash this agent has recorded and where each payment stands with the
 * office. Cash counts toward the sales target, and anything it earns, only
 * once the office has verified that it reached the company; until then it
 * waits here. An agent can read this and nothing more: only the office can
 * verify a payment.
 */
export default function CashPaymentsScreen() {
  const { data, isLoading, isError, refetch, error } = useCashPayments();
  const [filter, setFilter] = useState<CashVerificationStatus | "ALL">("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const payments = useMemo(() => (data?.payments ?? []).filter((p) => filter === "ALL" || p.status === filter), [data, filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const summary = data?.summary;

  const header = (
    <View className="gap-3">
      <Card>
        <View className="flex-row items-start gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-saffron-50">
            <ShieldCheck size={18} color={colors.saffron[600]} />
          </View>
          <View className="flex-1">
            <Text className="font-display-bold text-base text-ink">Cash is verified by the office</Text>
            <Text className="mt-1 font-sans text-xs leading-5 text-ink-500">
              Cash you collect counts toward your sales target and incentives once the office confirms it has been deposited. It then counts for the month you collected it in. Online and QR payments
              count straight away.
            </Text>
          </View>
        </View>

        <View className="mt-3 flex-row gap-2">
          <View className="flex-1 rounded-xl bg-cream-100 px-3 py-2">
            <Text className="font-sans text-[10px] text-ink-500">AWAITING</Text>
            <Text className="font-sans-bold text-sm text-ink">{formatCurrency(summary?.pending.amount ?? 0)}</Text>
            <Text className="font-sans text-[10px] text-ink-500">
              {summary?.pending.count ?? 0} {summary?.pending.count === 1 ? "payment" : "payments"}
            </Text>
          </View>
          <View className="flex-1 rounded-xl bg-cream-100 px-3 py-2">
            <Text className="font-sans text-[10px] text-ink-500">VERIFIED</Text>
            <Text className="font-sans-bold text-sm text-cardamom-700">{formatCurrency(summary?.approved.amount ?? 0)}</Text>
            <Text className="font-sans text-[10px] text-ink-500">
              {summary?.approved.count ?? 0} {summary?.approved.count === 1 ? "payment" : "payments"}
            </Text>
          </View>
          <View className="flex-1 rounded-xl bg-cream-100 px-3 py-2">
            <Text className="font-sans text-[10px] text-ink-500">NOT VERIFIED</Text>
            <Text className={`font-sans-bold text-sm ${(summary?.rejected.amount ?? 0) > 0 ? "text-chili-600" : "text-ink"}`}>{formatCurrency(summary?.rejected.amount ?? 0)}</Text>
            <Text className="font-sans text-[10px] text-ink-500">
              {summary?.rejected.count ?? 0} {summary?.rejected.count === 1 ? "payment" : "payments"}
            </Text>
          </View>
        </View>
      </Card>

      <View className="flex-row flex-wrap gap-2" accessibilityRole="tablist">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              className={`rounded-full border px-3.5 py-1.5 ${active ? "border-saffron-600 bg-saffron-600" : "border-sand bg-white"}`}
            >
              <Text className={`font-sans-semibold text-xs ${active ? "text-white" : "text-ink-700"}`}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <AppHeader title="Cash Verification" showBack />

      {isLoading ? (
        <LoadingState message="Loading your cash payments…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load your cash payments.")} onRetry={refetch} />
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 32, gap: 10, flexGrow: 1 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState
              icon={<Banknote size={22} color={colors.ink[500]} />}
              title={filter === "ALL" ? "No cash payments yet" : "Nothing here"}
              subtitle={filter === "ALL" ? "Cash you collect will be listed here with whether the office has verified it." : undefined}
            />
          }
          renderItem={({ item }) => <PaymentCard payment={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function PaymentCard({ payment }: { payment: CashPayment }) {
  const status = STATUS[payment.status] ?? STATUS.PENDING;
  const month = monthLabel(payment.countsFor);

  return (
    <Card>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-display-bold text-lg text-ink">{formatCurrency(payment.amount)}</Text>
          <Text className="mt-0.5 font-sans-semibold text-xs text-ink-700" numberOfLines={1}>
            {payment.storeName || "Store"} · {payment.orderId}
          </Text>
          <Text className="mt-0.5 font-sans text-xs text-ink-500">Collected {formatDateTime(payment.collectedAt)}</Text>
        </View>
        <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${status.box}`}>
          {payment.status === "APPROVED" ? (
            <CircleCheck size={12} color={colors.cardamom[700]} />
          ) : payment.status === "REJECTED" ? (
            <XCircle size={12} color={colors.chili[700]} />
          ) : (
            <Clock size={12} color={colors.saffron[700]} />
          )}
          <Text className={`font-sans-bold text-[11px] ${status.text}`}>{status.label}</Text>
        </View>
      </View>

      <View className="mt-2.5 border-t border-sand pt-2.5">
        {payment.status === "PENDING" ? (
          <Text className="font-sans text-xs leading-5 text-ink-500">
            {payment.countsTowardTarget
              ? `Waiting for the office to confirm the deposit. It will count toward your ${month} sales once verified.`
              : "Waiting for the office to confirm the deposit. This was a due from an earlier month, so it will not count toward a sales target."}
          </Text>
        ) : payment.status === "APPROVED" ? (
          <Text className="font-sans text-xs leading-5 text-ink-500">
            Verified{payment.decidedAt ? ` on ${formatDate(payment.decidedAt)}` : ""}.{" "}
            {payment.countsTowardTarget ? `Counted in your ${month} sales.` : "A due from an earlier month: not counted toward a sales target."}
          </Text>
        ) : (
          <>
            <Text className="font-sans-semibold text-xs leading-5 text-chili-700">{payment.reason || "The office could not verify this payment."}</Text>
            <Text className="mt-1 font-sans text-xs leading-5 text-ink-500">It does not count toward your sales. Settle it with the office and it can still be verified.</Text>
          </>
        )}
      </View>
    </Card>
  );
}
