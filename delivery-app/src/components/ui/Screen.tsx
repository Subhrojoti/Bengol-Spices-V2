import { ReactNode } from "react";
import { View, ScrollView, RefreshControl, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  contentContainerStyle?: ViewStyle;
  className?: string;
}

export function Screen({
  children,
  scroll = true,
  edges = ["top", "left", "right"],
  refreshing = false,
  onRefresh,
  contentContainerStyle,
  className,
}: ScreenProps) {
  if (!scroll) {
    return (
      <SafeAreaView edges={edges} className={`flex-1 bg-cream ${className ?? ""}`}>
        {children}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} className={`flex-1 bg-cream ${className ?? ""}`}>
      <ScrollView
        contentContainerStyle={[{ flexGrow: 1, paddingBottom: 32 }, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.saffron[600]} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function ScreenPadding({ children }: { children: ReactNode }) {
  return <View className="px-5 pt-4">{children}</View>;
}
