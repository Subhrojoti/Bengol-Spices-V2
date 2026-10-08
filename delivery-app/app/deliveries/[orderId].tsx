import { useState } from "react";
import { View, Text, ScrollView, RefreshControl, Alert, Modal, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Store, MapPin, Phone, Navigation, Package, ShieldCheck, X } from "lucide-react-native";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAssignedOrders, useUpdateDeliveryStatus } from "@/hooks/useOrders";
import { useDeliveryHistory } from "@/hooks/useProfile";
import { formatCurrency } from "@/utils/currency";
import { formatQuantity } from "@/utils/uom";
import { formatDateTime } from "@/utils/date";
import { openInMaps } from "@/utils/maps";
import { getErrorMessage } from "@/api/client";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";
import type { OrderStatus } from "@/types/api";

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  ASSIGNED: "SHIPPED",
  SHIPPED: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  ASSIGNED: "Mark as Shipped",
  SHIPPED: "Mark as Out for Delivery",
  OUT_FOR_DELIVERY: "Mark as Delivered",
};

const CODE_LENGTH = 6;

export default function DeliveryDetailScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { data: orders, isLoading, isError, isFetching, refetch, error } = useAssignedOrders();
  const { data: history } = useDeliveryHistory();
  const updateStatus = useUpdateDeliveryStatus();

  /* 🔥 FIX: the backend only marks an order delivered when it is sent the
     store's 6-digit delivery code, which the store owner reads out at
     handover. This screen never asked for it (it printed a code the backend
     no longer sends, so the box was blank) and sent the status on its own,
     so "Mark as Delivered" was refused every time. The code is now typed in
     here and sent with the status. */
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  // 🔥 FIX: an order disappears from useAssignedOrders() the moment it's
  // marked DELIVERED (that query only returns active work). Falling back
  // to history data means this screen still resolves correctly if reached
  // from the History tab, or if the active list hasn't refetched yet.
  const order = orders?.find((o) => o.orderId === orderId) ?? history?.deliveredOrders.find((o) => o.orderId === orderId);

  const closeCodeModal = () => {
    if (updateStatus.isPending) return;
    setCodeModalVisible(false);
    setCode("");
    setCodeError(null);
  };

  const submitDeliveryCode = async () => {
    if (!order) return;
    if (code.length !== CODE_LENGTH) {
      setCodeError(`Enter all ${CODE_LENGTH} digits of the delivery code.`);
      return;
    }
    try {
      await updateStatus.mutateAsync({ orderId: order.orderId, status: "DELIVERED", deliveryCode: code });
      setCodeModalVisible(false);
      setCode("");
      setCodeError(null);
      toast.success("Marked as DELIVERED");
      // Once DELIVERED, this order leaves the active list — staying on this
      // screen would show "couldn't find this delivery" on the next refetch.
      router.back();
    } catch (e) {
      // Shown inside the sheet: a toast would sit behind it. The message says
      // how many tries are left, or how long the delivery is locked for.
      setCodeError(getErrorMessage(e, "Couldn't confirm the delivery. Please try again."));
      setCode("");
    }
  };

  const handleUpdateStatus = () => {
    if (!order) return;
    const nextStatus = NEXT_STATUS[order.status];
    if (!nextStatus) return;

    // Delivery is confirmed with the store's code, not a plain "are you sure"
    if (nextStatus === "DELIVERED") {
      setCode("");
      setCodeError(null);
      setCodeModalVisible(true);
      return;
    }

    const confirmLabel = ACTION_LABEL[order.status] ?? "Update status";
    Alert.alert(confirmLabel, `Confirm this order is now ${nextStatus.replace(/_/g, " ").toLowerCase()}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            await updateStatus.mutateAsync({ orderId: order.orderId, status: nextStatus });
            toast.success(`Marked as ${nextStatus.replace(/_/g, " ")}`);
          } catch (e) {
            toast.error("Couldn't update status", getErrorMessage(e));
          }
        },
      },
    ]);
  };

  // Only while the order can still be delivered; a finished one needs no code
  const awaitingDelivery = order ? Boolean(NEXT_STATUS[order.status]) : false;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <AppHeader title={orderId ?? "Delivery"} showBack />

      {isLoading ? (
        <LoadingState message="Loading delivery…" />
      ) : isError || !order ? (
        <ErrorState message={isError ? getErrorMessage(error, "Couldn't load this delivery.") : "Couldn't find this delivery."} onRetry={refetch} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 14 }}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.saffron[600]} />}
        >
          <Card>
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-2">
                <Text className="font-display-bold text-lg text-ink">{order.orderId}</Text>
                <Text className="mt-0.5 font-sans text-xs text-ink-500">{formatDateTime(order.createdAt)}</Text>
              </View>
              <OrderStatusBadge status={order.status} />
            </View>

            <View className="mt-4 flex-row items-center gap-2">
              <Store size={14} color={colors.ink[500]} />
              <Text className="font-sans-semibold text-sm text-ink-700">{order.deliveryAddress.storeName}</Text>
            </View>
            <View className="mt-1.5 flex-row items-start gap-2">
              <MapPin size={14} color={colors.ink[500]} />
              <Text className="flex-1 font-sans text-xs text-ink-500">
                {order.deliveryAddress.street}, {order.deliveryAddress.city}, {order.deliveryAddress.state} - {order.deliveryAddress.pincode}
              </Text>
            </View>
            <View className="mt-1.5 flex-row items-center gap-2">
              <Phone size={14} color={colors.ink[500]} />
              <Text className="font-sans text-xs text-ink-500">{order.deliveryAddress.phone}</Text>
            </View>

            {awaitingDelivery ? (
              <View className="mt-4 flex-row items-center gap-2.5 rounded-2xl border border-saffron-600/25 bg-saffron-50 px-4 py-3">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-saffron-600">
                  <ShieldCheck size={16} color={colors.white} />
                </View>
                <View className="flex-1">
                  <Text className="font-sans-semibold text-xs text-saffron-700">Delivery Code</Text>
                  <Text className="font-sans text-[11px] leading-4 text-ink-500">
                    At handover, ask the store owner for their {CODE_LENGTH}-digit delivery code. You enter it to mark the order delivered.
                  </Text>
                </View>
              </View>
            ) : null}

            <Button
              label="Navigate to Store"
              variant="outline"
              icon={<Navigation size={15} color={colors.ink.DEFAULT} />}
              onPress={() => openInMaps(order.orderLocation.latitude, order.orderLocation.longitude, order.deliveryAddress.storeName)}
              fullWidth
              className="mt-3"
            />
          </Card>

          <Card>
            <View className="mb-3 flex-row items-center gap-2">
              <Package size={16} color={colors.ink[700]} />
              <Text className="font-display-bold text-base text-ink">Products</Text>
            </View>
            {order.products.map((item, idx) => (
              <View key={idx} className={`flex-row items-center justify-between py-2 ${idx < order.products.length - 1 ? "border-b border-sand" : ""}`}>
                <View className="flex-1 pr-3">
                  <Text className="font-sans-semibold text-sm text-ink" numberOfLines={1}>{item.name}</Text>
                  <Text className="font-sans text-xs text-ink-500">{formatQuantity(item.quantity, item.uom)} × {formatCurrency(item.unitPrice)}</Text>
                </View>
                <Text className="font-sans-bold text-sm text-ink">{formatCurrency(item.totalPrice)}</Text>
              </View>
            ))}
          </Card>

          <Card>
            <Text className="mb-3 font-display-bold text-base text-ink">Payment</Text>
            <SummaryRow label="Total Amount" value={formatCurrency(order.totalAmount)} bold />
            <SummaryRow label="Paid" value={formatCurrency(order.paidAmount)} tone="success" />
            <SummaryRow label="Due" value={formatCurrency(order.dueAmount)} tone={order.dueAmount > 0 ? "danger" : undefined} />
            <SummaryRow label="Payment Mode" value={order.paymentMode} />
          </Card>

          <Card>
            <Text className="mb-3 font-display-bold text-base text-ink">Status History</Text>
            {order.statusHistory.map((entry, idx) => (
              <View key={idx} className={`flex-row gap-3 ${idx < order.statusHistory.length - 1 ? "pb-3" : ""}`}>
                <View className="items-center">
                  <View className="h-2.5 w-2.5 rounded-full bg-saffron-600" />
                  {idx < order.statusHistory.length - 1 ? <View className="mt-1 h-9 w-px bg-sand-dark" /> : null}
                </View>
                <View className="-mt-1 flex-1">
                  <Text className="font-sans-semibold text-sm text-ink">{entry.status.replace(/_/g, " ")}</Text>
                  <Text className="font-sans text-xs text-ink-500">{formatDateTime(entry.changedAt)}</Text>
                </View>
              </View>
            ))}
          </Card>

          {NEXT_STATUS[order.status] ? (
            <Button
              label={ACTION_LABEL[order.status] ?? "Update Status"}
              onPress={handleUpdateStatus}
              loading={updateStatus.isPending && !codeModalVisible}
              fullWidth
              size="lg"
            />
          ) : null}
        </ScrollView>
      )}

      {/* The sheet sits near the top of the screen so the number pad, which
          covers the lower half, never hides the code box or the buttons. */}
      <Modal visible={codeModalVisible} transparent animationType="fade" onRequestClose={closeCodeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-black/50">
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 72, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <View className="rounded-3xl bg-white px-5 pb-5 pt-4">
              <View className="mb-2 flex-row items-center justify-between">
                <View className="flex-1 pr-2">
                  <Text className="font-display-bold text-lg text-ink">Confirm Delivery</Text>
                  <Text className="font-sans text-xs text-ink-500" numberOfLines={1}>
                    {order?.orderId} · {order?.deliveryAddress.storeName}
                  </Text>
                </View>
                <IconButton onPress={closeCodeModal} className="bg-cream-100">
                  <X size={18} color={colors.ink.DEFAULT} />
                </IconButton>
              </View>

              <Text className="font-sans text-sm leading-5 text-ink-700">
                Ask the store owner for their {CODE_LENGTH}-digit delivery code and enter it here.
              </Text>

              <View className={`mt-4 rounded-2xl border bg-white ${codeError ? "border-chili-600" : "border-sand-dark"}`}>
                <TextInput
                  value={code}
                  onChangeText={(text) => {
                    setCode(text.replace(/\D/g, "").slice(0, CODE_LENGTH));
                    if (codeError) setCodeError(null);
                  }}
                  placeholder="• • • • • •"
                  placeholderTextColor={colors.ink[300]}
                  keyboardType="number-pad"
                  maxLength={CODE_LENGTH}
                  autoFocus
                  editable={!updateStatus.isPending}
                  returnKeyType="done"
                  onSubmitEditing={submitDeliveryCode}
                  accessibilityLabel="Delivery code"
                  className="py-3.5 text-center font-display-bold text-2xl text-ink"
                  style={{ letterSpacing: 8 }}
                />
              </View>
              {codeError ? <Text className="mt-2 font-sans-medium text-xs leading-4 text-chili-600">{codeError}</Text> : null}

              <View className="mt-4 flex-row gap-3">
                <View className="flex-1">
                  <Button label="Cancel" variant="outline" onPress={closeCodeModal} disabled={updateStatus.isPending} fullWidth />
                </View>
                <View className="flex-1">
                  <Button
                    label="Confirm"
                    onPress={submitDeliveryCode}
                    loading={updateStatus.isPending}
                    disabled={code.length !== CODE_LENGTH}
                    fullWidth
                  />
                </View>
              </View>
            </View>
            <Pressable className="flex-1" onPress={closeCodeModal} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: "success" | "danger" }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="font-sans text-sm text-ink-500">{label}</Text>
      <Text className={`${bold ? "font-sans-bold" : "font-sans-semibold"} text-sm ${tone === "success" ? "text-cardamom-700" : tone === "danger" ? "text-chili-600" : "text-ink"}`}>
        {value}
      </Text>
    </View>
  );
}
