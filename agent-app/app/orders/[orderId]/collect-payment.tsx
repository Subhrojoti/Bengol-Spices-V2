import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Wallet2, Landmark, QrCode as QrCodeIcon, X, MapPin, Navigation } from "lucide-react-native";
import { Button, IconButton } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { RazorpayCheckout, type RazorpaySuccessPayload } from "@/components/payments/RazorpayCheckout";
import { QrPaymentModal } from "@/components/payments/QrPaymentModal";
import { UnrecordedPaymentModal } from "@/components/payments/UnrecordedPaymentModal";
import { useOrder, useRefreshAfterOrderActivity } from "@/hooks/useOrders";
import { orderApi } from "@/api/order.api";
import { formatCurrency } from "@/utils/currency";
import { getErrorMessage, isRetryableFailure, isSettledPaymentFailure } from "@/api/client";
import { toast } from "@/utils/toast";
import { openInMaps } from "@/utils/maps";
import { colors } from "@/theme/colors";
import { newRequestId } from "@/utils/requestId";
import { useProfile } from "@/hooks/useAgent";
import { readOfflineCollection, saveOfflineCollection, clearOfflineCollection, type OfflineCollection } from "@/utils/offlineCollection";
import { explicitPaymentAmount, collectionMonth } from "@/utils/paymentAmount";

type PaymentMethod = "CASH" | "ONLINE" | "QR";

/* A month's sales target counts only orders placed in that month (months
   as in India, whatever zone the phone is set to). Collecting on an older
   order clears a due and moves no target, and the agent is told so. */

/* An online payment Razorpay has taken that is not on the order yet, with
   everything needed to tell the server about it again. */
interface UnrecordedDuePayment {
  payment: RazorpaySuccessPayload;
  sessionAmount: number;
  orderId: string;
  due: number;
  problem: string;
}

export default function CollectPaymentRoute() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  return <CollectPaymentScreen key={orderId} orderId={orderId} />;
}
function CollectPaymentScreen({ orderId }: { orderId: string }) {
  const router = useRouter();
  const refreshAfterOrderActivity = useRefreshAfterOrderActivity();
  // The one order, from the copy a list already holds or read on its own
  const { data: order, isLoading, isError, error, refetch } = useOrder(orderId);
  const profile = useProfile();

  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [amountText, setAmountText] = useState("");
  const cashAttempt = useRef<OfflineCollection | null>(null);
  const cashRunning = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  useEffect(() => {
    let live = true;
    setRecoveryReady(false); cashAttempt.current = null; setRecoveryError("");
    if (!profile.data?._id) return;
    readOfflineCollection(profile.data._id, orderId).then(attempt => {
      if (attempt && attempt.method !== "CASH") throw new Error("Unsupported saved payment method");
      if (live) { cashAttempt.current = attempt; if (attempt) { setAmountText(String(attempt.amount)); setMethod("CASH"); } setRecoveryReady(true); }
    }).catch(() => { if (live) setRecoveryError("Could not read saved payment attempts. Please retry before collecting."); });
    return () => { live = false; };
  }, [profile.data?._id, orderId]);
  const enteredAmount = explicitPaymentAmount(amountText, Number(order?.dueAmount || 0), method === "CASH");
  const paymentAmount = cashAttempt.current?.amount ?? enteredAmount ?? 0;
  const validAmount = Boolean(cashAttempt.current) || enteredAmount !== null;
  const [submitting, setSubmitting] = useState(false);

  const [razorpaySession, setRazorpaySession] = useState<{ razorpayOrderId: string; amount: number; key: string } | null>(null);
  const [razorpayVisible, setRazorpayVisible] = useState(false);

  const [qrSession, setQrSession] = useState<{ qrCodeId: string; imageUrl: string; amount: number } | null>(null);
  const [qrVisible, setQrVisible] = useState(false);

  const [unrecorded, setUnrecorded] = useState<UnrecordedDuePayment | null>(null);

  // Opened from a link there is no screen behind this one, and back() failed
  // with "GO_BACK was not handled"; fall back to the order itself.
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/orders/${orderId}`));

  const handleCashSubmit = async () => {
    if (!order || !profile.data?._id || !recoveryReady || !validAmount || submitting || cashRunning.current) return;
    cashRunning.current = true;
    let completed = false;
    const attempt: OfflineCollection = cashAttempt.current || { id: newRequestId(), amount: paymentAmount, method: "CASH" };
    cashAttempt.current = attempt;
    setSubmitting(true);
    const month = collectionMonth(order.createdAt);
    const recorded = month === "EARLIER"
      ? `${formatCurrency(attempt.amount)} cash · the office will verify it. A due from an earlier month does not count toward this month's target.`
      : month === "CURRENT" ? `${formatCurrency(attempt.amount)} cash · counts toward your target once the office verifies it`
        : `${formatCurrency(attempt.amount)} cash · the office will verify it.`;
    try {
      await saveOfflineCollection(profile.data._id, orderId, attempt);
      await orderApi.collectCashPayment(order.orderId, attempt.amount, attempt.id);
      await clearOfflineCollection(profile.data._id, orderId).catch(() => {});
      cashAttempt.current = null;
      completed = true;
      if (!mounted.current) { refreshAfterOrderActivity(); return; }
      toast.success("Payment recorded", recorded);
      refreshAfterOrderActivity();
      setTimeout(() => { if (mounted.current) close(); }, 400);
    } catch (e) {
      refreshAfterOrderActivity();
      // Retain the same request identity for an uncertain reply. A changed
      // balance alone cannot prove which collector recorded a payment.
      if (!isRetryableFailure(e)) { await clearOfflineCollection(profile.data._id, orderId).catch(() => {}); cashAttempt.current = null; }
      if (mounted.current) toast.error("Couldn't record payment", getErrorMessage(e));
    } finally {
      if (!completed) { cashRunning.current = false; if (mounted.current) setSubmitting(false); }
    }
  };

  const handleOnlineSubmit = async () => {
    if (!order || !recoveryReady || cashAttempt.current || !validAmount || submitting) return;
    setSubmitting(true);
    try {
      const session = await orderApi.createDuePayment(order.orderId, paymentAmount);
      setRazorpaySession(session);
      setRazorpayVisible(true);
    } catch (e) {
      toast.error("Couldn't start payment", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  /* Tells the server about a payment Razorpay has taken for this order's
     due. Called when the checkout succeeds, and again from "Try again" for a
     payment whose confirmation got no answer. */
  const confirmDuePayment = async (attempt: Omit<UnrecordedDuePayment, "problem">) => {
    setSubmitting(true);
    try {
      await orderApi.verifyRazorpayDuePayment({
        razorpay_order_id: attempt.payment.razorpay_order_id,
        razorpay_payment_id: attempt.payment.razorpay_payment_id,
        razorpay_signature: attempt.payment.razorpay_signature,
        orderId: attempt.orderId,
        amount: attempt.sessionAmount,
      });
      setUnrecorded(null);
      // 🔥 FIX: was displaying razorpaySession.amount, echoed back from the
      // backend's Razorpay session response — if that response happens to
      // be in paise rather than rupees, this showed a 100x-inflated
      // number ("paid ₹10" appearing as "₹1000"). Displaying the amount
      // this screen itself already knows is in rupees instead, rather
      // than trusting the round-trip.
      toast.success("Payment received", formatCurrency(attempt.due));
      refreshAfterOrderActivity();
      setTimeout(close, 400);
    } catch (e) {
      const problem = getErrorMessage(e);
      /* No answer, or "try again": the money is taken and the order still
         shows it as owed. The payment is kept so the same confirmation can
         be sent again. It used to be dropped here, and all that was left on
         screen was the button that pays a second time. */
      if (isRetryableFailure(e) && !isSettledPaymentFailure(e)) {
        setUnrecorded({ ...attempt, problem });
      } else {
        // Refused outright (and refunded, where money had been taken)
        setUnrecorded(null);
        toast.error("Couldn't confirm payment", problem);
        refreshAfterOrderActivity();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRazorpaySuccess = async (payload: RazorpaySuccessPayload) => {
    if (!order || !razorpaySession) return;
    setRazorpayVisible(false);
    await confirmDuePayment({
      payment: payload,
      sessionAmount: razorpaySession.amount,
      orderId: order.orderId,
      due: razorpaySession.amount / 100,
    });
  };

  const handleGenerateQr = async () => {
    if (!order || !recoveryReady || cashAttempt.current || !validAmount || submitting) return;
    setSubmitting(true);
    try {
      const session = await orderApi.createDuePaymentQr(order.orderId, paymentAmount);
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
    const dueAmountAtTimeOfPayment = qrSession.amount;
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

        {(!recoveryReady || recoveryError || profile.isError) && <Text className="mt-4 font-sans text-sm text-chili-600">{recoveryError || (profile.isError ? "Could not verify your collector profile. Reload before collecting." : "Checking for a previous payment attempt…")}</Text>}
        <View className="mt-5 rounded-xl border border-sand bg-white p-4">
          <Text className="font-sans-semibold text-sm text-ink">Amount to collect (required)</Text>
          <TextInput accessibilityLabel="Payment amount" keyboardType="decimal-pad" value={amountText} editable={!submitting && !cashAttempt.current && recoveryReady} onChangeText={setAmountText} placeholder="Enter the amount actually received" className="mt-2 rounded-lg border border-sand px-3 py-3 font-sans text-ink" />
          {!cashAttempt.current && <Button label={`Use full balance (${formatCurrency(order.dueAmount)})`} size="sm" variant="outline" className="mt-3" disabled={submitting || !recoveryReady} onPress={() => setAmountText(String(order.dueAmount))} />}
          <Text className="mt-2 font-sans text-xs text-ink-500">{cashAttempt.current ? "Previous reply was uncertain. Retry the same payment before recording another collection." : `Balance after this payment: ${formatCurrency(Math.max(0, order.dueAmount - (validAmount ? paymentAmount : 0)))}`}</Text>
          {!validAmount && <Text className="mt-2 font-sans text-xs text-chili-600">Enter a valid amount up to the outstanding balance.</Text>}
        </View>
        <View className="mt-5">
          <SegmentedControl<PaymentMethod>
            segments={[
              { value: "CASH", label: "Cash" },
              { value: "ONLINE", label: "Online" },
              { value: "QR", label: "QR" },
            ]}
            value={method}
            onChange={value => { if (!submitting && !cashAttempt.current) setMethod(value); }}
          />
        </View>

        {method === "CASH" ? (
          <View className="mt-5">
            <View className="mb-4 flex-row items-center justify-between rounded-xl border border-sand-dark bg-white px-4 py-3.5">
              <View className="flex-row items-center gap-2.5">
                <Wallet2 size={16} color={colors.ink[500]} />
                <Text className="font-sans-semibold text-sm text-ink-700">Amount to Collect</Text>
              </View>
              <Text className="font-display-bold text-lg text-ink">{formatCurrency(paymentAmount)}</Text>
            </View>
            <Button label={cashAttempt.current ? "Retry Same Cash Payment" : "Record Cash Payment"} onPress={handleCashSubmit} disabled={!validAmount || !recoveryReady} loading={submitting} fullWidth size="lg" />
          </View>
        ) : method === "ONLINE" ? (
          <View className="mt-5">
            <Text className="mb-3 font-sans text-xs text-ink-500">For emergencies — you pay on the store owner's behalf using your own card/UPI.</Text>
            <View className="mb-4 flex-row items-center justify-between rounded-xl border border-sand-dark bg-white px-4 py-3.5">
              <View className="flex-row items-center gap-2.5">
                <Landmark size={16} color={colors.ink[500]} />
                <Text className="font-sans-semibold text-sm text-ink-700">Amount to Pay</Text>
              </View>
              <Text className="font-display-bold text-lg text-ink">{formatCurrency(paymentAmount)}</Text>
            </View>
            <Button label="Pay via Razorpay" onPress={handleOnlineSubmit} disabled={!validAmount} loading={submitting} fullWidth size="lg" />
          </View>
        ) : (
          <View className="mt-5">
            <View className="mb-4 flex-row items-center gap-2.5 rounded-xl bg-saffron-50 p-3.5">
              <QrCodeIcon size={18} color={colors.saffron[600]} />
              <Text className="flex-1 font-sans text-xs text-ink-700">
                This QR collects {formatCurrency(paymentAmount)} in one scan. You can collect another instalment later.
              </Text>
            </View>
            <Button label="Generate QR Code" icon={<QrCodeIcon size={16} color={colors.white} />} onPress={handleGenerateQr} disabled={!validAmount} loading={submitting} fullWidth size="lg" />
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

      <UnrecordedPaymentModal
        visible={!!unrecorded}
        amount={unrecorded?.due ?? 0}
        reference={unrecorded?.payment.razorpay_payment_id ?? ""}
        pending="it has not been recorded on this order yet"
        problem={unrecorded?.problem}
        busy={submitting}
        onRetry={() => {
          if (unrecorded) void confirmDuePayment(unrecorded);
        }}
        onGiveUp={() => setUnrecorded(null)}
      />
    </SafeAreaView>
  );
}
