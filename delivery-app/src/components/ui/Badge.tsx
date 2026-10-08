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

const ORDER_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PLACED: "info",
  CONFIRMED: "info",
  ASSIGNED: "warning",
  SHIPPED: "warning",
  OUT_FOR_DELIVERY: "warning",
  DELIVERED: "success",
  CANCELLED: "danger",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return <Badge label={status.replace(/_/g, " ")} variant={ORDER_STATUS_VARIANT[status] ?? "neutral"} />;
}

const RETURN_STATUS_VARIANT: Record<string, BadgeVariant> = {
  INITIATED: "info",
  PICKUP_ASSIGNED: "warning",
  PICKED_UP: "warning",
  RECEIVED_AT_WAREHOUSE: "warning",
  COMPLETED: "success",
  REFUND_PROCESSED: "success",
  CANCELLED: "danger",
};

export function ReturnStatusBadge({ status }: { status: string }) {
  return <Badge label={status.replace(/_/g, " ")} variant={RETURN_STATUS_VARIANT[status] ?? "neutral"} />;
}
