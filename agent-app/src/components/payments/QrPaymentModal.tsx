import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Modal, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, CheckCircle2, QrCode as QrCodeIcon, RotateCw } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { orderApi } from "@/api/order.api";
import { formatCurrency } from "@/utils/currency";
import { getErrorMessage } from "@/api/client";
import { colors } from "@/theme/colors";

const POLL_INTERVAL_MS = 3000;
// Razorpay's branded QR image is a tall portrait card (logo header, QR
// pattern, UPI app icons, business name) — this is a reasonable default
// aspect ratio (width/height) used until the real image loads and reports
// its actual dimensions, at which point it's corrected automatically.
const DEFAULT_QR_ASPECT_RATIO = 0.56;
const QR_WIDTH = Math.min(300, Dimensions.get("window").width - 80);

interface QrPaymentModalProps {
  visible: boolean;
  qrCodeId: string | null;
  imageUrl: string | null;
  amount: number;
  /** Shown under the amount — customize per flow (e.g. "for this order" vs "remaining balance"). */
  subtitle?: string;
  onClose: () => void;
  /**
   * Called once polling confirms the QR has been paid, to record the payment.
   * Resolves true when it was recorded; false leaves a "Try again" button.
   */
  onPaid: () => Promise<boolean>;
}

export function QrPaymentModal({ visible, qrCodeId, imageUrl, amount, subtitle, onClose, onPaid }: QrPaymentModalProps) {
  const [paid, setPaid] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmFailed, setConfirmFailed] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_QR_ASPECT_RATIO);
  // Set the moment a poll first reports the QR paid, so it is acted on once
  const paidHandledRef = useRef(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  const confirmPayment = async () => {
    setConfirming(true);
    setConfirmFailed(false);
    const recorded = await onPaidRef.current().catch(() => false);
    setConfirming(false);
    if (!recorded) setConfirmFailed(true);
  };

  useEffect(() => {
    if (!imageUrl) return;
    Image.getSize(
      imageUrl,
      (width, height) => {
        if (width > 0 && height > 0) setAspectRatio(width / height);
      },
      () => {
        // Keep the default ratio if this fails — still looks reasonable.
      },
    );
  }, [imageUrl]);

  useEffect(() => {
    if (!visible || !qrCodeId) {
      return;
    }

    setPaid(false);
    setPollError(null);
    setConfirmFailed(false);
    paidHandledRef.current = false;

    // 🔥 FIX: a status check slower than the 3s interval overlapped the next
    // one, and both could report "paid" — recording the payment twice, which
    // for a new order could place the order twice. One check runs at a time
    // now, and only the first "paid" is acted on.
    let pollInFlight = false;
    let stopped = false;
    const interval = setInterval(async () => {
      if (pollInFlight || paidHandledRef.current) return;
      pollInFlight = true;
      try {
        const result = await orderApi.checkQrPaymentStatus(qrCodeId);
        if (stopped || !result.paid || paidHandledRef.current) return;
        paidHandledRef.current = true;
        clearInterval(interval);
        setPaid(true);
        // Brief pause so the person sees the "Paid" confirmation before we move on.
        // Not cancelled by closing the modal: the money has been received and
        // still has to be recorded.
        setTimeout(() => void confirmPayment(), 900);
      } catch (e) {
        // Transient network hiccups shouldn't stop polling — just surface a
        // quiet hint and keep trying on the next tick.
        if (!stopped) setPollError(getErrorMessage(e, "Having trouble checking payment status."));
      } finally {
        pollInFlight = false;
      }
    }, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, qrCodeId]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
        <View className="flex-row items-center justify-between px-5 pt-3">
          <Text className="font-display-bold text-xl text-ink">Scan to Pay</Text>
          <Pressable onPress={onClose} className="h-9 w-9 items-center justify-center rounded-full bg-white" hitSlop={8}>
            <X size={18} color={colors.ink.DEFAULT} />
          </Pressable>
        </View>

        <View className="flex-1 items-center justify-center px-8">
          {paid ? (
            <View className="items-center">
              <View className="h-20 w-20 items-center justify-center rounded-full bg-cardamom-100">
                <CheckCircle2 size={40} color={colors.cardamom[600]} />
              </View>
              <Text className="mt-4 font-display-bold text-xl text-ink">Payment Received</Text>
              <Text className="mt-1 font-sans text-sm text-ink-500">{formatCurrency(amount)} confirmed</Text>
              {confirming ? (
                <View className="mt-4 flex-row items-center gap-2">
                  <ActivityIndicator size="small" color={colors.saffron[600]} />
                  <Text className="font-sans-medium text-sm text-ink-500">Recording the payment…</Text>
                </View>
              ) : confirmFailed ? (
                <>
                  <Text className="mt-4 text-center font-sans text-xs text-chili-600">
                    The money was received but couldn't be recorded yet. Don't generate a new QR — try again here.
                  </Text>
                  <Button
                    label="Try again"
                    icon={<RotateCw size={15} color={colors.white} />}
                    onPress={() => void confirmPayment()}
                    className="mt-3"
                  />
                </>
              ) : null}
            </View>
          ) : (
            <>
              <Text className="font-sans-semibold text-sm text-ink-500">Amount to pay</Text>
              <Text className="mt-1 font-display-black text-4xl text-ink">{formatCurrency(amount)}</Text>
              {subtitle ? <Text className="mt-1 font-sans text-xs text-ink-500">{subtitle}</Text> : null}

              <View
                className="mt-6 items-center justify-center rounded-3xl border border-sand bg-white p-4"
                style={{ shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 }}
              >
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={{ width: QR_WIDTH, aspectRatio, borderRadius: 12 }}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={{ width: QR_WIDTH, aspectRatio }} className="items-center justify-center">
                    <QrCodeIcon size={48} color={colors.ink[300]} />
                  </View>
                )}
              </View>

              <View className="mt-5 flex-row items-center gap-2">
                <ActivityIndicator size="small" color={colors.saffron[600]} />
                <Text className="font-sans-medium text-sm text-ink-500">Waiting for payment…</Text>
              </View>
              <Text className="mt-2 text-center font-sans text-xs text-ink-500">
                Ask the store owner to scan this with any UPI app (Google Pay, PhonePe, Paytm). This updates automatically the moment they pay — no need to confirm manually.
              </Text>
              {pollError ? <Text className="mt-2 text-center font-sans text-xs text-chili-600">{pollError}</Text> : null}
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
