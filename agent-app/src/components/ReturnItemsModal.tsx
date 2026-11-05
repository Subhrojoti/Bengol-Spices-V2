import { useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { isAxiosError } from "axios";
import { Modal, View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Check, RotateCcw } from "lucide-react-native";
import { Button, IconButton } from "@/components/ui/Button";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { returnApi, type ItemReturnInput } from "@/api/return.api";
import { getErrorMessage } from "@/api/client";
import { useProfile } from "@/hooks/useAgent";
import { newRequestId } from "@/utils/requestId";
import { parseReturnAttempt, returnAttemptKey } from "@/utils/returnAttempt";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";

export function ReturnItemsModal({ orderId, visible, atDelivery = false, onClose, onRecorded }: {
  orderId: string; visible: boolean; atDelivery?: boolean; onClose: () => void; onRecorded?: () => void;
}) {
  const cache = useQueryClient();
  const profile = useProfile();
  const actorId = profile.data?._id;
  const storageKey = actorId ? returnAttemptKey(actorId, orderId) : null;
  const query = useQuery({ queryKey: ["return-options", orderId], queryFn: ({ signal }) => returnApi.getReturnOptions(orderId, signal), enabled: visible, staleTime: 0 });
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false), running = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const [problem, setProblem] = useState("");
  const attempt = useRef<ItemReturnInput | null>(null);
  const generation = useRef(0);
  const [ready, setReady] = useState(false), [storageError, setStorageError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  useEffect(() => {
    const epoch = ++generation.current;
    let live = true;
    setReady(false); setStorageError(""); setUncertain(false); setProblem("");
    setQuantities({}); setReason(""); attempt.current = null;
    if (storageKey && actorId) {
      SecureStore.getItemAsync(storageKey).then(raw => {
        if (!live) return;
        if (raw) {
          const saved = parseReturnAttempt(raw, actorId, orderId);
          attempt.current = saved;
          setQuantities(Object.fromEntries(saved.items.map(item => [item.lineIndex, String(item.quantity)])));
          setReason(saved.reason); setUncertain(true);
        }
        setReady(true);
      }).catch(error => { if (live) setStorageError(getErrorMessage(error, "Could not read saved returns. Retry before recording a return.")); });
    }
    return () => { live = false; if (generation.current === epoch) generation.current++; };
  }, [storageKey, actorId, orderId, loadVersion]);
  const chosen = (query.data || []).filter(item => quantities[item.lineIndex] !== undefined);
  const invalid = !chosen.length || reason.trim().length < 5 || chosen.some(item => !/^\d+$/.test(quantities[item.lineIndex]) || !Number.isSafeInteger(Number(quantities[item.lineIndex])) || Number(quantities[item.lineIndex]) < 1 || Number(quantities[item.lineIndex]) > item.remainingQuantity);
  const close = () => { if (!running.current) onClose(); };
  const submit = async () => {
    if (running.current || !ready || !storageKey || !actorId || (!uncertain && (invalid || query.isFetching))) return;
    const details = { reason: reason.trim(), items: chosen.map(item => ({ lineIndex: item.lineIndex, orderLineId: item.orderLineId, quantity: Number(quantities[item.lineIndex]) })) };
    const input = uncertain && attempt.current ? attempt.current : { ...details, requestId: newRequestId() };
    attempt.current = input;
    const epoch = generation.current;
    let sent = false;
    running.current = true; setBusy(true); setProblem("");
    try {
      // Persist BEFORE sending. Reopening the screen or restarting the app must
      // replay the original reference, even if the reply was lost after commit.
      await SecureStore.setItemAsync(storageKey, JSON.stringify({ version: 1, actorId, orderId, input }));
      sent = true;
      const result = await returnApi.initiateItemsReturn(orderId, input);
      await SecureStore.deleteItemAsync(storageKey);
      if (generation.current !== epoch) return;
      attempt.current = null; setUncertain(false); setQuantities({}); setReason("");
      for (const name of ["return-options", "returns", "orders", "dashboard", "history", "profile"]) void cache.invalidateQueries({ queryKey: [name] });
      toast.success("Return recorded", `${result.returnId}. Financial adjustments await office review.`);
      onRecorded?.(); onClose();
    } catch (error) {
      let retain = true;
      if (sent && isAxiosError(error) && [400, 403, 404, 422].includes(error.response?.status || 0)) {
        try { await SecureStore.deleteItemAsync(storageKey); retain = false; } catch { /* Keep the same reference until local recovery succeeds. */ }
      }
      if (generation.current !== epoch) return;
      if (!retain) { attempt.current = null; void query.refetch(); }
      setUncertain(retain);
      setProblem(getErrorMessage(error));
    } finally { running.current = false; if (generation.current === epoch) setBusy(false); }
  };
  const locked = busy || uncertain || !ready;
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
          {uncertain && <Text accessibilityRole="alert" className="rounded-xl bg-saffron-50 p-3 font-sans text-sm text-ink-700">A previous return has not been confirmed on this phone. Retry the saved request before recording another return.</Text>}
          {storageError || profile.isError ? <ErrorState message={storageError || getErrorMessage(profile.error)} onRetry={() => { setLoadVersion(value => value + 1); void profile.refetch(); }} /> : !ready ? <LoadingState message="Checking saved returns…" /> : null}
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
        <Button label={uncertain ? "Retry Same Return" : atDelivery ? "Record Items Taken Back" : "Submit Return Request"} icon={<RotateCcw size={16} color={colors.white} />} loading={busy} disabled={!ready || !uncertain && (invalid || query.isFetching || query.isError)} onPress={submit} fullWidth />
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
