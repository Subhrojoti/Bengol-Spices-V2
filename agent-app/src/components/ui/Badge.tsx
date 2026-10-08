import { Text, View } from "react-native";

type BadgeVariant = "success" | "danger" | "warning" | "info" | "neutral";

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-cardamom-100",
  danger: "bg-chili-100",
  warning: "bg-saffron-100",
  info: "bg-sand",
  neutral: "bg-cream-100",
};
const textVariantClasses: Record<BadgeVariant, string> = {
  success: "text-cardamom-700",
  danger: "text-chili-700",
  warning: "text-saffron-700",
  info: "text-ink-700",
  neutral: "text-ink-500",
};

export function Badge({ label, variant = "neutral" }: { label: string; variant?: BadgeVariant }) {
  return (
    <View className={`self-start rounded-full px-3 py-1 ${variantClasses[variant]}`}>
      <Text className={`font-sans-bold text-xs ${textVariantClasses[variant]}`}>{label}</Text>
    </View>
  );
}
