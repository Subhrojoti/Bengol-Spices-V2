import { View, Text, Image, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { KeyRound, LogOut, HelpCircle, Undo2, ChevronRight, ChevronLeft, User, IdCard, Mail, Phone, MapPin, Flame } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import { OrnateDivider } from "@/components/ui/OrnateDivider";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { useProfile } from "@/hooks/useAgent";
import { useAuth } from "@/context/AuthContext";
import { colors, gradients } from "@/theme/colors";
import { getErrorMessage } from "@/api/client";

export default function ProfileScreen() {
  const router = useRouter();
  const { data: agent, isLoading, isError, refetch, error } = useProfile();
  const { logout } = useAuth();

  const confirmLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => logout() },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      {isLoading ? (
        <View className="flex-1">
          <View className="flex-row items-center px-5 pt-2">
            <IconButton onPress={() => router.back()} className="bg-white">
              <ChevronLeft size={22} color={colors.ink.DEFAULT} />
            </IconButton>
          </View>
          <LoadingState message="Loading profile…" />
        </View>
      ) : isError || !agent ? (
        <View className="flex-1">
          <View className="flex-row items-center px-5 pt-2">
            <IconButton onPress={() => router.back()} className="bg-white">
              <ChevronLeft size={22} color={colors.ink.DEFAULT} />
            </IconButton>
          </View>
          <ErrorState message={getErrorMessage(error, "Couldn't load your profile.")} onRetry={refetch} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={gradients.hero} className="rounded-b-[32px] px-5 pb-8 pt-3">
            <IconButton onPress={() => router.back()} className="bg-white/15">
              <ChevronLeft size={20} color={colors.white} />
            </IconButton>

            <View className="mt-3 flex-row items-center gap-4">
              <View style={{ marginBottom: -30 }}>
                {agent.documents.photo ? (
                  <Image source={{ uri: agent.documents.photo }} className="h-[84px] w-[84px] rounded-full border-[3px] border-saffron-400" />
                ) : (
                  <View className="h-[84px] w-[84px] items-center justify-center rounded-full border-[3px] border-saffron-400 bg-saffron-600">
                    <Text className="font-display-bold text-2xl text-white">{agent.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</Text>
                  </View>
                )}
              </View>
              <View className="flex-1">
                <Text className="font-display-bold text-xl text-white" numberOfLines={1}>
                  {agent.name}
                </Text>
                <Text className="font-sans text-xs text-saffron-100" numberOfLines={1}>
                  {agent.email}
                </Text>
                <View className="mt-2 flex-row items-center gap-1.5 self-start rounded-full bg-saffron-600/90 px-3 py-1">
                  <IdCard size={12} color={colors.white} />
                  <Text className="font-sans-bold text-xs text-white">{agent.agentId}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          <View className="px-5" style={{ paddingTop: 30 }}>
            <Card>
              <View className="flex-row items-center gap-2.5">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-saffron-50">
                  <User size={16} color={colors.saffron[600]} />
                </View>
                <Text className="font-display-bold text-base text-ink">Personal Information</Text>
              </View>
              <OrnateDivider />
              <InfoRow icon={<User size={14} color={colors.saffron[700]} />} label="Full Name" value={agent.name} />
              <InfoRow icon={<IdCard size={14} color={colors.saffron[700]} />} label="Agent ID" value={agent.agentId} />
              <InfoRow icon={<Mail size={14} color={colors.saffron[700]} />} label="Email" value={agent.email} />
              <InfoRow icon={<Phone size={14} color={colors.saffron[700]} />} label="Phone" value={agent.phone} />
              <InfoRow icon={<MapPin size={14} color={colors.saffron[700]} />} label="Address" value={agent.address} last />
            </Card>

            <View className="mt-4 gap-2.5">
              <ActionRow icon={<KeyRound size={17} color={colors.ink[700]} />} label="Change Password" onPress={() => router.push("/profile/change-password")} />
              <ActionRow icon={<Undo2 size={17} color={colors.ink[700]} />} label="My Returns" onPress={() => router.push("/returns")} />
              <ActionRow icon={<HelpCircle size={17} color={colors.ink[700]} />} label="Help & FAQ" onPress={() => router.push("/help")} />
            </View>

            <View className="relative mt-6 overflow-hidden rounded-2xl">
              <View className="absolute -bottom-4 -right-2 opacity-15" pointerEvents="none">
                <Flame size={80} color={colors.white} />
              </View>
              <Button label="Logout" variant="danger" icon={<LogOut size={16} color={colors.white} />} onPress={confirmLogout} fullWidth />
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value, last }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <View className={`flex-row items-center gap-3 py-3 ${last ? "" : "border-b border-sand"}`}>
      <View className="h-8 w-8 items-center justify-center rounded-full bg-cream-100">{icon}</View>
      <View className="flex-1">
        <Text className="font-sans text-xs text-ink-500">{label}</Text>
        <Text className="mt-0.5 font-sans-semibold text-sm text-ink">{value}</Text>
      </View>
    </View>
  );
}

function ActionRow({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} className="flex-row items-center gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-sand">{icon}</View>
      <Text className="flex-1 font-sans-semibold text-sm text-ink">{label}</Text>
      <ChevronRight size={16} color={colors.ink[500]} />
    </Card>
  );
}
