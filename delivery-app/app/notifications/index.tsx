import { View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bell, ChevronLeft } from "lucide-react-native";
import { IconButton } from "@/components/ui/Button";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useMarkNotificationRead, useNotifications } from "@/hooks/useNotifications";
import { formatRelative } from "@/utils/date";
import { getErrorMessage } from "@/api/client";
import { colors } from "@/theme/colors";
import type { AppNotification } from "@/types/api";

export default function NotificationsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, isFetching, refetch, error } = useNotifications();
  const markAsRead = useMarkNotificationRead();

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-2 px-5 pt-2">
        <IconButton onPress={() => router.back()} className="bg-white">
          <ChevronLeft size={22} color={colors.ink.DEFAULT} />
        </IconButton>
        <Text className="font-display-bold text-xl text-ink">Notifications</Text>
      </View>

      {isLoading ? (
        <LoadingState message="Loading notifications…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load notifications.")} onRetry={refetch} />
      ) : (
        <FlatList
          data={[...(data ?? [])].sort((a, b) => (a.isRead === b.isRead ? 0 : a.isRead ? 1 : -1))}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 10 }}
          refreshing={isFetching}
          onRefresh={refetch}
          ListEmptyComponent={<EmptyState icon={<Bell size={22} color={colors.ink[500]} />} title="No notifications yet" />}
          renderItem={({ item }) => <NotificationRow item={item} onPress={() => !item.isRead && markAsRead.mutate(item._id)} />}
        />
      )}
    </SafeAreaView>
  );
}

function NotificationRow({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row gap-3 rounded-2xl border p-4 ${item.isRead ? "border-sand bg-white" : "border-saffron-600 bg-saffron-50"}`}
    >
      {!item.isRead ? <View className="mt-1.5 h-2 w-2 rounded-full bg-saffron-600" /> : <View className="w-2" />}
      <View className="flex-1">
        <Text className="font-sans-bold text-sm text-ink">{item.title}</Text>
        <Text className="mt-0.5 font-sans text-sm text-ink-700">{item.message}</Text>
        <Text className="mt-1.5 font-sans text-xs text-ink-500">{formatRelative(item.createdAt)}</Text>
      </View>
    </Pressable>
  );
}
