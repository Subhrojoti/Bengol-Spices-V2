import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Wallet2, Landmark, QrCode as QrCodeIcon, X, MapPin, Navigation } from "lucide-react-native";
import { Button, IconButton } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { RazorpayCheckout, type RazorpaySuccessPayload } from "@/components/payments/RazorpayCheckout";
import { QrPaymentModal } from "@/components/payments/QrPaymentModal";
import { useMyOrders, useRefreshAfterOrderActivity } from "@/hooks/useOrders";
import { orderApi } from "@/api/order.api";
import { formatCurrency } from "@/utils/currency";
import { getErrorMessage, isSettledPaymentFailure } from "@/api/client";
import { toast } from "@/utils/toast";
import { openInMaps } from "@/utils/maps";
import { colors } from "@/theme/colors";

type PaymentMethod = "CASH" | "ONLINE" | "QR";

/* A month's sales target counts only orders placed in that month (months
   as in India, whatever zone the phone is set to). Collecting on an older
   order clears a due and moves no target, and the agent is told so. */
const indianMonth = (instant: string | number | Date) => new Date(new Date(instant).getTime() + 330 * 60 * 1000).toISOString().slice(0, 7);
const isFromEarlierMonth = (placedAt: string | Date) => indianMonth(placedAt) < indianMonth(Date.now());

export default function CollectPaymentScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const refreshAfterOrderActivity = useRefreshAfterOrderActivity();
  const { data: orders, isLoading, isError, error, refetch } = useMyOrders();
  const order = orders?.find((o) => o.orderId === orderId);

  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [submitting, setSubmitting] = useState(false);

  const [razorpaySession, setRazorpaySession] = useState<{ razorpayOrderId: string; amount: number; key: string } | null>(null);
  const [razorpayVisible, setRazorpayVisible] = useState(false);

  const [qrSession, setQrSession] = useState<{ qrCodeId: string; imageUrl: string; amount: number } | null>(null);
  const [qrVisible, setQrVisible] = useState(false);

  // Opened from a link there is no screen behind this one, and back() failed
  // with "GO_BACK was not handled"; fall back to the order itself.
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/orders/${orderId}`));

  // 🔥 FIX: Collect Payment now always collects the FULL due amount for
  // every method — Cash, Online, and QR. Partial amounts are only ever
  // entered once, at order creation. No editable amount field anymore.
  const handleCashSubmit = async () => {
    if (!order) return;
    setSubmitting(true);
    try {
      await orderApi.collectCashPayment(order.orderId, order.dueAmount);
      toast.success(
        "Payment recorded",
        isFromEarlierMonth(order.createdAt)
          ? `${formatCurrency(order.dueAmount)} cash · the office will verify it. A due from an earlier month does not count toward this month's target.`
          : `${formatCurrency(order.dueAmount)} cash · counts toward your target once the office verifies it`,
      );
      refreshAfterOrderActivity();
      setTimeout(close, 400);
    } catch (e) {
      toast.error("Couldn't record payment", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOnlineSubmit = async () => {
    if (!order) return;
    setSubmitting(true);
    try {
      const session = await orderApi.createDuePayment(order.orderId, order.dueAmount);
      setRazorpaySession(session);
      setRazorpayVisible(true);
    } catch (e) {
      toast.error("Couldn't start payment", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRazorpaySuccess = async (payload: RazorpaySuccessPayload) => {
    if (!order || !razorpaySession) return;
    const dueAmountAtTimeOfPayment = order.dueAmount;
    setRazorpayVisible(false);
    setSubmitting(true);
    try {
      await orderApi.verifyRazorpayDuePayment({
        razorpay_order_id: payload.razorpay_order_id,
        razorpay_payment_id: payload.razorpay_payment_id,
        razorpay_signature: payload.razorpay_signature,
        orderId: order.orderId,
        amount: razorpaySession.amount,
      });
      // 🔥 FIX: was displaying razorpaySession.amount, echoed back from the
      // backend's Razorpay session response — if that response happens to
      // be in paise rather than rupees, this showed a 100x-inflated
      // number ("paid ₹10" appearing as "₹1000"). Displaying the amount
      // this screen itself already knows is in rupees instead, rather
      // than trusting the round-trip.
      toast.success("Payment received", formatCurrency(dueAmountAtTimeOfPayment));
      refreshAfterOrderActivity();
      setTimeout(close, 400);
    } catch (e) {
      toast.error("Couldn't confirm payment", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateQr = async () => {
    if (!order) return;
    setSubmitting(true);
    try {
      const session = await orderApi.createDuePaymentQr(order.orderId);
      setQrSession(session);
      setQrVisible(true);
    } catch (e) {
      toast.error("Couldn't generate QR code", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  // Resolves whether the payment was recorded, so the QR modal can offer a
  // retry for money that was received but not yet recorded.
  const handleQrPaid = async (): Promise<boolean> => {
    if (!order || !qrSession) return false;
    const dueAmountAtTimeOfPayment = order.dueAmount;
    try {
      await orderApi.verifyDueQrPayment(qrSession.qrCodeId, order.orderId);
      refreshAfterOrderActivity();
      setQrVisible(false);
      toast.success("Payment received", formatCurrency(dueAmountAtTimeOfPayment));
      setTimeout(close, 400);
      return true;
    } catch (e) {
      toast.error("Couldn't confirm QR payment", getErrorMessage(e));
      // Refunded, or passed to the office: a retry cannot record it, so close
      if (isSettledPaymentFailure(e)) {
        setQrVisible(false);
        return true;
      }
      return false;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
        <LoadingState message="Loading order…" />
      </SafeAreaView>
    );
  }

  // 🔥 FIX: a failed orders request, or an order missing from the list, used
  // to leave this screen on "Loading order…" forever with no way out.
  if (!order) {
    return (
      <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
        <View className="flex-row items-center justify-between px-5 pt-3">
          <Text className="font-display-bold text-xl text-ink">Collect Payment</Text>
          <IconButton onPress={close} className="bg-white">
            <X size={18} color={colors.ink.DEFAULT} />
          </IconButton>
        </View>
        <ErrorState
          message={isError ? getErrorMessage(error, "Couldn't load this order.") : "Couldn't find this order."}
          onRetry={refetch}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 pt-3">
        <Text className="font-display-bold text-xl text-ink">Collect Payment</Text>
        <IconButton onPress={close} className="bg-white">
          <X size={18} color={colors.ink.DEFAULT} />
        </IconButton>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="rounded-2xl border border-sand bg-white p-4">
          <Text className="font-sans text-xs text-ink-500">Due Amount</Text>
          <Text className="mt-1 font-display-black text-3xl text-chili-600">{formatCurrency(order.dueAmount)}</Text>
          <Text className="mt-1 font-sans text-xs text-ink-500">{order.orderId}</Text>

          {order.deliveryAddress ? (
            <View className="mt-3 border-t border-sand pt-3">
              <Text className="font-sans-semibold text-sm text-ink-700">{order.deliveryAddress.storeName}</Text>
              <View className="mt-1 flex-row items-start gap-1.5">
                <MapPin size={13} color={colors.ink[500]} />
                <Text className="flex-1 font-sans text-xs text-ink-500">
                  {order.deliveryAddress.street}, {order.deliveryAddress.city}, {order.deliveryAddress.state} - {order.deliveryAddress.pincode}
                </Text>
              </View>
              {order.orderLocation ? (
                <Button
                  label="Navigate to Store"
                  variant="outline"
                  size="sm"
                  icon={<Navigation size={14} color={colors.ink.DEFAULT} />}
                  onPress={() => openInMaps(order.orderLocation!.latitude, order.orderLocation!.longitude, order.deliveryAddress!.storeName)}
                  className="mt-3"
                />
              ) : null}
            </View>
          ) : null}
        </View>

        <View className="mt-5">
          <SegmentedControl<PaymentMethod>
            segments={[
              { value: "CASH", label: "Cash" },
              { value: "ONLINE", label: "Online" },
              { value: "QR", label: "QR" },
            ]}
            value={method}
            onChange={setMethod}
          />
        </View>

        {method === "CASH" ? (
          <View className="mt-5">
            <View className="mb-4 flex-row items-center justify-between rounded-xl border border-sand-dark bg-white px-4 py-3.5">
              <View className="flex-row items-center gap-2.5">
                <Wallet2 size={16} color={colors.ink[500]} />
                <Text className="font-sans-semibold text-sm text-ink-700">Amount to Collect</Text>
              </View>
              <Text className="font-display-bold text-lg text-ink">{formatCurrency(order.dueAmount)}</Text>
            </View>
            <Button label="Record Cash Payment" onPress={handleCashSubmit} loading={submitting} fullWidth size="lg" />
          </View>
        ) : method === "ONLINE" ? (
          <View className="mt-5">
            <Text className="mb-3 font-sans text-xs text-ink-500">For emergencies — you pay on the store owner's behalf using your own card/UPI.</Text>
            <View className="mb-4 flex-row items-center justify-between rounded-xl border border-sand-dark bg-white px-4 py-3.5">
              <View className="flex-row items-center gap-2.5">
                <Landmark size={16} color={colors.ink[500]} />
                <Text className="font-sans-semibold text-sm text-ink-700">Amount to Pay</Text>
              </View>
              <Text className="font-display-bold text-lg text-ink">{formatCurrency(order.dueAmount)}</Text>
            </View>
            <Button label="Pay via Razorpay" onPress={handleOnlineSubmit} loading={submitting} fullWidth size="lg" />
          </View>
        ) : (
          <View className="mt-5">
            <View className="mb-4 flex-row items-center gap-2.5 rounded-xl bg-saffron-50 p-3.5">
              <QrCodeIcon size={18} color={colors.saffron[600]} />
              <Text className="flex-1 font-sans text-xs text-ink-700">
                The store owner must pay the full due amount, {formatCurrency(order.dueAmount)}, in one scan — partial QR payments aren't supported.
              </Text>
            </View>
            <Button label="Generate QR Code" icon={<QrCodeIcon size={16} color={colors.white} />} onPress={handleGenerateQr} loading={submitting} fullWidth size="lg" />
          </View>
        )}
      </ScrollView>

      {razorpaySession ? (
        <RazorpayCheckout
          visible={razorpayVisible}
          orderId={razorpaySession.razorpayOrderId}
          amountInPaise={razorpaySession.amount}
          keyId={razorpaySession.key}
          onSuccess={handleRazorpaySuccess}
          onDismiss={() => setRazorpayVisible(false)}
        />
      ) : null}

      <QrPaymentModal
        visible={qrVisible}
        qrCodeId={qrSession?.qrCodeId ?? null}
        imageUrl={qrSession?.imageUrl ?? null}
        amount={qrSession?.amount ?? 0}
        subtitle="Remaining balance for this order"
        onClose={() => setQrVisible(false)}
        onPaid={handleQrPaid}
      />
    </SafeAreaView>
  );
}
