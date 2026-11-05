import { useRef, useState } from "react";
import { Modal, View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Check, RotateCcw } from "lucide-react-native";
import { Button, IconButton } from "@/components/ui/Button";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { returnApi, type ItemReturnInput } from "@/api/return.api";
import { getErrorMessage } from "@/api/client";
import axios from "axios";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";

export function ReturnItemsModal({ orderId, visible, atDelivery = false, onClose, onRecorded }: {
  orderId: string; visible: boolean; atDelivery?: boolean; onClose: () => void; onRecorded?: () => void;
}) {
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ["return-options", orderId], queryFn: ({ signal }) => returnApi.getReturnOptions(orderId, signal), enabled: visible, staleTime: 0 });
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false), running = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const [problem, setProblem] = useState("");
  const attempt = useRef<{ key: string; input: ItemReturnInput } | null>(null);
  const chosen = (query.data || []).filter(item => quantities[item.lineIndex] !== undefined);
  const invalid = !chosen.length || reason.trim().length < 5 || chosen.some(item => !/^\d+$/.test(quantities[item.lineIndex]) || !Number.isSafeInteger(Number(quantities[item.lineIndex])) || Number(quantities[item.lineIndex]) < 1 || Number(quantities[item.lineIndex]) > item.remainingQuantity);
  const close = () => { if (!running.current) onClose(); };
  const submit = async () => {
    if (running.current || (!uncertain && (invalid || query.isFetching))) return;
    const details = { reason: reason.trim(), items: chosen.map(item => ({ lineIndex: item.lineIndex, orderLineId: item.orderLineId, quantity: Number(quantities[item.lineIndex]) })) };
    const key = JSON.stringify(details);
    if (!uncertain && attempt.current?.key !== key) attempt.current = { key, input: { ...details, requestId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}` } };
    if (!attempt.current) return;
    running.current = true; setBusy(true); setProblem("");
    try {
      const result = await returnApi.initiateItemsReturn(orderId, attempt.current.input);
      attempt.current = null; setUncertain(false); setQuantities({}); setReason("");
      for (const name of ["return-options", "returns", "orders", "dashboard", "history", "profile"]) void cache.invalidateQueries({ queryKey: [name] });
      toast.success("Return recorded", `${result.returnId}. Financial adjustments await office review.`);
      onRecorded?.(); onClose();
    } catch (error) {
      setUncertain(axios.isAxiosError(error) && (!error.response || error.response.status >= 500 || error.response.status === 409));
      setProblem(getErrorMessage(error));
    } finally { running.current = false; setBusy(false); }
  };
  const locked = busy || uncertain;
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
      <View className="rounded-t-3xl bg-white px-5 pb-7 pt-4" style={{ maxHeight: "90%" }}>
        <View className="mb-3 flex-row items-center justify-between gap-3">
          <View className="flex-1"><Text className="font-display-bold text-lg text-ink">{atDelivery ? "Return Items at Delivery" : "Request Item Return"}</Text><Text className="font-sans text-xs text-ink-500">{orderId}</Text></View>
          <IconButton onPress={close} className="bg-cream-100"><X size={18} color={colors.ink.DEFAULT} /></IconButton>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 12 }}>
          <Text className="font-sans text-sm text-ink-700">{atDelivery ? "Select only the items you are taking back now. The remaining items follow the usual delivery-code verification." : "Select the products and quantities the store wants to return."}</Text>
          <Text className="rounded-xl bg-cream-100 p-3 font-sans text-xs text-ink-500">The office reviews financial adjustments. Recording a return does not change the invoice, payments or balance. Stock is not automatically added back.</Text>
          {query.isPending ? <LoadingState message="Loading returnable items…" /> : query.isError ? <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} /> : <>
            {!query.data?.some(item => item.remainingQuantity > 0) && <Text className="font-sans-semibold text-sm text-ink-500">All items are already included in return requests.</Text>}
            {query.data?.map(item => {
              const selected = quantities[item.lineIndex] !== undefined;
              return <View key={item.lineIndex} className="gap-2 rounded-xl border border-sand p-3">
                <View className="flex-row items-start gap-3">
                  <View className="flex-1"><Text className="font-sans-bold text-sm text-ink">{item.name}</Text><Text className="mt-1 font-sans text-xs text-ink-500">{item.remainingQuantity} of {item.orderedQuantity} {item.uom} available</Text></View>
                  <Button size="sm" variant={selected ? "primary" : "outline"} label={selected ? "Selected" : "Select"} icon={selected ? <Check size={14} color={colors.white} /> : undefined} disabled={locked || item.remainingQuantity <= 0} onPress={() => { setQuantities(old => { const next = { ...old }; if (selected) delete next[item.lineIndex]; else next[item.lineIndex] = "1"; return next; }); setProblem(""); }} />
                </View>
                {selected && <View className="flex-row items-center justify-between gap-3"><Text className="font-sans text-xs text-ink-700">Quantity to return</Text><TextInput accessibilityLabel={`Return quantity for ${item.name}`} value={quantities[item.lineIndex]} onChangeText={value => setQuantities(old => ({ ...old, [item.lineIndex]: value.replace(/[^0-9]/g, "") }))} keyboardType="number-pad" maxLength={9} editable={!locked} selectTextOnFocus className="min-w-[80px] rounded-lg border border-sand bg-cream-50 px-3 py-2 text-center font-sans-bold text-ink" /></View>}
              </View>;
            })}
            <Text className="font-sans-semibold text-sm text-ink">Reason for return</Text>
            <TextInput accessibilityLabel="Reason for return" value={reason} onChangeText={setReason} editable={!locked} multiline maxLength={500} placeholder="Describe the reason (at least 5 characters)" placeholderTextColor={colors.ink[300]} className="rounded-xl border border-sand p-3 font-sans text-sm text-ink" style={{ minHeight: 80, textAlignVertical: "top" }} />
          </>}
          {problem ? <Text accessibilityRole="alert" className="font-sans text-sm text-chili-700">{problem}{uncertain ? " The reply was uncertain. Retry the same request before recording another return." : ""}</Text> : null}
        </ScrollView>
        <Button label={uncertain ? "Retry Same Return" : atDelivery ? "Record Items Taken Back" : "Submit Return Request"} icon={<RotateCcw size={16} color={colors.white} />} loading={busy} disabled={!uncertain && (invalid || query.isFetching || query.isError)} onPress={submit} fullWidth />
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
