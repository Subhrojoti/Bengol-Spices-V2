import { useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { api, getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { formatDateTime } from "@/utils/date";
interface Collections {
  total: number; page: number; pages: number; recordedAmount: number; verifiedAmount: number; pendingVerificationAmount: number;
  payments: { id: string; amount: number; orderId: string; method: string; verification: string | null; collectedAt: string; canOpenOrder: boolean; collector: { name: string | null; id: string } }[];
}
const money = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export function MyCollections() {
  const [page, setPage] = useState(1), router = useRouter();
  const query = useQuery({ queryKey: ["collections", "mine", page], queryFn: () => api.get<Collections>("/delivery-partner/collections", { params: { page } }).then(r => r.data) });
  if (query.isPending) return <LoadingState message="Loading your collections…" />;
  if (query.isError) return <ErrorState message={getErrorMessage(query.error)} onRetry={query.refetch} />;
  const data = query.data;
  return <FlatList contentContainerStyle={{ padding: 20, gap: 10 }} data={data.payments} keyExtractor={item => item.id} refreshing={query.isRefetching} onRefresh={query.refetch} ListHeaderComponent={<View className="mb-2 rounded-xl border border-sand bg-white p-4"><Text className="font-display-bold text-base text-ink">Your recorded collections</Text><Text className="mt-2 font-sans text-xs text-ink-500">Recorded {money(data.recordedAmount)} · Verified {money(data.verifiedAmount)} · Pending verification {money(data.pendingVerificationAmount)}</Text><Text className="mt-2 font-sans text-xs text-ink-500">Sales credit stays with the original sales agent. Receipts remain in your history after reassignment; store details are accessible only while assigned to you.</Text></View>} ListEmptyComponent={<Text className="font-sans text-sm text-ink-500">No collections recorded by you yet.</Text>} renderItem={({ item }) => <Pressable disabled={!item.canOpenOrder} onPress={() => router.push({ pathname: "/deliveries/[orderId]", params: { orderId: item.orderId } })} className="rounded-xl border border-sand bg-white p-4"><Text className="font-sans-bold text-sm text-ink">{item.orderId} · {money(item.amount)} · {item.method}</Text><Text className="mt-1 font-sans text-xs text-ink-500">{formatDateTime(item.collectedAt)} · {item.verification || "Verified / legacy"}</Text><Text className="mt-1 font-sans text-xs text-ink-500">Collector: {item.collector.name || item.collector.id}</Text>{item.canOpenOrder && <Text className="mt-2 font-sans-semibold text-xs text-cardamom-700">View order and outstanding balance</Text>}</Pressable>} ListFooterComponent={<View className="mt-3 flex-row items-center justify-between"><Button label="Previous" size="sm" variant="outline" disabled={data.page <= 1} onPress={() => setPage(data.page - 1)} /><Text className="font-sans text-xs text-ink-500">{data.page} / {data.pages}</Text><Button label="Next" size="sm" variant="outline" disabled={data.page >= data.pages} onPress={() => setPage(data.page + 1)} /></View>} />;
}
