import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/api/client";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/utils/date";
import { toast } from "@/utils/toast";
import { readOfflineCollection, saveOfflineCollection, clearOfflineCollection, type OfflineCollection } from "@/utils/offlineCollection";
import { collectionAmount } from "@/utils/deliveryView";
import { DeliveryQrCollection } from "./DeliveryQrCollection";

interface History {
  dueAmount: number; totalAmount: number; recordedAmount: number; verifiedAmount: number; pendingVerificationAmount: number;
  payments: { id: string; amount: number; method: string; collectedAt: string; verification: string | null; collector: { role: string; name: string | null; id: string } }[];
}
const money = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export function OrderCollections({ orderId }: { orderId: string }) {
  const profile = useProfile(), client = useQueryClient();
  const url = `/delivery-partner/orders/${encodeURIComponent(orderId)}/payments`;
  const query = useQuery({ queryKey: ["collections", orderId], queryFn: () => api.get<History>(url).then(r => r.data) });
  const [amountText, setAmountText] = useState(""), [method, setMethod] = useState<"CASH" | "UPI">("CASH"), [note, setNote] = useState("");
  const [attempt, setAttempt] = useState<OfflineCollection | null>(null), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [shown, setShown] = useState(10), [revision, setRevision] = useState(0);
  const running = useRef(false);
  const qrBlockedRef = useRef(true), [qrBlocked, setQrBlocked] = useState(true);
  const blockQr = useCallback((blocked: boolean) => { qrBlockedRef.current = blocked; setQrBlocked(blocked); }, []);
  useEffect(() => {
    let live = true;
    setReady(false); setAttempt(null); setError("");
    if (!profile.data?._id) return;
    readOfflineCollection(profile.data._id, orderId).then(saved => { if (live) { setAttempt(saved); if (saved) { setAmountText(String(saved.amount)); setMethod(saved.method); setNote(saved.note || ""); } setReady(true); } }).catch(() => { if (live) setError("Could not read previous payment attempts. Retry before collecting."); });
    return () => { live = false; };
  }, [profile.data?._id, orderId, revision]);
  const amount = collectionAmount(amountText, query.data?.dueAmount || 0, method, note);
  const valid = Boolean(attempt) || amount !== null;
  const collect = async () => {
    if (!ready || !profile.data?._id || !valid || running.current || qrBlockedRef.current) return;
    running.current = true; setBusy(true); setError("");
    const request: OfflineCollection = attempt || { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2).padEnd(16, "0")}`, amount: amount!, method, note: note.trim() };
    setAttempt(request);
    try {
      await saveOfflineCollection(profile.data._id, orderId, request);
      await api.post(url, { amount: request.amount, method: request.method, note: request.note, clientRequestId: request.id });
      await clearOfflineCollection(profile.data._id, orderId).catch(() => {});
      setAttempt(null); setAmountText(""); setNote("");
      toast.success("Collection recorded", `${money(request.amount)} · awaiting office verification`);
      await Promise.all(["collections", "orders", "dashboard", "history"].map(key => client.invalidateQueries({ queryKey: [key] })));
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status;
      if (status && [400, 403, 404].includes(status)) { await clearOfflineCollection(profile.data._id, orderId).catch(() => {}); setAttempt(null); }
      setError(getErrorMessage(e));
      await query.refetch();
    } finally { running.current = false; setBusy(false); }
  };
  return <View className="rounded-2xl border border-sand bg-white p-4"><View className="flex-row flex-wrap items-center justify-between gap-2"><Text className="shrink font-display-bold text-base text-ink">Collections and payment history</Text><Button label="Refresh payments" size="sm" variant="outline" disabled={busy} loading={query.isRefetching} onPress={() => query.refetch()} /></View>{query.isPending ? <Text className="mt-2 font-sans text-sm text-ink-500">Loading collections…</Text> : query.isError ? <Button label="Retry payment history" variant="outline" onPress={() => query.refetch()} /> : <>
    <View className="my-3 gap-1">{[["Order total", query.data.totalAmount], ["Recorded", query.data.recordedAmount], ["Verified", query.data.verifiedAmount], ["Pending verification", query.data.pendingVerificationAmount], ["Outstanding", query.data.dueAmount]].map(([label, value]) => <View key={String(label)} className="flex-row justify-between"><Text className="font-sans text-xs text-ink-500">{label}</Text><Text className="font-sans-bold text-xs text-ink">{money(Number(value))}</Text></View>)}</View>
    <Text className="mb-3 font-sans text-xs text-ink-500">Collections belong to the original sales agent's eligible sales. You remain the recorded collector. Cash and recorded UPI require office verification.</Text>
    <DeliveryQrCollection actorId={profile.data?._id} orderId={orderId} amountText={amountText} dueAmount={query.data.dueAmount} disabled={busy || Boolean(attempt) || !ready} onBlocked={blockQr} onRecorded={() => { setAmountText(""); setNote(""); }} />
    {(query.data.dueAmount > 0 || attempt) && <View className="gap-3 border-t border-sand pt-3">
      <Text className="font-sans-semibold text-sm text-ink">{attempt ? `Retry saved ${attempt.method} collection of ${money(attempt.amount)}` : "Record a partial or full collection"}</Text>
      <Text className="font-sans-semibold text-xs text-ink-700">Collection amount (required)</Text>
      <TextInput accessibilityLabel="Collection amount" keyboardType="decimal-pad" editable={!busy && !attempt && ready && !qrBlocked} value={amountText} onChangeText={setAmountText} placeholder="Enter a partial or full collection amount" className="rounded-xl border border-sand bg-cream px-3 py-3 font-sans text-ink" />
      {!attempt && <Button label={`Use full balance (${money(query.data.dueAmount)})`} size="sm" variant="outline" disabled={busy || !ready || qrBlocked} onPress={() => setAmountText(String(query.data.dueAmount))} />}
      <View className="flex-row gap-3">{(["CASH", "UPI"] as const).map(value => <Pressable key={value} disabled={busy || Boolean(attempt) || qrBlocked} onPress={() => setMethod(value)} className={`rounded-lg border px-4 py-2 ${method === value ? "border-cardamom-600 bg-cardamom-100" : "border-sand"}`}><Text className="font-sans-semibold text-sm text-ink">{value}</Text></Pressable>)}</View>
      <TextInput accessibilityLabel="Collection reference or note" editable={!busy && !attempt && !qrBlocked} value={note} onChangeText={setNote} maxLength={500} placeholder={method === "UPI" ? "UPI transaction reference (required)" : "Collection note (optional)"} className="rounded-lg border border-sand px-3 py-3 font-sans text-ink" />
      <Text className="font-sans text-xs text-ink-500">{attempt ? "Retry this saved request after an uncertain reply; it cannot record the same collection twice." : `Remaining after collection: ${money(Math.max(0, query.data.dueAmount - (amount ?? 0)))}`}</Text>
      <Button label={attempt ? "Retry Same Collection" : "Record Collection"} disabled={!ready || !valid || qrBlocked} loading={busy} onPress={collect} fullWidth />
    </View>}
    {query.data.dueAmount === 0 && !attempt && <Text className="font-sans-semibold text-sm text-cardamom-700">No outstanding balance.</Text>}
    {[...query.data.payments].reverse().slice(0, shown).map(payment => <View key={payment.id} className="mt-3 border-t border-sand pt-3"><Text className="font-sans-bold text-sm text-ink">{money(payment.amount)} · {payment.method}</Text><Text className="mt-1 font-sans text-xs text-ink-500">{formatDateTime(payment.collectedAt)} · {payment.verification || "Verified / legacy"}</Text><Text className="mt-1 font-sans text-xs text-ink-500">{payment.collector.role === "DELIVERY_PARTNER" ? "Delivery partner" : payment.collector.role === "AGENT" ? "Agent" : "Collector"}: {payment.collector.name || payment.collector.id || "Not recorded"}</Text></View>)}
    {shown < query.data.payments.length && <Button label="Show earlier collections" variant="outline" onPress={() => setShown(n => n + 10)} />}
  </>}{error && <Text accessibilityRole="alert" className="mt-3 rounded-lg bg-chili-100 p-3 font-sans text-xs text-chili-700">{error}</Text>}{!ready && !profile.isPending && <Button label="Retry collector recovery" variant="outline" onPress={() => { profile.refetch(); setRevision(n => n + 1); }} />}</View>;
}
