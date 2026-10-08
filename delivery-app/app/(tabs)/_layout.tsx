import { Tabs } from "expo-router";
import { LayoutGrid, Truck, Undo2, History } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

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
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{ title: "Deliveries", tabBarIcon: ({ color, size }) => <Truck color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="returns"
        options={{ title: "Returns", tabBarIcon: ({ color, size }) => <Undo2 color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: "History", tabBarIcon: ({ color, size }) => <History color={color} size={size} /> }}
      />
    </Tabs>
  );
}
