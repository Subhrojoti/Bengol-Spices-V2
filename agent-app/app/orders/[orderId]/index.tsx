import { useState } from "react";
import { View, Text, Image, ScrollView, RefreshControl, Modal, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, MapPin, FileDown, Wallet2, Navigation, Package, Undo2, X } from "lucide-react-native";
import { IconButton, Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useMyOrders } from "@/hooks/useOrders";
import { useInitiateReturn, useMyReturns } from "@/hooks/useReturns";
import { useInvoiceDownload } from "@/hooks/useInvoiceDownload";
import { formatCurrency } from "@/utils/currency";
import { formatQuantity } from "@/utils/uom";
import { formatDateTime } from "@/utils/date";
import { getErrorMessage } from "@/api/client";
import { openInMaps } from "@/utils/maps";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";

const STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "info"> = {
  DELIVERED: "success",
  CANCELLED: "danger",
  PLACED: "info",
  CONFIRMED: "info",
  ASSIGNED: "warning",
  SHIPPED: "warning",
  OUT_FOR_DELIVERY: "warning",
};

const RETURN_STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "info"> = {
  COMPLETED: "success",
  REFUND_PROCESSED: "success",
  CANCELLED: "danger",
  INITIATED: "info",
  PICKUP_ASSIGNED: "warning",
  PICKED_UP: "warning",
  RECEIVED_AT_WAREHOUSE: "warning",
};

const MIN_REASON_LENGTH = 5;

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { data: orders, isLoading, isError, isFetching, refetch, error } = useMyOrders();
  const { data: returns } = useMyReturns();
  const { downloadInvoice, downloading } = useInvoiceDownload();
  const initiateReturn = useInitiateReturn();

  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  const order = orders?.find((o) => o.orderId === orderId);
  // The backend allows one open return per order. The list is newest first,
  // so this is the latest one; once that is cancelled, a new return can be
  // requested.
  const existingReturn = returns?.find((r) => r.orderId === orderId);
  const canRequestReturn = order?.status === "DELIVERED" && (!existingReturn || existingReturn.status === "CANCELLED");

  const closeReturnModal = () => {
    if (initiateReturn.isPending) return;
    setReturnModalVisible(false);
    setReason("");
    setReasonError(null);
  };

  const submitReturn = async () => {
    if (!order) return;
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH) {
      setReasonError(`Please describe the reason (at least ${MIN_REASON_LENGTH} characters).`);
      return;
    }
    try {
      const result = await initiateReturn.mutateAsync({ orderId: order.orderId, reason: trimmed });
      setReturnModalVisible(false);
      setReason("");
      setReasonError(null);
      toast.success("Return requested", `Return ${result.returnId} has been initiated.`);
    } catch (e) {
      toast.error("Couldn't request return", getErrorMessage(e));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-2 px-5 pt-2">
        <IconButton onPress={() => router.back()} className="bg-white">
          <ChevronLeft size={22} color={colors.ink.DEFAULT} />
        </IconButton>
        <Text className="font-display-bold text-xl text-ink">{orderId}</Text>
      </View>

      {isLoading ? (
        <LoadingState message="Loading order…" />
      ) : isError || !order ? (
        <ErrorState message={isError ? getErrorMessage(error, "Couldn't load this order.") : "Couldn't find this order."} onRetry={refetch} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 14 }}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.saffron[600]} />}
        >
          <Card>
            <View className="flex-row items-start justify-between">
              <View>
                <Text className="font-display-bold text-lg text-ink">{order.orderId}</Text>
                <Text className="mt-0.5 font-sans text-xs text-ink-500">{formatDateTime(order.createdAt)}</Text>
              </View>
              <Badge label={order.status.replace(/_/g, " ")} variant={STATUS_VARIANT[order.status] ?? "info"} />
            </View>
            {order.deliveryAddress ? (
              <View className="mt-3 flex-row items-start gap-2">
                <MapPin size={14} color={colors.ink[500]} />
                <Text className="flex-1 font-sans text-xs text-ink-500">
                  {order.deliveryAddress.street}, {order.deliveryAddress.city}, {order.deliveryAddress.state} - {order.deliveryAddress.pincode}
                </Text>
              </View>
            ) : null}
            {order.orderLocation ? (
              <Button
                label="Navigate to Store"
                variant="outline"
                size="sm"
                icon={<Navigation size={14} color={colors.ink.DEFAULT} />}
                onPress={() => openInMaps(order.orderLocation!.latitude, order.orderLocation!.longitude, order.deliveryAddress?.storeName)}
                className="mt-3"
              />
            ) : null}
          </Card>

          <Card>
            <View className="mb-3 flex-row items-center gap-2">
              <Package size={16} color={colors.ink[700]} />
              <Text className="font-display-bold text-base text-ink">Products</Text>
            </View>
            {order.products.map((item, idx) => (
              <View key={idx} className={`flex-row items-center gap-3 py-2 ${idx < order.products.length - 1 ? "border-b border-sand" : ""}`}>
                {item.image ? (
                  <Image source={{ uri: item.image }} className="h-12 w-12 rounded-lg" />
                ) : (
                  <View className="h-12 w-12 items-center justify-center rounded-lg bg-sand">
                    <Package size={16} color={colors.ink[500]} />
                  </View>
                )}
                <View className="flex-1 pr-3">
                  <Text className="font-sans-semibold text-sm text-ink" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="font-sans text-xs text-ink-500">
                    {formatQuantity(item.quantity, item.uom)} × {formatCurrency(item.unitPrice)}
                  </Text>
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
            <SummaryRow label="Due Date" value={formatDateTime(order.dueDate)} />
            <SummaryRow label="Payment Mode" value={order.paymentMode} />

            <Button label="Invoice" variant="outline" icon={<FileDown size={15} color={colors.ink.DEFAULT} />} onPress={() => downloadInvoice(order.orderId)} loading={downloading} fullWidth className="mt-3" />

            {/* A cancelled order keeps its due amount, but the backend refuses
                payment for it, so the button only led to an error */}
            {order.dueAmount > 0 && order.status !== "CANCELLED" ? (
              <Button
                label="Collect Payment"
                icon={<Wallet2 size={15} color={colors.white} />}
                onPress={() => router.push(`/orders/${order.orderId}/collect-payment`)}
                fullWidth
                className="mt-2.5"
              />
            ) : null}
          </Card>

          {order.status === "DELIVERED" || existingReturn ? (
            <Card>
              <View className="mb-3 flex-row items-center gap-2">
                <Undo2 size={16} color={colors.ink[700]} />
                <Text className="font-display-bold text-base text-ink">Return</Text>
              </View>

              {existingReturn ? (
                <>
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="font-sans-bold text-sm text-ink">{existingReturn.returnId}</Text>
                      <Text className="mt-0.5 font-sans text-xs text-ink-500">Requested {formatDateTime(existingReturn.createdAt)}</Text>
                    </View>
                    <Badge label={existingReturn.status.replace(/_/g, " ")} variant={RETURN_STATUS_VARIANT[existingReturn.status] ?? "info"} />
                  </View>
                  <Text className="mt-2 font-sans text-xs text-ink-700">{existingReturn.reason}</Text>
                  <Button label="View My Returns" variant="outline" size="sm" onPress={() => router.push("/returns")} className="mt-3" />
                  {canRequestReturn ? (
                    <Button
                      label="Request Return Again"
                      variant="outline"
                      icon={<Undo2 size={15} color={colors.ink.DEFAULT} />}
                      onPress={() => setReturnModalVisible(true)}
                      fullWidth
                      className="mt-2.5"
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <Text className="font-sans text-xs text-ink-500">This order was delivered. If the store needs to send products back, request a return here.</Text>
                  <Button
                    label="Request Return"
                    variant="outline"
                    icon={<Undo2 size={15} color={colors.ink.DEFAULT} />}
                    onPress={() => setReturnModalVisible(true)}
                    fullWidth
                    className="mt-3"
                  />
                </>
              )}
            </Card>
          ) : null}

          <Card>
            <Text className="mb-3 font-display-bold text-base text-ink">Status History</Text>
            {order.statusHistory.map((entry, idx) => (
              <View key={idx} className="flex-row gap-3 pb-3 last:pb-0">
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
        </ScrollView>
      )}

      <Modal visible={returnModalVisible && canRequestReturn} transparent animationType="fade" onRequestClose={closeReturnModal}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={closeReturnModal} />
          <View className="rounded-t-3xl bg-white px-5 pb-8 pt-4">
            <View className="mb-3 flex-row items-center justify-between">
              <View>
                <Text className="font-display-bold text-lg text-ink">Request Return</Text>
                <Text className="font-sans text-xs text-ink-500">Order {order?.orderId}</Text>
              </View>
              <IconButton onPress={closeReturnModal} className="bg-cream-100">
                <X size={18} color={colors.ink.DEFAULT} />
              </IconButton>
            </View>

            <Text className="mb-1.5 font-sans-semibold text-sm text-ink-700">
              Reason for return<Text className="text-chili-600"> *</Text>
            </Text>
            <View className={`rounded-xl border bg-white px-3.5 ${reasonError ? "border-chili-600" : "border-sand-dark"}`}>
              <TextInput
                value={reason}
                onChangeText={(t) => {
                  setReason(t);
                  if (reasonError) setReasonError(null);
                }}
                placeholder="e.g. Damaged packaging, wrong items delivered…"
                placeholderTextColor={colors.ink[300]}
                multiline
                numberOfLines={4}
                maxLength={500}
                editable={!initiateReturn.isPending}
                className="py-3 font-sans text-base text-ink"
                style={{ minHeight: 100, textAlignVertical: "top" }}
              />
            </View>
            {reasonError ? <Text className="mt-1.5 font-sans-medium text-xs text-chili-600">{reasonError}</Text> : null}

            <View className="mt-4 flex-row gap-3">
              <View className="flex-1">
                <Button label="Cancel" variant="outline" onPress={closeReturnModal} disabled={initiateReturn.isPending} fullWidth />
              </View>
              <View className="flex-1">
                <Button label="Submit Return" onPress={submitReturn} loading={initiateReturn.isPending} fullWidth />
              </View>
            </View>
          </View>
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
