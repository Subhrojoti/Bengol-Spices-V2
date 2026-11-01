import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MapPin, ChevronRight, Navigation, Plus, ArrowUp, ArrowDown, Trash2 } from "lucide-react-native";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { StoreMap } from "@/components/maps/StoreMap";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useAssignedOrders } from "@/hooks/useOrders";
import { openInMaps } from "@/utils/maps";
import { deliveryDestinations, activeStopIds, addStop, moveStop } from "@/utils/deliveryView";
import { colors } from "@/theme/colors";

export default function DeliveryMapScreen() {
  const query = useAssignedOrders(), router = useRouter();
  const [selected, setSelected] = useState(""), [stopIds, setStopIds] = useState<string[]>([]);
  const destinations = useMemo(() => deliveryDestinations(query.data || []), [query.data]);
  const activeIds = activeStopIds(stopIds, destinations);
  const stops = activeIds.map(id => destinations.find(point => point.id === id)!);
  const unplanned = destinations.filter(point => !activeIds.includes(point.id));
  const rows = [...stops, ...unplanned];
  const point = destinations.find(point => point.id === selected);
  useEffect(() => { setStopIds(ids => { const next = activeStopIds(ids, destinations); return next.join("|") === ids.join("|") ? ids : next; }); }, [destinations]);
  const add = (id: string) => setStopIds(ids => addStop(activeStopIds(ids, destinations), id));
  const list = useRef<FlatList>(null);
  const select = (id: string) => { setSelected(id); list.current?.scrollToOffset({ offset: 0, animated: true }); };
  return <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
    <AppHeader title="Delivery map and stops" showBack />
    {query.isPending ? <LoadingState message="Loading destinations..." /> : query.isError ? <ErrorState message="Could not load assigned deliveries." onRetry={query.refetch} /> :
      <FlatList ref={list} data={rows} keyExtractor={item => item.id} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 25 }}
        ListHeaderComponent={<View className="gap-3 pb-3">
          <View className="flex-row items-center justify-between gap-3"><View className="flex-1"><Text className="font-sans-bold text-base text-ink">{destinations.length} active {destinations.length === 1 ? "destination" : "destinations"}</Text><Text className="mt-1 font-sans text-xs text-ink-500">Tap a marker or choose a store below</Text></View><Button label="Refresh" size="sm" variant="outline" loading={query.isFetching} onPress={() => query.refetch()} /></View>
          {destinations.length ? <View style={{ height: 340 }}><StoreMap points={destinations} onSelect={select} selectedId={point ? selected : ""} appName="BengolDelivery" /></View> : <EmptyState icon={<MapPin size={26} color={colors.ink[500]} />} title="No active destinations" subtitle="Assigned deliveries with valid store locations appear here." />}
          {point && <View className="rounded-2xl border border-cardamom-100 bg-cardamom-100 p-4"><Text className="font-sans-bold text-base text-ink">{point.name}</Text><Text className="mt-1 font-sans text-xs leading-5 text-ink-700">{point.detail} · {point.orders.length} {point.orders.length === 1 ? "delivery" : "deliveries"}</Text><View className="mt-3 flex-row flex-wrap gap-2"><Button label="Directions" size="sm" variant="outline" icon={<Navigation size={14} color={colors.ink.DEFAULT} />} onPress={() => openInMaps(point.latitude, point.longitude, point.name)} /><Button label={activeIds.includes(point.id) ? "Remove stop" : "Add stop"} size="sm" variant="outline" onPress={() => setStopIds(ids => activeIds.includes(point.id) ? ids.filter(id => id !== point.id) : addStop(activeStopIds(ids, destinations), point.id))} /><Button label="All destinations" size="sm" variant="outline" onPress={() => setSelected("")} /></View><Text className="mb-2 mt-4 font-sans-semibold text-xs text-ink-700">Deliveries at this store</Text>{point.orders.map(id => <Pressable key={id} accessibilityRole="button" accessibilityLabel={`Open delivery ${id}`} onPress={() => router.push({ pathname: "/deliveries/[orderId]", params: { orderId: id } })} className="mb-2 flex-row items-center justify-between rounded-xl bg-white px-3 py-3"><Text className="flex-1 font-sans-bold text-sm text-ink">{id}</Text><ChevronRight size={16} color={colors.ink[500]} /></Pressable>)}</View>}
          {destinations.length > 0 && <View className="rounded-xl bg-saffron-50 p-3"><Text className="font-sans text-xs leading-5 text-ink-700">Add stores in your preferred order, then use directions for each stop. Other destinations stay available below. This is a manual plan; your maps app provides road directions.</Text></View>}
          {destinations.length > 0 && <View className="flex-row items-center justify-between gap-2"><Text className="flex-1 font-display-bold text-base text-ink">{stops.length ? `Planned stops (${stops.length})` : "Choose stops"}</Text>{stops.length > 0 && <Button label="Clear plan" size="sm" variant="outline" onPress={() => setStopIds([])} />}</View>}
        </View>}
        renderItem={({ item, index }) => {
          const planned = index < stops.length;
          return <View>{stops.length > 0 && index === stops.length && <Text className="mb-3 mt-3 font-display-bold text-base text-ink">Other destinations ({unplanned.length})</Text>}<View className={`mb-3 rounded-xl border p-3 ${selected === item.id ? "border-cardamom-600 bg-cardamom-100" : "border-sand bg-white"}`}><Pressable accessibilityRole="button" onPress={() => select(item.id)} className="flex-row items-center gap-3 py-1"><View className="h-9 w-9 items-center justify-center rounded-xl bg-saffron-50">{planned ? <Text className="font-sans-bold text-sm text-saffron-700">{index + 1}</Text> : <MapPin size={17} color={colors.saffron[700]} />}</View><View className="flex-1"><Text className="font-sans-bold text-sm text-ink">{item.name}</Text><Text className="mt-1 font-sans text-xs text-ink-500">{item.orders.length} {item.orders.length === 1 ? "delivery" : "deliveries"} · {item.id}</Text></View><ChevronRight size={16} color={colors.ink[500]} /></Pressable><View className="mt-3 flex-row flex-wrap gap-2">{planned ? <><Button label="Up" size="sm" variant="outline" icon={<ArrowUp size={14} color={colors.ink.DEFAULT} />} disabled={index === 0} onPress={() => setStopIds(ids => moveStop(activeStopIds(ids, destinations), item.id, -1))} /><Button label="Down" size="sm" variant="outline" icon={<ArrowDown size={14} color={colors.ink.DEFAULT} />} disabled={index === stops.length - 1} onPress={() => setStopIds(ids => moveStop(activeStopIds(ids, destinations), item.id, 1))} /><Button label="Remove" size="sm" variant="outline" icon={<Trash2 size={14} color={colors.ink.DEFAULT} />} onPress={() => setStopIds(ids => ids.filter(id => id !== item.id))} /></> : <Button label="Add stop" size="sm" variant="outline" icon={<Plus size={14} color={colors.ink.DEFAULT} />} onPress={() => add(item.id)} />}</View></View></View>;
        }} />}
  </SafeAreaView>;
}
