import { useRef, useState } from "react";
import { View, Text, ScrollView, RefreshControl, Alert, Modal, TextInput, Pressable, KeyboardAvoidingView, Platform, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Store, MapPin, Phone, Navigation, Package, ShieldCheck, TriangleAlert, PackageX, MapPinCheck, X } from "lucide-react-native";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAssignedOrders, useDeliveryRules, useReportCouldNotDeliver, useUpdateDeliveryStatus } from "@/hooks/useOrders";
import { useDeliveryHistory } from "@/hooks/useProfile";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { formatQuantity } from "@/utils/uom";
import { formatDateTime } from "@/utils/date";
import { openInMaps } from "@/utils/maps";
import { LOCATION_HELP, formatDistance, isAtStore, readLocation, type Fix } from "@/utils/location";
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
const NOTE_MAX = 300;
const DEFAULT_RADIUS_M = 60;
/* A reading the phone itself says may be this far out is not a position to
   judge anyone by. It is what Android gives an app allowed only
   "approximate" location (a couple of kilometres), or a phone deep indoors. */
const ROUGH_READING_M = 150;

/* Used until the server's own list has loaded; the server's wording wins. */
const FALLBACK_REASONS: Record<string, string> = {
  STORE_CLOSED: "Store was closed",
  NOBODY_TO_RECEIVE: "Nobody was there to receive it",
  STORE_REFUSED: "Store refused the order",
  STORE_NOT_FOUND: "Could not find the store",
  NO_DELIVERY_CODE: "Store could not give the delivery code",
  LOCATION_NOT_ACCEPTED: "The app would not accept my location at the store",
  OTHER: "Other",
};

export default function DeliveryDetailScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { data: orders, isLoading, isError, refetch, error } = useAssignedOrders();
  const { data: rules } = useDeliveryRules();
  const { data: history } = useDeliveryHistory();
  const updateStatus = useUpdateDeliveryStatus();
  const reportFailure = useReportCouldNotDeliver();
  const { pulling, onPull } = usePullToRefresh(refetch);

  /* 🔥 FIX: the backend only marks an order delivered when it is sent the
     store's 6-digit delivery code, which the store owner reads out at
     handover. This screen never asked for it (it printed a code the backend
     no longer sends, so the box was blank) and sent the status on its own,
     so "Mark as Delivered" was refused every time. The code is now typed in
     here and sent with the status. */
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  /* Where the phone was when "Mark as Delivered" was pressed. It is read
     before the code is asked for, so a partner who is not at the store is
     told so at once, and it is sent with the code. */
  const [locating, setLocating] = useState(false);
  const [fix, setFix] = useState<Fix | null>(null);
  const [place, setPlace] = useState<{ distance: number; near: boolean } | null>(null);
  const codeInput = useRef<TextInput>(null);

  // "Could not deliver"
  const [failVisible, setFailVisible] = useState(false);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [failNote, setFailNote] = useState("");
  const [failError, setFailError] = useState<string | null>(null);

  // 🔥 FIX: an order disappears from useAssignedOrders() the moment it's
  // marked DELIVERED (that query only returns active work). Falling back
  // to history data means this screen still resolves correctly if reached
  // from the History tab, or if the active list hasn't refetched yet.
  const order = orders?.find((o) => o.orderId === orderId) ?? history?.deliveredOrders.find((o) => o.orderId === orderId);

  const storePoint = order?.store?.location ?? order?.orderLocation ?? null;
  const report = order?.delivery?.couldNotDeliver;
  const waived = Boolean(order?.delivery?.locationWaiver?.at);
  const reasons = rules?.couldNotDeliverReasons ?? FALLBACK_REASONS;
  // Is this delivery refused unless the partner is at the store?
  const mustBeAtStore = Boolean(rules?.locationRequired) && !waived;
  const carrying = order?.status === "SHIPPED" || order?.status === "OUT_FOR_DELIVERY";

  const closeCodeModal = () => {
    if (updateStatus.isPending) return;
    setCodeModalVisible(false);
    setCode("");
    setCodeError(null);
  };

  const submitDeliveryCode = async () => {
    // One check at a time: the keyboard's Done key can be pressed again
    if (!order || updateStatus.isPending) return;
    if (code.length !== CODE_LENGTH) {
      setCodeError(`Enter all ${CODE_LENGTH} digits of the delivery code.`);
      return;
    }
    try {
      await updateStatus.mutateAsync({ orderId: order.orderId, status: "DELIVERED", deliveryCode: code, location: fix ?? undefined });
      setCodeModalVisible(false);
      setCode("");
      setCodeError(null);
      toast.success("Marked as DELIVERED");
      // Once DELIVERED, this order leaves the active list — staying on this
      // screen would show "couldn't find this delivery" on the next refetch.
      router.back();
    } catch (e) {
      // Shown inside the sheet: a toast would sit behind it. The message says
      // how many tries are left, how long the delivery is locked for, or how
      // far from the store the phone is.
      setCodeError(getErrorMessage(e, "Couldn't confirm the delivery. Please try again."));
      setCode("");
      // Ready for the next try without having to tap the box again
      setTimeout(() => codeInput.current?.focus(), 150);
    }
  };

  /* "Mark as Delivered": the phone's position first, then the store's code. */
  const startDelivery = async () => {
    if (!order || locating) return;

    setLocating(true);
    const result = await readLocation();
    setLocating(false);

    const tryAgain = { text: "Try again", onPress: () => void startDelivery() };
    const stuckHint = "\n\nIf you are at the store and this keeps happening, use “Could not deliver” below to tell the office.";

    if (!result.ok) {
      if (mustBeAtStore) {
        Alert.alert("Your location is needed", `${LOCATION_HELP[result.reason]}${stuckHint}`, [
          { text: "Cancel", style: "cancel" },
          ...(result.reason === "unavailable" ? [] : [{ text: "Open Settings", onPress: () => void Linking.openSettings() }]),
          tryAgain,
        ]);
        return;
      }
      setFix(null);
      setPlace(null);
    } else {
      const at = storePoint ? isAtStore(result.fix, storePoint, rules?.radiusMetres ?? DEFAULT_RADIUS_M) : null;

      if (mustBeAtStore && result.fix.mocked) {
        Alert.alert("Turn off fake location", "A fake-location (mock GPS) app is active on this phone. Turn it off, then try again at the store.", [
          { text: "OK", style: "cancel" },
          tryAgain,
        ]);
        return;
      }

      if (mustBeAtStore && at && !at.near && (result.fix.accuracy ?? 0) > ROUGH_READING_M) {
        Alert.alert(
          "Location is not precise enough",
          `Your phone only knows where it is to within about ${formatDistance(result.fix.accuracy ?? 0)}. Open Settings and make sure Bengol Delivery is allowed precise location, step outside if you are indoors, then try again.${stuckHint}`,
          [{ text: "Cancel", style: "cancel" }, { text: "Open Settings", onPress: () => void Linking.openSettings() }, tryAgain],
        );
        return;
      }

      if (mustBeAtStore && at && !at.near) {
        Alert.alert(
          "You are not at the store",
          `Your phone says you are about ${formatDistance(at.distance)} from ${order.deliveryAddress.storeName}. Go to the store, then try again.${stuckHint}`,
          [{ text: "OK", style: "cancel" }, tryAgain],
        );
        return;
      }

      setFix(result.fix);
      setPlace(at);
    }

    setCode("");
    setCodeError(null);
    setCodeModalVisible(true);
  };

  const handleUpdateStatus = () => {
    if (!order) return;
    const nextStatus = NEXT_STATUS[order.status];
    if (!nextStatus) return;

    // Delivery is confirmed at the store with the store's code, not a plain "are you sure"
    if (nextStatus === "DELIVERED") {
      void startDelivery();
      return;
    }

    const confirmLabel = ACTION_LABEL[order.status] ?? "Update status";
    Alert.alert(confirmLabel, `Confirm this order is now ${nextStatus.replace(/_/g, " ").toLowerCase()}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          // Where this step was taken, if the phone can say quickly. It is
          // never a reason to hold the step up.
          setLocating(true);
          const result = await readLocation(6000);
          setLocating(false);
          try {
            await updateStatus.mutateAsync({ orderId: order.orderId, status: nextStatus, location: result.ok ? result.fix : undefined });
            toast.success(`Marked as ${nextStatus.replace(/_/g, " ")}`);
          } catch (e) {
            toast.error("Couldn't update status", getErrorMessage(e));
          }
        },
      },
    ]);
  };

  const openFailSheet = () => {
    setFailReason(null);
    setFailNote("");
    setFailError(null);
    setFailVisible(true);
  };

  const closeFailSheet = () => {
    if (reportFailure.isPending || locating) return;
    setFailVisible(false);
  };

  const submitFailure = async () => {
    if (!order) return;
    const note = failNote.trim();
    if (!failReason) {
      setFailError("Choose what happened.");
      return;
    }
    if (failReason === "OTHER" && note.length < 5) {
      setFailError("Say in a few words what happened.");
      return;
    }

    setLocating(true);
    const result = await readLocation(6000);
    setLocating(false);

    try {
      await reportFailure.mutateAsync({ orderId: order.orderId, reason: failReason, note, location: result.ok ? result.fix : undefined });
      setFailVisible(false);
      toast.success("Reported to the office", "They will tell you what to do next.");
    } catch (e) {
      setFailError(getErrorMessage(e, "Couldn't send the report. Please try again."));
    }
  };

  // Only while the order can still be delivered; a finished one needs no code
  const awaitingDelivery = order ? Boolean(NEXT_STATUS[order.status]) : false;
  const busy = locating || updateStatus.isPending || reportFailure.isPending;

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
          // The spinner is for a pull, not for the list's own once-a-minute refresh
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={colors.saffron[600]} />}
        >
          {report?.at && carrying ? (
            <View className="flex-row items-start gap-2.5 rounded-2xl border border-chili-600/25 bg-chili-100 p-3.5" accessibilityRole="alert">
              <TriangleAlert size={18} color={colors.chili[700]} />
              <View className="flex-1">
                <Text className="font-sans-bold text-sm text-chili-700">Reported: {reasons[report.reason] ?? "Could not deliver"}</Text>
                {report.note ? <Text className="mt-0.5 font-sans text-xs leading-4 text-ink-700">“{report.note}”</Text> : null}
                <Text className="mt-1 font-sans text-xs leading-4 text-ink-700">
                  Sent to the office on {formatDateTime(report.at)}. Keep the goods with you and wait to hear from them. If the store can take it after all, you can still mark it delivered.
                </Text>
              </View>
            </View>
          ) : null}

          {waived && awaitingDelivery ? (
            <View className="flex-row items-start gap-2.5 rounded-2xl bg-cardamom-100 p-3.5">
              <MapPinCheck size={18} color={colors.cardamom[700]} />
              <Text className="flex-1 font-sans text-xs leading-4 text-ink-700">
                The office has allowed this order to be marked delivered without the location check. You still need the store&apos;s delivery code.
              </Text>
            </View>
          ) : null}

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
                    At handover, ask the store owner for their {CODE_LENGTH}-digit delivery code. You enter it to mark the order delivered
                    {mustBeAtStore ? ", and you must be at the store when you do." : "."}
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

          {/* What is in the parcel. No prices or payment: a delivery partner
              carries goods, not money. */}
          <Card>
            <View className="mb-3 flex-row items-center gap-2">
              <Package size={16} color={colors.ink[700]} />
              <Text className="font-display-bold text-base text-ink">Products</Text>
            </View>
            {order.products.map((item, idx) => (
              <View key={item._id ?? idx} className={`flex-row items-center justify-between py-2 ${idx < order.products.length - 1 ? "border-b border-sand" : ""}`}>
                <Text className="flex-1 pr-3 font-sans-semibold text-sm text-ink" numberOfLines={2}>{item.name}</Text>
                <Text className="font-sans-bold text-sm text-ink">{formatQuantity(item.quantity, item.uom)}</Text>
              </View>
            ))}
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
              label={locating && !failVisible ? "Checking your location…" : ACTION_LABEL[order.status] ?? "Update Status"}
              onPress={handleUpdateStatus}
              loading={updateStatus.isPending && !codeModalVisible}
              disabled={busy}
              fullWidth
              size="lg"
            />
          ) : null}

          {carrying ? (
            <Button
              label={report?.at ? "Report again" : "Could not deliver"}
              variant="outline"
              icon={<PackageX size={16} color={colors.ink.DEFAULT} />}
              onPress={openFailSheet}
              disabled={busy}
              fullWidth
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

              {/* What the phone's position came to, so nothing about it is a surprise later */}
              <View className="mb-3 flex-row items-start gap-2">
                <MapPin size={13} color={fix && place?.near !== false ? colors.cardamom[700] : fix ? colors.chili[700] : colors.ink[500]} />
                <Text
                  className={`flex-1 font-sans-medium text-xs leading-4 ${
                    fix && place?.near !== false ? "text-cardamom-700" : fix ? "text-chili-700" : "text-ink-500"
                  }`}
                >
                  {fix
                    ? !place
                      ? "Your location has been recorded."
                      : place.near || waived
                        ? `Your location has been recorded: about ${formatDistance(place.distance)} from the store.`
                        : `Your phone says you are about ${formatDistance(place.distance)} from the store. This delivery will be shown to the office to check.`
                    : waived
                      ? "Allowed by the office without the location check."
                      : "Your location could not be read. This delivery will be shown to the office to check."}
                </Text>
              </View>

              <Text className="font-sans text-sm leading-5 text-ink-700">
                Ask the store owner for their {CODE_LENGTH}-digit delivery code and enter it here.
              </Text>

              <View className={`mt-4 rounded-2xl border bg-white ${codeError ? "border-chili-600" : "border-sand-dark"}`}>
                <TextInput
                  ref={codeInput}
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
                  /* Left editable while the code is checked: switching it
                     off dropped the keyboard, and after a wrong code the
                     next one could not be typed until the box was tapped. */
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

      {/* Could not deliver: one tap for what happened, a note if it helps */}
      <Modal visible={failVisible} transparent animationType="fade" onRequestClose={closeFailSheet}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-black/50">
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <View className="rounded-3xl bg-white px-5 pb-5 pt-4">
              <View className="mb-1 flex-row items-center justify-between">
                <View className="flex-1 pr-2">
                  <Text className="font-display-bold text-lg text-ink">Could not deliver</Text>
                  <Text className="font-sans text-xs text-ink-500" numberOfLines={1}>
                    {order?.orderId} · {order?.deliveryAddress.storeName}
                  </Text>
                </View>
                <IconButton onPress={closeFailSheet} className="bg-cream-100">
                  <X size={18} color={colors.ink.DEFAULT} />
                </IconButton>
              </View>

              <Text className="mb-3 font-sans text-sm leading-5 text-ink-700">What happened? The office will decide what to do with this order.</Text>

              <View className="gap-2" accessibilityRole="radiogroup">
                {Object.entries(reasons).map(([key, label]) => {
                  const active = failReason === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => {
                        setFailReason(key);
                        if (failError) setFailError(null);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      className={`flex-row items-center gap-3 rounded-xl border px-3.5 py-3 ${active ? "border-saffron-600 bg-saffron-50" : "border-sand-dark bg-white"}`}
                    >
                      <View className={`h-4 w-4 items-center justify-center rounded-full border-2 ${active ? "border-saffron-600" : "border-sand-dark"}`}>
                        {active ? <View className="h-2 w-2 rounded-full bg-saffron-600" /> : null}
                      </View>
                      <Text className={`flex-1 font-sans-semibold text-sm ${active ? "text-saffron-700" : "text-ink-700"}`}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View className="mt-3 rounded-2xl border border-sand-dark bg-white px-3.5">
                <TextInput
                  value={failNote}
                  onChangeText={(text) => {
                    setFailNote(text.slice(0, NOTE_MAX));
                    if (failError) setFailError(null);
                  }}
                  placeholder={failReason === "OTHER" ? "Say what happened" : "Add a note (optional)"}
                  placeholderTextColor={colors.ink[300]}
                  multiline
                  maxLength={NOTE_MAX}
                  editable={!reportFailure.isPending}
                  accessibilityLabel="Note for the office"
                  className="min-h-[64px] py-3 font-sans text-sm text-ink"
                  style={{ textAlignVertical: "top" }}
                />
              </View>
              {failError ? <Text className="mt-2 font-sans-medium text-xs leading-4 text-chili-600">{failError}</Text> : null}

              <View className="mt-4 flex-row gap-3">
                <View className="flex-1">
                  <Button label="Cancel" variant="outline" onPress={closeFailSheet} disabled={reportFailure.isPending || locating} fullWidth />
                </View>
                <View className="flex-1">
                  <Button label="Send to office" onPress={submitFailure} loading={reportFailure.isPending || locating} disabled={!failReason} fullWidth />
                </View>
              </View>
            </View>
            <Pressable className="flex-1" onPress={closeFailSheet} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
