import { ReactNode } from "react";
import { Pressable, Text, ActivityIndicator, View } from "react-native";
import { colors } from "@/theme/colors";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-saffron-600 active:bg-saffron-700",
  secondary: "bg-maroon-700 active:bg-maroon-900",
  outline: "bg-transparent border border-sand-dark active:bg-sand",
  ghost: "bg-transparent active:bg-sand",
  danger: "bg-chili-600 active:bg-chili-700",
};

const textVariantClasses: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-white",
  outline: "text-ink",
  ghost: "text-ink-700",
  danger: "text-white",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3.5 py-2 rounded-xl",
  md: "px-5 py-3.5 rounded-2xl",
  lg: "px-6 py-4 rounded-2xl",
};

const textSizeClasses: Record<Size, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-base",
};

const spinnerColor: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.white,
  outline: colors.ink.DEFAULT,
  ghost: colors.ink[700],
  danger: colors.white,
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  className,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`flex-row items-center justify-center gap-2 ${variantClasses[variant]} ${sizeClasses[size]} ${
        fullWidth ? "w-full" : ""
      } ${isDisabled ? "opacity-50" : ""} ${className ?? ""}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor[variant]} />
      ) : (
        <>
          {icon}
          <Text className={`font-sans-bold ${textSizeClasses[size]} ${textVariantClasses[variant]}`}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  onPress,
  children,
  className,
}: {
  onPress?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`h-10 w-10 items-center justify-center rounded-full active:bg-sand ${className ?? ""}`}
      hitSlop={8}
    >
      <View>{children}</View>
    </Pressable>
  );
}
