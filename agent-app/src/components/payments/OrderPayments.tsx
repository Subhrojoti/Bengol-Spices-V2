import { useState } from "react";
import { Text, View, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { formatCurrency } from "@/utils/currency";
import { formatDateTime } from "@/utils/date";

interface PaymentHistory {
  recordedAmount: number; verifiedAmount: number; pendingVerificationAmount: number; rejectedAmount: number;
  payments: { id: string; amount: number; method: string; collectedAt: string; collectionKind: string | null; verification: string | null; collector: { id: string; role: string; name: string | null } }[];
}
export function OrderPayments({ orderId }: { orderId: string }) {
  const [shown, setShown] = useState(10);
  const query = useQuery({ queryKey: ["orders", orderId, "payment-history"], queryFn: () => api.get<PaymentHistory>(`/agent/orders/mine/${encodeURIComponent(orderId)}/payments`).then(r => r.data) });
  return <View className="rounded-2xl border border-sand bg-white p-4"><Text className="font-sans-bold text-base text-ink">Payment history</Text>{query.isPending ? <Text className="mt-2 font-sans text-xs text-ink-500">Loading collections…</Text> : query.isError ? <Pressable onPress={() => query.refetch()}><Text className="mt-2 font-sans text-sm text-chili-600">Could not load payment history. Tap to retry.</Text></Pressable> : <>
    <View className="my-3 gap-1">{[["Recorded", query.data.recordedAmount], ["Verified", query.data.verifiedAmount], ["Pending verification", query.data.pendingVerificationAmount], ["Not verified", query.data.rejectedAmount]].map(([label, amount]) => <View key={String(label)} className="flex-row justify-between"><Text className="font-sans text-xs text-ink-500">{label}</Text><Text className="font-sans-semibold text-xs text-ink">{formatCurrency(Number(amount))}</Text></View>)}</View>
    <Text className="mb-2 font-sans text-xs text-ink-500">Only verified eligible collections count toward collected sales and incentives.</Text>
    {[...query.data.payments].reverse().slice(0, shown).map(payment => <View key={payment.id} className="border-t border-sand py-3"><Text className="font-sans-bold text-sm text-ink">{formatCurrency(payment.amount)} · {payment.method}</Text><Text className="mt-1 font-sans text-xs text-ink-500">{payment.collectionKind === "INITIAL" ? "Initial payment" : payment.collectionKind === "INSTALMENT" ? "Instalment" : "Collection"} · {payment.verification || "Verified / legacy"}</Text><Text className="mt-1 font-sans text-xs text-ink-500">{formatDateTime(payment.collectedAt)} · {payment.collector.role === "DELIVERY_PARTNER" ? "Delivery partner" : payment.collector.role === "AGENT" ? "Agent" : "Collector"}: {payment.collector.name || payment.collector.id || "Not recorded"}</Text></View>)}
    {shown < query.data.payments.length && <Pressable onPress={() => setShown(n => n + 10)}><Text className="py-2 font-sans-semibold text-sm text-cardamom-700">Show earlier payments</Text></Pressable>}
  </>}</View>;
}
