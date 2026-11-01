import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { qrAmount, savedQr, type DeliveryQr } from "@/utils/qrPayment";
import { toast } from "@/utils/toast";

interface Props { actorId?: string; orderId: string; amountText: string; dueAmount: number; disabled: boolean; onBlocked: (blocked: boolean) => void; onRecorded: () => void }
const money = (amount: number) => `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export function DeliveryQrCollection({ actorId, orderId, amountText, dueAmount, disabled, onBlocked, onRecorded }: Props) {
  const [qr, setQr] = useState<DeliveryQr | null>(null), [visible, setVisible] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [revision, setRevision] = useState(0), [ratio, setRatio] = useState(0.77);
  const alive = useRef(true), running = useRef(false), client = useQueryClient(), window = useWindowDimensions();
  const key = `delivery-qr.${actorId || "unknown"}.${orderId}`.replace(/[^A-Za-z0-9._-]/g, "_");
  const base = `/delivery-partner/orders/${encodeURIComponent(orderId)}/payment-qr`;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let current = true; onBlocked(true); setReady(false); setQr(null);
    if (actorId) Promise.all([SecureStore.getItemAsync(key), api.get<{ qr: DeliveryQr | null }>(base)]).then(async ([value, response]) => {
      const recovered = value ? savedQr(value) : response.data.qr ? savedQr(JSON.stringify(response.data.qr)) : null;
      if (recovered) await SecureStore.setItemAsync(key, JSON.stringify(recovered));
      if (!current) return; setQr(recovered); setReady(true); setError(""); onBlocked(Boolean(recovered));
    }).catch(() => { if (current) setError("Could not restore QR recovery. Retry before collecting another payment."); });
    return () => { current = false; };
  }, [actorId, key, base, revision, onBlocked]);
  useEffect(() => { if (qr?.imageUrl) Image.getSize(qr.imageUrl, (width, height) => { if (alive.current && width > 0 && height > 0) setRatio(width / height); }, () => {}); }, [qr?.imageUrl]);
  const invalidate = useCallback(() => Promise.all(["collections", "orders", "dashboard", "history"].map(query => client.invalidateQueries({ queryKey: [query] }))), [client]);
  const remove = async () => {
    await SecureStore.deleteItemAsync(key);
    if (alive.current) { setQr(null); setVisible(false); setError(""); onBlocked(true); setReady(false); setRevision(n => n + 1); }
  };
  const check = async () => {
    if (!qr || running.current) return;
    running.current = true; if (alive.current) { setBusy(true); setError(""); }
    try {
      const response = await api.get<{ paid: boolean; closed: boolean; hasFunds: boolean }>(`${base}/${qr.qrCodeId}`);
      if (response.data.paid || response.data.hasFunds) {
        await api.post(`${base}/${qr.qrCodeId}/verify`);
        await invalidate(); await remove();
        if (alive.current) { onRecorded(); toast.success("UPI payment confirmed", `${money(qr.amount)} verified by the payment gateway`); }
      } else if (response.data.closed) {
        await remove();
        if (alive.current) setError("This QR closed without payment. Check the outstanding balance before generating another.");
      }
    } catch (e) {
      const body = (e as { response?: { data?: { refunded?: boolean; terminal?: boolean } } }).response?.data;
      if (body?.refunded === true || body?.terminal === true) { await remove(); await invalidate(); }
      if (alive.current) setError(getErrorMessage(e, "Could not confirm this QR. Retry it; do not collect again."));
    } finally { running.current = false; if (alive.current) setBusy(false); }
  };
  const checkRef = useRef(check); checkRef.current = check;
  useEffect(() => {
    if (!visible || !qr) return;
    const timer = setInterval(() => { void checkRef.current(); }, 3000);
    return () => clearInterval(timer);
  }, [visible, qr]);
  const open = async () => {
    if (!actorId || running.current || !ready) return;
    if (!qr && (disabled || qrAmount(amountText, dueAmount) === null)) return;
    running.current = true; setBusy(true); setError(""); onBlocked(true);
    let created = qr;
    try {
      if (!created) created = (await api.post<DeliveryQr>(base, { amount: qrAmount(amountText, dueAmount) })).data;
      // Persist before displaying a payable image. Resume/retry this identifier
      // after uncertain replies instead of asking the customer to pay twice.
      const validated = savedQr(JSON.stringify(created));
      if (alive.current) setQr(validated);
      await SecureStore.setItemAsync(key, JSON.stringify(validated));
      if (alive.current) setVisible(true);
    } catch (e) { if (alive.current) { setError(getErrorMessage(e)); onBlocked(Boolean(created)); } }
    finally { running.current = false; if (alive.current) setBusy(false); }
  };
  const closeUnpaid = async () => {
    if (!qr || running.current) return;
    running.current = true; setBusy(true); setError("");
    try {
      const result = await api.post<{ paid: boolean; closed: boolean }>(`${base}/${qr.qrCodeId}/close`);
      if (result.data.paid) { if (alive.current) setError("A payment reached this QR. Use Check payment to finish recording it; do not collect again."); }
      else if (result.data.closed) await remove();
    } catch (e) { if (alive.current) setError(getErrorMessage(e)); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  };
  const width = Math.max(160, Math.min(280, window.width - 80, window.height * 0.48 * ratio));
  return <View className="mb-3 gap-2">
    {!ready ? error ? <Button label="Retry QR recovery" variant="outline" disabled={!actorId} onPress={() => setRevision(n => n + 1)} /> : <Text className="font-sans text-xs text-ink-500">Loading QR recovery…</Text> : (qr || dueAmount >= 1) && <Button label={qr ? `Resume UPI QR (${money(qr.amount)})` : "Collect using UPI QR"} variant="secondary" loading={busy} disabled={!qr && (disabled || qrAmount(amountText, dueAmount) === null)} onPress={() => void open()} fullWidth />}
    {!qr && ready && dueAmount > 0 && <Text className="font-sans text-xs text-ink-500">Enter the collection amount below first. QR payments start at ₹1 and are confirmed by the gateway.</Text>}
    {qr && <Text className="font-sans-semibold text-xs text-saffron-700">A QR is pending. Resume it or close it safely before recording another collection.</Text>}
    {error && !visible && <Text accessibilityRole="alert" className="font-sans text-xs text-chili-700">{error}</Text>}
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setVisible(false)}><SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between gap-3 px-5 py-3"><Text className="shrink font-display-bold text-xl text-ink">UPI QR collection</Text><Button label="Hide QR" size="sm" variant="outline" onPress={() => setVisible(false)} /></View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <Text className="text-center font-sans text-sm text-ink-500">{orderId}</Text><Text className="font-display-bold text-3xl text-ink">{money(qr?.amount || 0)}</Text>
        {qr && <Image accessibilityLabel="UPI payment QR code" source={{ uri: qr.imageUrl }} resizeMode="contain" style={{ width, aspectRatio: ratio, borderRadius: 16, backgroundColor: "white" }} />}
        <Text className="text-center font-sans text-sm text-ink-500">Ask the customer to scan with their UPI app. Payment is recorded only after gateway confirmation.</Text>
        {busy && <ActivityIndicator />}{error && <Text accessibilityRole="alert" className="text-center font-sans text-sm text-chili-700">{error}</Text>}
        <Button label="Check payment" loading={busy} onPress={() => void check()} fullWidth />
        <Button label="Close unpaid QR" variant="outline" disabled={busy} onPress={() => void closeUnpaid()} fullWidth />
        <Text className="text-center font-sans text-xs text-ink-500">Hiding keeps this QR saved. If the customer already paid, retry this same QR instead of collecting again.</Text>
      </ScrollView>
    </SafeAreaView></Modal>
  </View>;
}
