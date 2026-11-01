import { useMemo, useRef, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { StoreMap } from "@/components/maps/StoreMap";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useMyStores } from "@/hooks/useStores";
import { openInMaps } from "@/utils/maps";
import { validStoreLocation } from "@/utils/storeCorrection";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { MapPin, ChevronRight, Navigation, FileText } from "lucide-react-native";
import { colors } from "@/theme/colors";
export default function StoreMapScreen() {
  const query = useMyStores(), router = useRouter(), [selected, setSelected] = useState("");
  useRefetchOnFocus(["stores"]);
  const points = useMemo(() => (query.data || []).filter(store => validStoreLocation(store.location)).map(store => ({ id: store.consumerId, name: store.storeName, ...store.location, detail: [store.address?.street, store.address?.city].filter(Boolean).join(", ") })), [query.data]);
  const store = query.data?.find(store => store.consumerId === selected && validStoreLocation(store.location));

  const list = useRef<FlatList>(null);
  const select = (id: string) => { setSelected(id); list.current?.scrollToOffset({ offset: 0, animated: true }); };
  return <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
    <AppHeader title="My stores map" showBack />
    {query.isPending ? <LoadingState message="Loading your stores…" /> : query.isError ? <ErrorState message="Could not load your stores." onRetry={query.refetch} /> :
      <FlatList ref={list} data={points} keyExtractor={point => point.id} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 25 }}
        ListHeaderComponent={<View className="gap-3 pb-3">
          <View className="flex-row items-center justify-between gap-2"><View className="flex-1"><Text className="font-sans-bold text-base text-ink">{points.length} store locations</Text><Text className="mt-1 font-sans text-xs text-ink-500">Tap a marker or choose a store below</Text></View><Button label="Refresh" size="sm" variant="outline" loading={query.isFetching} onPress={() => query.refetch()} /></View>
          {points.length ? <View style={{ height: 340 }}><StoreMap points={points} onSelect={select} selectedId={store ? selected : ""} /></View> : <EmptyState icon={<MapPin size={26} color={colors.ink[500]} />} title="No store locations" subtitle="Your currently managed stores with GPS will appear here." />}
          {store && <View className="rounded-2xl border border-cardamom-100 bg-cardamom-100 p-4"><View className="flex-row items-start gap-2"><View className="flex-1"><Text className="font-sans-bold text-base text-ink">{store.storeName}</Text><Text className="mt-1 font-sans text-xs text-ink-500">{store.consumerId} · {store.ownerName} · {store.phone}</Text></View><Button label="All stores" size="sm" variant="outline" onPress={() => setSelected("")} /></View><Text className="mt-2 font-sans text-xs leading-5 text-ink-700">{[store.address?.street, store.address?.city, store.address?.pincode].filter(Boolean).join(", ")}</Text><View className="mt-3 flex-row gap-2"><Button label="Directions" size="sm" variant="outline" className="flex-1" icon={<Navigation size={14} color={colors.ink.DEFAULT} />} onPress={() => openInMaps(store.location.latitude, store.location.longitude, store.storeName)} /><Button label="View orders" size="sm" className="flex-1" icon={<FileText size={14} color={colors.white} />} onPress={() => router.push({ pathname: "/(tabs)/stores/[consumerId]/orders", params: { consumerId: store.consumerId, storeName: store.storeName } })} /></View></View>}
          {points.length > 0 && <Text className="mt-2 font-display-bold text-base text-ink">Choose a store</Text>}
        </View>}
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: selected === item.id }} onPress={() => select(item.id)} className={`mb-2 flex-row items-center gap-3 rounded-xl border p-3 ${selected === item.id ? "border-cardamom-600 bg-cardamom-100" : "border-sand bg-white"}`}><MapPin size={18} color={colors.cardamom[700]} /><View className="flex-1"><Text className="font-sans-bold text-sm text-ink">{item.name}</Text><Text className="mt-1 font-sans text-xs text-ink-500">{item.id} · {item.detail}</Text></View><ChevronRight size={17} color={colors.ink[500]} /></Pressable>} />}
  </SafeAreaView>;
}
