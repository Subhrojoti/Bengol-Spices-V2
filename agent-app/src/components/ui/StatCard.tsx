import { ReactNode } from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Card } from "@/components/ui/Card";
import { gradients } from "@/theme/colors";

export function StatCard({
  icon,
  watermarkIcon,
  label,
  value,
  valueClassName,
  caption,
}: {
  /** Rendered on a saffron gradient tile, so pass a white icon. */
  icon: ReactNode;
  watermarkIcon?: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  caption?: string;
}) {
  return (
    <Card className="flex-1 overflow-hidden p-4">
      {watermarkIcon ? (
        <View className="absolute -bottom-3 -right-3 opacity-[0.06]" pointerEvents="none">
          {watermarkIcon}
        </View>
      ) : null}
      <LinearGradient
        colors={gradients.saffronWash}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" }}
      >
        {icon}
      </LinearGradient>
      <Text className="mt-4 font-sans-semibold text-[11px] uppercase text-ink-500" style={{ letterSpacing: 1 }}>
        {label}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} className={`mt-1 font-display-bold text-2xl text-ink ${valueClassName ?? ""}`}>
        {value}
      </Text>
      {caption ? <Text className="mt-1 font-sans text-[11px] text-ink-500">{caption}</Text> : null}
    </Card>
  );
}
