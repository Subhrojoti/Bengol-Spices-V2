import { useMemo, useState } from "react";
import { View, Text, Image, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Plus, Search, Phone, MapPin, Store as StoreIcon, FileText, PackagePlus, Warehouse, Truck, Navigation, UtensilsCrossed } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/States";
import { useMyStores } from "@/hooks/useStores";
import type { Store, StoreType } from "@/types/api";
import { colors } from "@/theme/colors";
import { getErrorMessage } from "@/api/client";
import { openInMaps } from "@/utils/maps";

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
  const { data: stores, isLoading, isError, isFetching, refetch, error } = useMyStores();
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
          s.storeName.toLowerCase().includes(q) ||
          s.ownerName.toLowerCase().includes(q) ||
          s.consumerId.toLowerCase().includes(q) ||
          s.address.city.toLowerCase().includes(q),
      );
    }
    return list;
  }, [stores, query, typeFilter]);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-1 pt-2">
        <Text className="font-display-bold text-2xl text-ink">My Stores</Text>
        <IconButton onPress={() => router.push("/(tabs)/stores/create")} className="bg-saffron-600">
          <Plus size={20} color={colors.white} />
        </IconButton>
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
          refreshing={isFetching}
          onRefresh={refetch}
          ListHeaderComponent={
            stores && stores.length > 0 ? (
              <View className="mb-1 gap-3">
                <Input
                  placeholder="Search stores by name, owner, city…"
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
              </View>
            ) : null
          }
          ListEmptyComponent={
            stores && stores.length > 0 ? (
              <EmptyState icon={<StoreIcon size={26} color={colors.ink[500]} />} title="No stores match this filter" subtitle="Try a different store type or clear your search." />
            ) : (
              <EmptyState
                icon={<StoreIcon size={26} color={colors.ink[500]} />}
                title="No stores yet"
                subtitle="Create your first store to start placing orders for it."
                action={<Button label="Create Store" onPress={() => router.push("/(tabs)/stores/create")} />}
              />
            )
          }
          renderItem={({ item }) => <StoreCard store={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function StoreCard({ store }: { store: Store }) {
  const router = useRouter();
  // Falls back, so a store type added later cannot blank this screen
  const TypeIcon = STORE_TYPE_ICON[store.storeType] ?? StoreIcon;

  return (
    <Card className="relative overflow-hidden">
      <View className="absolute -bottom-5 -right-5 opacity-[0.06]" pointerEvents="none">
        <StoreIcon size={110} color={colors.maroon[900]} />
      </View>

      <View className="flex-row items-start gap-3">
        <View className="relative">
          <Image source={{ uri: store.image.url }} className="h-16 w-16 rounded-full border-2 border-sand-dark" />
          <View className="absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-saffron-600">
            <TypeIcon size={11} color={colors.white} />
          </View>
        </View>

        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 font-display-bold text-xl text-ink" numberOfLines={1}>
              {store.storeName}
            </Text>
            <View className="items-end">
              <Text className="font-sans text-[10px] text-ink-500">Delivery Code</Text>
              <Text className="font-sans-bold text-lg text-saffron-700">{store.deliveryCode}</Text>
            </View>
          </View>
          <Text className="font-sans-medium text-sm text-ink-700" numberOfLines={1}>
            {store.ownerName}
          </Text>
          <View className="mt-1 flex-row items-center gap-1.5">
            <Phone size={11} color={colors.ink[500]} />
            <Text className="font-sans text-xs text-ink-500">{store.phone}</Text>
          </View>
          <View className="mt-0.5 flex-row items-center gap-1.5">
            <MapPin size={11} color={colors.ink[500]} />
            <Text className="font-sans text-xs text-ink-500" numberOfLines={1}>
              {store.address.street}, {store.address.city}
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-3 flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          <Badge label={STORE_TYPE_LABEL[store.storeType] ?? store.storeType} variant="info" />
          <Badge label={store.status} variant={store.status === "ACTIVE" ? "success" : "neutral"} />
        </View>
        <Pressable
          onPress={() => openInMaps(store.location.latitude, store.location.longitude, store.storeName)}
          className="flex-row items-center gap-1.5 rounded-full bg-saffron-600 px-3.5 py-2 active:opacity-80"
        >
          <Navigation size={14} color={colors.white} />
          <Text className="font-sans-bold text-xs text-white">Navigate</Text>
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
    </Card>
  );
}
