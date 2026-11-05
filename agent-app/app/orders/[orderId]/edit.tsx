import { useEffect, useRef, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { newRequestId } from "@/utils/requestId";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { orderEditingApi, type EditAttempt } from "@/api/orderEditing.api";
import { getErrorMessage } from "@/api/client";
import { useProfile } from "@/hooks/useAgent";
import { useRefreshAfterOrderActivity } from "@/hooks/useOrders";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { formatCurrency } from "@/utils/currency";
import { initialEditQuantities } from "@/utils/orderEdit";
import { toast } from "@/utils/toast";

export default function EditOrder() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>(), router = useRouter();
  const { data: agent } = useProfile();
  const client = useQueryClient();
  const storageKey = agent ? `orderEdit.${agent.agentId}.${orderId}`.replace(/[^A-Za-z0-9._-]/g, "_") : null;
  const query = useQuery({ queryKey: ["orders", orderId, "edit"], queryFn: () => orderEditingApi.details(orderId), staleTime: 0 });
  const [quantities, setQuantities] = useState<Record<string, string>>({}), [pending, setPending] = useState<EditAttempt | null>(null);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const running = useRef(false), refresh = useRefreshAfterOrderActivity();
  const seeded = useRef<{ key: string; revision: number } | null>(null);
  useEffect(() => {
    if (!storageKey) return;
    let active = true;
    SecureStore.getItemAsync(storageKey).then(saved => { if (active) { if (saved) setPending(JSON.parse(saved)); setReady(true); } }).catch(() => { if (active) setMessage("Could not read the saved edit. Retry reopening this screen before making another edit."); });
    return () => { active = false; };
  }, [storageKey]);
  useEffect(() => {
    if (!query.data || !ready || pending || !storageKey) return;
    const revision = query.data.order.revision || 0;
    if (seeded.current?.key === storageKey && seeded.current.revision === revision) return;
    if (seeded.current?.key === storageKey) setMessage("This order changed on another device. Review the latest quantities and prices before saving.");
    seeded.current = { key: storageKey, revision };
    setQuantities(initialEditQuantities(query.data.order.products));
  }, [query.data, ready, pending, storageKey]);
  const chosen = (query.data?.products || []).filter(product => Number(quantities[product.productId]) > 0);
  const total = Math.round(chosen.reduce((sum, product) => sum + Math.round(product.unitPrice * Number(quantities[product.productId]) * 100) / 100, 0) * 100) / 100;
  const invalid = !chosen.length || total < (query.data?.order.paidAmount || 0) || (query.data?.products || []).some(product => {
    const raw = quantities[product.productId] || "", quantity = Number(raw);
    return raw !== "" && (quantity !== 0 && (!Number.isFinite(quantity) || quantity < product.minOrderQty || quantity > product.availableStock));
  });
  const save = async () => {
    if (running.current || !ready || !storageKey || (!pending && (!query.data || invalid))) return;
    running.current = true; setBusy(true); setMessage("");
    try {
      const attempt = pending || { clientRequestId: newRequestId(), expectedRevision: query.data!.order.revision || 0, expectedTotal: total, products: chosen.map(product => ({ productId: product.productId, quantity: Number(quantities[product.productId]) })) };
      await SecureStore.setItemAsync(storageKey, JSON.stringify(attempt)); setPending(attempt);
      await orderEditingApi.save(orderId, attempt);
      await SecureStore.deleteItemAsync(storageKey); setPending(null); refresh(); void client.invalidateQueries({ queryKey: ["catalog"] });
      toast.success("Order updated", "The office will review the revised order before confirmation."); router.back();
    } catch (error) {
      // A definitive rejection did not commit. A lost response keeps the same request for replay.
      if (isAxiosError(error) && [400, 403, 404, 409].includes(error.response?.status || 0)) {
        await SecureStore.deleteItemAsync(storageKey).catch(() => {}); setPending(null); void query.refetch();
      }
      setMessage(getErrorMessage(error, "Connection interrupted. Retry the saved edit before starting another one."));
    } finally { running.current = false; setBusy(false); }
  };
  return <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
    <View className="flex-row items-center justify-between p-4"><Text className="font-display-bold text-xl text-ink">Edit {orderId}</Text><Button label="Back" variant="ghost" size="sm" onPress={() => router.back()} disabled={busy} /></View>
    {message ? <Text accessibilityRole="alert" className="px-5 py-2 font-sans text-sm text-chili-700">{message}</Text> : null}
    {pending ? <View className="gap-3 p-5"><Text className="font-sans text-sm text-ink">An edit was sent without a confirmed reply. Retry that saved request to find out whether it succeeded.</Text><Button label="Retry saved edit" onPress={save} loading={busy} disabled={!ready} /></View> : query.isPending ? <LoadingState /> : query.isError ? <ErrorState message={getErrorMessage(query.error)} onRetry={query.refetch} /> : <>
      <Text className="px-5 pb-3 font-sans text-sm text-ink-500">Edit quantities or add products below. Enter 0 to remove a product. Prices are set by the office. An invoice generates only after confirmation.</Text>
      {query.data.order.products.some(line => !query.data.products.some(product => product.productId === line.productId)) && <Text className="px-5 pb-3 font-sans text-sm text-chili-700">Some previous products are no longer available. Saving this edit removes those products. Review the new total before saving.</Text>}
      <FlatList data={query.data.products} keyExtractor={product => product.productId} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled" renderItem={({ item }) => {
        const quantity = Number(quantities[item.productId]) || 0, bad = quantity !== 0 && (quantity < item.minOrderQty || quantity > item.availableStock);
        return <View className="mb-3 rounded-2xl border border-sand bg-white p-4"><Text className="font-sans-bold text-base text-ink">{item.name}</Text><Text className="mt-1 font-sans text-xs text-ink-500">{formatCurrency(item.unitPrice)} / {item.uom} · Minimum {item.minOrderQty} · Available {item.availableStock}</Text><TextInput accessibilityLabel={`${item.name} quantity`} value={quantities[item.productId] || ""} onChangeText={value => setQuantities(current => ({ ...current, [item.productId]: value }))} keyboardType="decimal-pad" placeholder="0" editable={!busy} className="mt-3 rounded-xl border border-sand px-3 py-2 font-sans text-ink" /><Text className={`mt-1 font-sans text-xs ${bad ? "text-chili-700" : "text-ink-500"}`}>{bad ? "Check the minimum quantity and available stock" : formatCurrency(Math.round(quantity * item.unitPrice * 100) / 100)}</Text></View>;
      }} />
      <View className="gap-2 border-t border-sand bg-white p-4"><Text className="font-sans-bold text-base text-ink">Total {formatCurrency(total)} · Recorded {formatCurrency(query.data.order.paidAmount)}</Text><Text className="font-sans text-sm text-ink-500">Outstanding {formatCurrency(Math.max(0, total - query.data.order.paidAmount))}. Existing payments stay unchanged.</Text>{total < query.data.order.paidAmount && <Text className="font-sans text-xs text-chili-700">The total cannot be below the amount already collected.</Text>}<Button label="Save order changes" disabled={invalid || !ready} loading={busy} onPress={save} /></View>
    </>}
  </SafeAreaView>;
}
