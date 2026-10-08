import { View, Text, Pressable } from "react-native";

interface RadioOption<T extends string> {
  value: T;
  label: string;
}

export function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label?: string;
  options: RadioOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  error?: string;
}) {
  return (
    <View className="mb-4">
      {label ? <Text className="mb-2 font-sans-semibold text-sm text-ink-700">{label}</Text> : null}
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              className={`flex-row items-center gap-2 rounded-xl border px-3.5 py-2.5 ${active ? "border-saffron-600 bg-saffron-50" : "border-sand-dark bg-white"}`}
            >
              <View className={`h-4 w-4 items-center justify-center rounded-full border-2 ${active ? "border-saffron-600" : "border-sand-dark"}`}>
                {active ? <View className="h-2 w-2 rounded-full bg-saffron-600" /> : null}
              </View>
              <Text className={`font-sans-semibold text-sm ${active ? "text-saffron-700" : "text-ink-700"}`}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text className="mt-1.5 font-sans-medium text-xs text-chili-600">{error}</Text> : null}
    </View>
  );
}
