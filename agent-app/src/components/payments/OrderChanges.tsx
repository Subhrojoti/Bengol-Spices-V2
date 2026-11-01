import { useState } from "react";
import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { orderEditingApi } from "@/api/orderEditing.api";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/utils/currency";
import { formatDateTime } from "@/utils/date";
export function OrderChanges({ orderId }: { orderId: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["orders", orderId, "modifications", page], queryFn: () => orderEditingApi.history(orderId, page) });
  return <View className="gap-2 rounded-2xl border border-sand bg-white p-4"><Text className="font-sans-bold text-base text-ink">Order changes</Text>{query.isPending ? <Text>Loading changes…</Text> : query.isError ? <Button label="Retry change history" variant="outline" onPress={() => query.refetch()} /> : <>{query.data.history.map(change => <View key={change._id} className="gap-1 border-t border-sand py-3"><Text className="font-sans-bold text-sm text-ink">Revision {change.revision} · {change.agentId}</Text><Text className="font-sans text-xs text-ink-500">{formatDateTime(change.createdAt)}</Text><Text className="font-sans text-xs text-ink-500">Before: {change.before.products.map(item => `${item.name} × ${item.quantity} ${item.uom}`).join(", ")} · {formatCurrency(change.before.totalAmount)}</Text><Text className="font-sans text-xs text-ink">After: {change.after.products.map(item => `${item.name} × ${item.quantity} ${item.uom}`).join(", ")} · {formatCurrency(change.after.totalAmount)}</Text></View>)}<View className="flex-row justify-between"><Button label="Newer" size="sm" variant="ghost" disabled={page === 1} onPress={() => setPage(value => value - 1)} /><Button label="Older" size="sm" variant="ghost" disabled={page >= query.data.pages} onPress={() => setPage(value => value + 1)} /></View></>}</View>;
}
