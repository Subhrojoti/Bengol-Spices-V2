import { ReactNode } from "react";
import { View, Text } from "react-native";
import { Card } from "@/components/ui/Card";

export function StatCard({
  icon,
  watermarkIcon,
  label,
  value,
  valueClassName,
}: {
  icon: ReactNode;
  watermarkIcon?: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <Card className="flex-1 overflow-hidden p-5">
      {watermarkIcon ? (
        <View className="absolute -bottom-3 -right-3 opacity-[0.07]" pointerEvents="none">
          {watermarkIcon}
        </View>
      ) : null}
      <View className="mb-4 h-9 w-9 items-center justify-center rounded-full bg-saffron-50">{icon}</View>
      <Text className="font-sans-medium text-xs text-ink-500">{label}</Text>
      <Text className={`mt-2 font-display-bold text-xl text-ink ${valueClassName ?? ""}`}>{value}</Text>
    </Card>
  );
}
