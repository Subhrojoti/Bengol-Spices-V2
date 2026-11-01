import { useEffect, useRef } from "react";
import { View, Text, ScrollView, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Store, MapPin, Phone, Navigation, Package, RefreshCcw } from "lucide-react-native";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ReturnStatusBadge } from "@/components/ui/Badge";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useAssignedReturns, useUpdateReturnStatus } from "@/hooks/useReturns";
import { useDeliveryHistory } from "@/hooks/useProfile";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { formatQuantity } from "@/utils/uom";
import { formatDateTime } from "@/utils/date";
import { openInMaps } from "@/utils/maps";
import { getErrorMessage } from "@/api/client";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";
import { validMapPoint } from "@/utils/deliveryView";
import type { ReturnStatus } from "@/types/api";

const NEXT_STATUS: Partial<Record<ReturnStatus, ReturnStatus>> = {
  PICKUP_ASSIGNED: "PICKED_UP",
  PICKED_UP: "RECEIVED_AT_WAREHOUSE",
  RECEIVED_AT_WAREHOUSE: "COMPLETED",
};

const ACTION_LABEL: Partial<Record<ReturnStatus, string>> = {
  PICKUP_ASSIGNED: "Mark as Picked Up",
  PICKED_UP: "Mark as Received at Warehouse",
  RECEIVED_AT_WAREHOUSE: "Mark as Completed",
};

export default function ReturnDetailRoute() {
  const { returnId } = useLocalSearchParams<{ returnId: string }>();
  return <ReturnDetailScreen key={returnId} returnId={returnId} />;
}

function ReturnDetailScreen({ returnId }: { returnId: string }) {
  const router = useRouter();
  const mounted = useRef(true), running = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const { data: returns, isLoading, isError, refetch, error } = useAssignedReturns();
  const updateStatus = useUpdateReturnStatus();
  const { refetch: refetchHistory } = useDeliveryHistory();
  const { pulling, onPull } = usePullToRefresh(refetch);

  /* Did the step go through after all? On a weak signal the phone can send
     it a second time by itself, and that copy is refused because the return
     has already moved on. Read again before an error is shown. */
  const stepWentThrough = async (id: string, status: ReturnStatus) => {
    try {
      if (status === "COMPLETED") {
        const { data } = await refetchHistory();
        // The office may already have moved it on to REFUND_PROCESSED
        return Boolean(data?.completedReturns.some((r) => r.returnId === id && ["COMPLETED", "REFUND_PROCESSED"].includes(r.status)));
      }
      const { data } = await refetch();
      return data?.find((r) => r.returnId === id)?.status === status;
    } catch {
      return false;
    }
  };

  /* A pickup still to be done. Once it is COMPLETED it leaves this list,
     and the screen is closed at that moment (see below); the history lists
     finished pickups on its own, without opening this screen. */
  const ret = returns?.find((r) => r.returnId === returnId);

  const handleUpdateStatus = () => {
    if (!ret || running.current) return;
    const nextStatus = NEXT_STATUS[ret.status];
    if (!nextStatus) return;

    const confirmLabel = ACTION_LABEL[ret.status] ?? "Update status";
    Alert.alert(confirmLabel, `Confirm this return is now ${nextStatus.replace(/_/g, " ").toLowerCase()}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          if (running.current || !mounted.current) return;
          running.current = true;
          try {
            await updateStatus.mutateAsync({ returnId: ret.returnId, status: nextStatus });
            if (!mounted.current) return;
            toast.success(`Marked as ${nextStatus.replace(/_/g, " ")}`);
            // 🔥 FIX: once COMPLETED, this return leaves the active list.
            if (nextStatus === "COMPLETED") {
              router.back();
            }
          } catch (e) {
            const completed = await stepWentThrough(ret.returnId, nextStatus);
            if (!mounted.current) return;
            if (completed) {
              toast.success(`Marked as ${nextStatus.replace(/_/g, " ")}`);
              if (nextStatus === "COMPLETED") router.back();
              return;
            }
            toast.error("Couldn't update status", getErrorMessage(e));
          } finally { running.current = false; }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <AppHeader title={returnId ?? "Return"} showBack />

      {isLoading ? (
        <LoadingState message="Loading return…" />
      ) : isError || !ret ? (
        <ErrorState message={isError ? getErrorMessage(error, "Couldn't load this return.") : "Couldn't find this return."} onRetry={refetch} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 14 }}
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={colors.saffron[600]} />}
        >
          <Card>
            <View className="flex-row flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
              <View className="max-w-full shrink">
                <Text className="font-display-bold text-lg text-ink">{ret.returnId}</Text>
                <Text className="mt-0.5 font-sans text-xs text-ink-500">Order {ret.orderId} · {formatDateTime(ret.createdAt)}</Text>
              </View>
              <ReturnStatusBadge status={ret.status} />
            </View>

            {ret.storeDetails ? (
              <>
                <View className="mt-4 flex-row items-center gap-2">
                  <Store size={14} color={colors.ink[500]} />
                  <Text className="flex-1 font-sans-semibold text-sm text-ink-700">{ret.storeDetails.storeName}</Text>
                </View>
                <View className="mt-1.5 flex-row items-center gap-2">
                  <Phone size={14} color={colors.ink[500]} />
                  <Text className="font-sans text-xs text-ink-500">{ret.storeDetails.phone}</Text>
                </View>
              </>
            ) : null}

            {ret.pickupLocation ? (
              <>
                <View className="mt-1.5 flex-row items-start gap-2">
                  <MapPin size={14} color={colors.ink[500]} />
                  <Text className="flex-1 font-sans text-xs text-ink-500">{ret.pickupLocation.address}</Text>
                </View>
                <Button
                  label={validMapPoint(ret.pickupLocation) ? "Navigate to Pickup" : "Pickup location unavailable"}
                  variant="outline"
                  disabled={!validMapPoint(ret.pickupLocation)}
                  icon={<Navigation size={15} color={colors.ink.DEFAULT} />}
                  onPress={() => openInMaps(ret.pickupLocation!.latitude, ret.pickupLocation!.longitude, ret.storeDetails?.storeName)}
                  fullWidth
                  className="mt-4"
                />
              </>
            ) : null}
          </Card>

          <Card>
            <View className="mb-2 flex-row items-center gap-2">
              <RefreshCcw size={16} color={colors.ink[700]} />
              <Text className="font-display-bold text-base text-ink">Return Reason</Text>
            </View>
            <Text className="font-sans text-sm text-ink-700">{ret.reason}</Text>
          </Card>

          {ret.items.length > 0 ? (
            <Card>
              <View className="mb-3 flex-row items-center gap-2">
                <Package size={16} color={colors.ink[700]} />
                <Text className="font-display-bold text-base text-ink">Items</Text>
              </View>
              {ret.items.map((item, idx) => (
                <View key={idx} className={`flex-row items-center justify-between py-2 ${idx < ret.items.length - 1 ? "border-b border-sand" : ""}`}>
                  <Text className="flex-1 pr-3 font-sans-semibold text-sm text-ink" numberOfLines={2}>{item.name}</Text>
                  <Text className="font-sans-bold text-sm text-ink">{formatQuantity(item.quantity, item.uom)}</Text>
                </View>
              ))}
            </Card>
          ) : null}

          {NEXT_STATUS[ret.status] ? (
            <Button
              label={ACTION_LABEL[ret.status] ?? "Update Status"}
              onPress={handleUpdateStatus}
              loading={updateStatus.isPending}
              fullWidth
              size="lg"
            />
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
