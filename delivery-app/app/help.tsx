import { useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronDown, HelpCircle } from "lucide-react-native";
import { IconButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useFaqs } from "@/hooks/useFaqs";
import { colors } from "@/theme/colors";
import type { Faq } from "@/types/api";

export default function HelpScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useFaqs();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-2 px-5 pt-2">
        <IconButton onPress={() => router.back()} className="bg-white">
          <ChevronLeft size={22} color={colors.ink.DEFAULT} />
        </IconButton>
        <Text className="font-display-bold text-xl text-ink">Help & FAQ</Text>
      </View>

      {isLoading ? (
        <LoadingState message="Loading…" />
      ) : isError ? (
        <ErrorState message="Couldn't load FAQs." onRetry={refetch} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 10 }}
          ListEmptyComponent={<EmptyState icon={<HelpCircle size={22} color={colors.ink[500]} />} title="No FAQs yet" />}
          renderItem={({ item }) => (
            <FaqRow item={item} open={openId === item._id} onToggle={() => setOpenId((id) => (id === item._id ? null : item._id))} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function FaqRow({ item, open, onToggle }: { item: Faq; open: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} className="rounded-2xl border border-sand bg-white p-4">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <Badge label={item.category} variant="info" />
          <Text className="mt-1.5 font-sans-bold text-sm text-ink">{item.question}</Text>
        </View>
        <ChevronDown size={16} color={colors.ink[500]} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </View>
      {open ? <Text className="mt-2.5 font-sans text-sm text-ink-700">{item.answer}</Text> : null}
    </Pressable>
  );
}
