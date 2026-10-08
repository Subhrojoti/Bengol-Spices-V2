import { ReactNode } from "react";
import { View, Pressable, StyleSheet, type ViewStyle } from "react-native";

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  className?: string;
  style?: ViewStyle;
}

const cardShadow = StyleSheet.create({
  shadow: {
    shadowColor: "#3D1926",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
}).shadow;

export function Card({ children, onPress, className, style }: CardProps) {
  const base = `rounded-2xl bg-white border border-sand p-4 ${className ?? ""}`;
  const mergedStyle = [cardShadow, style];

  if (onPress) {
    return (
      <Pressable onPress={onPress} className={`${base} active:opacity-80`} style={mergedStyle}>
        {children}
      </Pressable>
    );
  }

  return (
    <View className={base} style={mergedStyle}>
      {children}
    </View>
  );
}
