import { Pressable, Text, View, ScrollView } from "react-native";

interface Segment<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function SegmentedControl<T extends string>({ segments, value, onChange }: { segments: Segment<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 px-5">
      <View className="flex-row gap-2 pb-1">
        {segments.map((seg) => {
          const active = seg.value === value;
          return (
            <Pressable key={seg.value} onPress={() => onChange(seg.value)} className={`rounded-full px-4 py-2.5 ${active ? "bg-saffron-600" : "bg-white border border-sand-dark"}`}>
              <Text className={`font-sans-bold text-sm ${active ? "text-white" : "text-ink-700"}`}>
                {seg.label}
                {seg.count != null ? ` (${seg.count})` : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
