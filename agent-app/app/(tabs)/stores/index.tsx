import { useMemo, useState } from "react";
import { View, Text, Image, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Plus, Search, Phone, MapPin, Store as StoreIcon, FileText, PackagePlus, Warehouse, Truck, Navigation, UtensilsCrossed, Map, ChevronRight, PencilLine } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useMyStores } from "@/hooks/useStores";
import type { Store, StoreType } from "@/types/api";
import { colors } from "@/theme/colors";
import { getErrorMessage } from "@/api/client";
import { openInMaps } from "@/utils/maps";
import { sizedImage } from "@/utils/image";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { validStoreLocation } from "@/utils/storeCorrection";

const STORE_TYPE_LABEL: Record<Store["storeType"], string> = {
  RETAILER: "Retailer",
  WHOLESALER: "Wholesaler",
  DISTRIBUTOR: "Distributor",
  HORECA: "HoReCa",
};

const STORE_TYPE_ICON: Record<Store["storeType"], typeof StoreIcon> = {
  RETAILER: StoreIcon,
  WHOLESALER: Warehouse,
  DISTRIBUTOR: Truck,
  HORECA: UtensilsCrossed,
};

type TypeFilter = "ALL" | StoreType;

export default function MyStoresScreen() {
  const router = useRouter();
  const { data: stores, isLoading, isError, refetch, error } = useMyStores();
  const { pulling, onPull } = usePullToRefresh(refetch);
  useRefetchOnFocus(["stores"]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");

  const counts = useMemo(() => {
    const c: Record<TypeFilter, number> = { ALL: stores?.length ?? 0, RETAILER: 0, WHOLESALER: 0, DISTRIBUTOR: 0, HORECA: 0 };
    stores?.forEach((s) => {
      // a type this version of the app has not heard of is still in "All"
      if (s.storeType in c) c[s.storeType]++;
    });
    return c;
  }, [stores]);

  const filtered = useMemo(() => {
    if (!stores) return [];
    let list = stores;
    if (typeFilter !== "ALL") {
      list = list.filter((s) => s.storeType === typeFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          [s.storeName, s.ownerName, s.consumerId, s.phone, s.address?.city, s.address?.pincode].some(value => String(value || "").toLowerCase().includes(q)),
      );
    }
    return list;
  }, [stores, query, typeFilter]);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between gap-3 px-5 pb-3 pt-2">
        <View className="min-w-0 flex-1"><Text className="font-display-bold text-2xl text-ink">My Stores</Text><Text className="mt-0.5 font-sans text-xs text-ink-500">Orders, directions and store details</Text></View>
        <Button label="Add store" size="sm" icon={<Plus size={16} color={colors.white} />} onPress={() => router.push("/new-store")} />
      </View>

      {isLoading ? (
        <LoadingState message="Loading your stores…" />
      ) : isError ? (
        <ErrorState message={getErrorMessage(error, "Couldn't load your stores.")} onRetry={refetch} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 14 }}
          refreshing={pulling}
          onRefresh={onPull}
          ListHeaderComponent={
              <View className="mb-1 gap-3">
                <Pressable accessibilityRole="button" accessibilityLabel="Open stores map" onPress={() => router.push("/store-map")} className="flex-row items-center gap-3 rounded-2xl border border-cardamom-100 bg-cardamom-100 p-4 active:opacity-80">
                  <View className="h-11 w-11 items-center justify-center rounded-xl bg-white"><Map size={23} color={colors.cardamom[700]} /></View>
                  <View className="min-w-0 flex-1"><Text className="font-sans-bold text-base text-cardamom-700">View stores on map</Text><Text className="mt-1 font-sans text-xs leading-4 text-cardamom-700">See your store locations and get directions</Text></View><ChevronRight size={19} color={colors.cardamom[700]} />
                </Pressable>
                {stores && stores.length > 0 && <>
                <Input
                  placeholder="Search name, phone, city or store ID"
                  value={query}
                  onChangeText={setQuery}
                  leftIcon={<Search size={16} color={colors.ink[500]} />}
                />
                <SegmentedControl
                  segments={[
                    { value: "ALL", label: "All", count: counts.ALL },
                    { value: "RETAILER", label: "Retailer", count: counts.RETAILER },
                    { value: "WHOLESALER", label: "Wholesaler", count: counts.WHOLESALER },
                    { value: "DISTRIBUTOR", label: "Distributor", count: counts.DISTRIBUTOR },
                    { value: "HORECA", label: "HoReCa", count: counts.HORECA },
                  ]}
                  value={typeFilter}
                  onChange={setTypeFilter}
                />
                <Text className="font-sans text-xs text-ink-500">{filtered.length} of {stores.length} stores</Text>
                </>}
              </View>
          }
          ListEmptyComponent={
            stores && stores.length > 0 ? (
              <EmptyState icon={<StoreIcon size={26} color={colors.ink[500]} />} title="No stores match this filter" subtitle="Try a different store type or clear your search." />
            ) : (
              <EmptyState
                icon={<StoreIcon size={26} color={colors.ink[500]} />}
                title="No stores yet"
                subtitle="Create your first store to start placing orders for it."
                action={<Button label="Create Store" onPress={() => router.push("/new-store")} />}
              />
            )
          }
          renderItem={({ item }) => <StoreCard store={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function StoreImage({ url }: { url?: string }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  return url && !photoFailed ? <Image source={{ uri: sizedImage(url, 64) }} onError={() => setPhotoFailed(true)} className="h-16 w-16 rounded-2xl border border-sand-dark" /> : <View className="h-16 w-16 items-center justify-center rounded-2xl bg-saffron-50"><StoreIcon size={28} color={colors.saffron[700]} /></View>;
}

function StoreCard({ store }: { store: Store }) {
  const router = useRouter();
  const hasLocation = validStoreLocation(store.location);
  // Falls back, so a store type added later cannot blank this screen
  const TypeIcon = STORE_TYPE_ICON[store.storeType] ?? StoreIcon;

  return (
    <Card className="relative overflow-hidden">
      <View className="absolute -bottom-5 -right-5 opacity-[0.06]" pointerEvents="none">
        <StoreIcon size={110} color={colors.maroon[900]} />
      </View>

      <View className="flex-row items-start gap-3">
        <View className="relative">
          <StoreImage key={store.image?.url || "missing"} url={store.image?.url} />
          <View className="absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-saffron-600">
            <TypeIcon size={11} color={colors.white} />
          </View>
        </View>

        <View className="flex-1">
            <Text className="font-display-bold text-lg text-ink" numberOfLines={2}>
              {store.storeName}
            </Text>
          <Text className="mb-1 mt-0.5 font-sans text-[11px] text-ink-500">{store.consumerId}</Text>
          <Text className="font-sans-medium text-sm text-ink-700" numberOfLines={1}>
            {store.ownerName}
          </Text>
          <View className="mt-1 flex-row items-center gap-1.5">
            <Phone size={11} color={colors.ink[500]} />
            <Text className="font-sans text-xs text-ink-500">{store.phone}</Text>
          </View>
          <View className="mt-0.5 flex-row items-center gap-1.5">
            <MapPin size={11} color={colors.ink[500]} />
            <Text className="flex-1 font-sans text-xs text-ink-500" numberOfLines={2}>
              {[store.address?.street, store.address?.city].filter(Boolean).join(", ") || "Address not recorded"}
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-row flex-wrap items-center gap-2">
          <Badge label={STORE_TYPE_LABEL[store.storeType] ?? store.storeType} variant="info" />
          <Badge label={store.status} variant={store.status === "ACTIVE" ? "success" : "neutral"} />
        </View>
        <View className="rounded-lg bg-saffron-50 px-3 py-1.5"><Text className="font-sans text-[10px] text-saffron-700">Delivery code <Text className="font-sans-bold text-sm">{store.deliveryCode || "Not available"}</Text></Text></View>
      </View>
      <View className="mt-3 border-t border-sand pt-3">
        <Pressable accessibilityRole="button" accessibilityLabel={`Get directions to ${store.storeName}`} accessibilityState={{ disabled: !hasLocation }} disabled={!hasLocation}
          onPress={() => openInMaps(store.location.latitude, store.location.longitude, store.storeName)}
          className="min-h-11 flex-row items-center justify-center gap-2 rounded-xl bg-saffron-50 px-3 py-2 active:opacity-80"
        >
          <Navigation size={15} color={colors.saffron[700]} />
          <Text className="shrink font-sans-bold text-sm text-saffron-700">{hasLocation ? "Get directions" : "Store location unavailable"}</Text>
        </Pressable>
      </View>

      <View className="mt-4 flex-row gap-2.5">
        <Button
          label="View Orders"
          variant="outline"
          size="sm"
          icon={<FileText size={14} color={colors.ink.DEFAULT} />}
          onPress={() => router.push({ pathname: "/(tabs)/stores/[consumerId]/orders", params: { consumerId: store.consumerId, storeName: store.storeName } })}
          className="flex-1"
        />
        <Button
          label="Create Order"
          disabled={store.status !== "ACTIVE"}
          size="sm"
          icon={<PackagePlus size={14} color={colors.white} />}
          onPress={() =>
            router.push({
              pathname: "/(tabs)/stores/[consumerId]/create-order",
              params: { consumerId: store.consumerId, storeName: store.storeName, storeType: store.storeType },
            })
          }
          className="flex-1"
        />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Request changes for ${store.storeName}`} onPress={() => router.push({ pathname: "/store-changes/[consumerId]", params: { consumerId: store.consumerId } })} className="mt-3 flex-row items-center gap-3 rounded-xl border border-cardamom-100 bg-cardamom-100 px-3 py-3 active:opacity-80"><PencilLine size={18} color={colors.cardamom[700]} /><View className="min-w-0 flex-1"><Text className="font-sans-bold text-sm text-cardamom-700">Request store correction</Text><Text className="mt-0.5 font-sans text-[11px] text-cardamom-700">Details, photo or location · Office approval</Text></View><ChevronRight size={17} color={colors.cardamom[700]} /></Pressable>
    </Card>
  );
}
