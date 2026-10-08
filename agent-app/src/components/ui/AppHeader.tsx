import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Bell, ChevronLeft } from "lucide-react-native";
import { IconButton } from "@/components/ui/Button";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { useNotifications } from "@/hooks/useNotifications";
import { colors } from "@/theme/colors";

export function AppHeader({ title, showBack = false }: { title: string; showBack?: boolean }) {
  const router = useRouter();
  const { data: notifications } = useNotifications();
  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
      <View className="flex-1 flex-row items-center gap-2">
        {showBack ? (
          <IconButton onPress={() => router.back()} className="mr-1 bg-transparent">
            <ChevronLeft size={24} color={colors.ink.DEFAULT} />
          </IconButton>
        ) : null}
        <Text className="font-display-bold text-2xl text-ink" numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View className="flex-row items-center gap-2.5">
        <IconButton onPress={() => router.push("/notifications")} className="bg-white">
          <View>
            <Bell size={20} color={colors.ink[700]} />
            {unreadCount > 0 ? (
              <View className="absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded-full bg-chili-600">
                <Text className="font-sans-bold text-[9px] text-white">{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </IconButton>

        <ProfileAvatar />
      </View>
    </View>
  );
}
