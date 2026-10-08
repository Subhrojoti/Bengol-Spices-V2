import { ReactNode } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { AlertCircle, type LucideIcon } from "lucide-react-native";
import { colors } from "@/theme/colors";
import { Button } from "@/components/ui/Button";

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-sand">{icon}</View>
      <Text className="text-center font-display-bold text-lg text-ink">{title}</Text>
      {subtitle ? <Text className="mt-1.5 text-center font-sans text-sm text-ink-500">{subtitle}</Text> : null}
      {action ? <View className="mt-5">{action}</View> : null}
    </View>
  );
}

export function LoadingState({ message }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center py-16">
      <ActivityIndicator size="large" color={colors.saffron[600]} />
      {message ? <Text className="mt-3 font-sans text-sm text-ink-500">{message}</Text> : null}
    </View>
  );
}

export function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const Icon = AlertCircle as LucideIcon;
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-chili-100">
        <Icon size={28} color={colors.chili[600]} />
      </View>
      <Text className="text-center font-display-bold text-lg text-ink">Couldn't load this</Text>
      <Text className="mt-1.5 text-center font-sans text-sm text-ink-500">{message}</Text>
      {onRetry ? (
        <View className="mt-5">
          <Button label="Try again" variant="outline" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}
