import { View, Text, FlatList, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Undo2 } from "lucide-react-native";
import { IconButton, Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useCancelReturn, useMyReturns } from "@/hooks/useReturns";
import { formatDate } from "@/utils/date";
import { getErrorMessage } from "@/api/client";
import { toast } from "@/utils/toast";
import { colors } from "@/theme/colors";
import type { ReturnRequest } from "@/types/api";

const STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "info"> = {
  COMPLETED: "success",
  REFUND_PROCESSED: "success",
  CANCELLED: "danger",
  INITIATED: "info",
  PICKUP_ASSIGNED: "warning",
  PICKED_UP: "warning",
  RECEIVED_AT_WAREHOUSE: "warning",
};

export default function ReturnsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, isFetching, refetch, error } = useMyReturns();
  const cancelReturn = useCancelReturn();

  const handleCancel = (returnId: string) => {
    Alert.alert("Cancel Return", "Are you sure you want to cancel this return request?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, cancel",
        style: "destructive",
        onPress: async () => {
          try {
            await cancelReturn.mutateAsync(returnId);
            toast.success("Return cancelled");
          } catch (e) {
            toast.error("Couldn't cancel return", getErrorMessage(e));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-2 px-5 pt-2">
        <IconButton onPress={() => router.back()} className="bg-white">
          <ChevronLeft size={22} color={colors.ink.DEFAULT} />
        </IconButton>
        <Text className="font-display-bold text-xl text-ink">My Returns</Text>
      </View>

      {isLoading ? (
        <LoadingState message="Loading returns…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load returns.")} onRetry={refetch} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 10 }}
          refreshing={isFetching}
          onRefresh={refetch}
          ListEmptyComponent={<EmptyState icon={<Undo2 size={22} color={colors.ink[500]} />} title="No returns yet" />}
          renderItem={({ item }) => <ReturnRow item={item} onCancel={() => handleCancel(item.returnId)} />}
        />
      )}
    </SafeAreaView>
  );
}

function ReturnRow({ item, onCancel }: { item: ReturnRequest; onCancel: () => void }) {
  const canCancel = item.status === "INITIATED";
  return (
    <View className="rounded-2xl border border-sand bg-white p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="font-sans-bold text-sm text-ink">{item.returnId}</Text>
          <Text className="mt-0.5 font-sans text-xs text-ink-500">Order {item.orderId} · {formatDate(item.createdAt)}</Text>
        </View>
        <Badge label={item.status.replace(/_/g, " ")} variant={STATUS_VARIANT[item.status] ?? "neutral"} />
      </View>
      <Text className="mt-2 font-sans text-xs text-ink-700">{item.reason}</Text>
      {canCancel ? <Button label="Cancel Return" variant="outline" size="sm" onPress={onCancel} className="mt-3" /> : null}
    </View>
  );
}
