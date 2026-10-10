import { Tabs } from "expo-router";
import { LayoutGrid, Store, Wallet2, Target, ReceiptText } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { useTargetCelebration } from "@/hooks/useTargets";
import { useSalesTargetCelebration } from "@/hooks/useSalesTarget";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  // Whichever tab the agent is on when a target is reached, they are told
  useTargetCelebration();
  // The monthly sales target and its incentive: told, with confetti
  useSalesTargetCelebration();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.saffron[600],
        tabBarInactiveTintColor: colors.ink[300],
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.sand.DEFAULT,
          borderTopWidth: 1,
          height: 56 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: "Manrope_600SemiBold",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} /> }} />
      <Tabs.Screen name="stores" options={{ title: "Stores", tabBarIcon: ({ color, size }) => <Store color={color} size={size} /> }} />
      <Tabs.Screen name="payments" options={{ title: "Payments", tabBarIcon: ({ color, size }) => <ReceiptText color={color} size={size} /> }} />
      <Tabs.Screen name="targets" options={{ title: "Targets", tabBarIcon: ({ color, size }) => <Target color={color} size={size} /> }} />
      <Tabs.Screen name="wallet" options={{ title: "Wallet", tabBarIcon: ({ color, size }) => <Wallet2 color={color} size={size} /> }} />
    </Tabs>
  );
}
