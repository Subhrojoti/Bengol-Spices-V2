import { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronDown, Check, X } from "lucide-react-native";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { colors } from "@/theme/colors";

export function ChoiceField({ label, value, options, onChange, onBlur, error, allowCustom = false, disabled = false }: {
  label: string; value: string; options: string[]; onChange: (value: string) => void;
  onBlur?: () => void; error?: string; allowCustom?: boolean; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState("");
  const matches = useMemo(() => options.filter(option => option.toLowerCase().includes(query.trim().toLowerCase())), [options, query]);
  const close = () => { setOpen(false); onBlur?.(); };
  const select = (next: string) => { onChange(next); close(); };
  return <View className="mb-4">
    <Text className="mb-1.5 font-sans-semibold text-sm text-ink-700">{label}<Text className="text-chili-600"> *</Text></Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Select ${label}`} accessibilityState={{ expanded: open, disabled }} disabled={disabled}
      onPress={() => { setQuery(""); setOpen(true); }} className={`min-h-12 flex-row items-center justify-between gap-2 rounded-xl border bg-white px-3.5 py-3.5 ${error ? "border-chili-600" : "border-sand-dark"}`}>
      <Text numberOfLines={1} className={`flex-1 font-sans text-base ${value ? "text-ink" : "text-ink-300"}`}>{value || `Select ${label.toLowerCase()}`}</Text><ChevronDown size={18} color={colors.ink[500]} />
    </Pressable>
    {error && <Text className="mt-1.5 font-sans-medium text-xs text-chili-600">{error}</Text>}
    <Modal visible={open} animationType="slide" onRequestClose={close}>
      <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
        <View className="flex-row items-center justify-between px-5 py-3"><Text className="font-display-bold text-xl text-ink">Select {label.toLowerCase()}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Close ${label} choices`} onPress={close} className="h-11 w-11 items-center justify-center"><X size={20} color={colors.ink.DEFAULT} /></Pressable></View>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View className="px-5"><Input accessibilityLabel={`Search ${label}`} placeholder={allowCustom ? `Search or type a different ${label.toLowerCase()}` : `Search ${label.toLowerCase()}`} value={query} onChangeText={setQuery} maxLength={allowCustom ? 300 : 100} autoCorrect={false} autoCapitalize="none" /></View>
          <FlatList data={matches} keyExtractor={item => item} keyboardShouldPersistTaps="handled" initialNumToRender={12} windowSize={5} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            ListEmptyComponent={<Text className="py-5 font-sans text-sm text-ink-500">No matching choices.{allowCustom ? ` Type the ${label.toLowerCase()} name and use it below.` : " Try another search."}</Text>}
            renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={item} accessibilityState={{ selected: item === value }} onPress={() => select(item)} className="mb-2 min-h-12 flex-row items-center justify-between rounded-xl border border-sand bg-white px-4 py-3"><Text className="flex-1 font-sans text-base text-ink">{item}</Text>{item === value && <Check size={18} color={colors.cardamom[600]} />}</Pressable>} />
          {allowCustom && query.trim().length >= 2 && <View className="px-5 pb-4"><Button label={`Use this ${label.toLowerCase()}`} fullWidth onPress={() => select(query.trim())} /></View>}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </View>;
}
