import { ReactNode, forwardRef } from "react";
import { View, Text, TextInput, type TextInputProps } from "react-native";
import { colors } from "@/theme/colors";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  required?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, hint, leftIcon, rightSlot, required, style, ...rest }, ref) => {
    return (
      <View className="mb-4">
        {label ? (
          <Text className="mb-1.5 font-sans-semibold text-sm text-ink-700">
            {label}
            {required ? <Text className="text-chili-600"> *</Text> : null}
          </Text>
        ) : null}

        <View
          className={`flex-row items-center rounded-xl border bg-white px-3.5 ${
            error ? "border-chili-600" : "border-sand-dark"
          }`}
        >
          {leftIcon ? <View className="mr-2">{leftIcon}</View> : null}
          <TextInput
            ref={ref}
            placeholderTextColor={colors.ink[300]}
            className="flex-1 py-3.5 font-sans text-base text-ink"
            style={style}
            {...rest}
          />
          {rightSlot ? <View className="ml-2">{rightSlot}</View> : null}
        </View>

        {error ? (
          <Text className="mt-1.5 font-sans-medium text-xs text-chili-600">{error}</Text>
        ) : hint ? (
          <Text className="mt-1.5 font-sans text-xs text-ink-500">{hint}</Text>
        ) : null}
      </View>
    );
  },
);
Input.displayName = "Input";
