import { View, Text, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Undo2, MapPin } from "lucide-react-native";
import { AppHeader } from "@/components/ui/AppHeader";
import { ReturnStatusBadge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useAssignedReturns } from "@/hooks/useReturns";
import { getErrorMessage } from "@/api/client";
import { colors } from "@/theme/colors";
import type { AssignedReturn } from "@/types/api";
import { SafeAreaView } from "react-native-safe-area-context";

const STATUS_ORDER: Record<string, number> = { PICKUP_ASSIGNED: 0, PICKED_UP: 1, RECEIVED_AT_WAREHOUSE: 2 };

export default function ReturnsScreen() {
  const { data, isLoading, isError, isFetching, refetch, error } = useAssignedReturns();

  const sorted = [...(data ?? [])].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <AppHeader title="Returns" />

      {isLoading ? (
        <LoadingState message="Loading return pickups…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load return pickups.")} onRetry={refetch} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 10 }}
          refreshing={isFetching}
          onRefresh={refetch}
          ListEmptyComponent={
            <EmptyState icon={<Undo2 size={24} color={colors.ink[500]} />} title="No return pickups assigned" />
          }
          renderItem={({ item }) => <ReturnRow item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function ReturnRow({ item }: { item: AssignedReturn }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/returns/${item.returnId}`)}
      className="rounded-2xl border border-sand bg-white p-4 active:opacity-80"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="font-sans-bold text-sm text-ink" numberOfLines={1}>
            {item.storeDetails?.storeName ?? "Store"}
          </Text>
          <Text className="mt-0.5 font-sans text-xs text-ink-500">{item.returnId} · Order {item.orderId}</Text>
        </View>
        <ReturnStatusBadge status={item.status} />
      </View>
      {item.pickupLocation ? (
        <View className="mt-2 flex-row items-start gap-1.5">
          <MapPin size={12} color={colors.ink[500]} />
          <Text className="flex-1 font-sans text-xs text-ink-500" numberOfLines={1}>
            {item.pickupLocation.address}
          </Text>
        </View>
      ) : null}
      <Text className="mt-1.5 font-sans text-xs text-ink-500" numberOfLines={1}>
        Reason: {item.reason}
      </Text>
    </Pressable>
  );
}
