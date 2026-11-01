import { Stack } from "expo-router";

/* The store list is always the first screen of this tab, whatever is opened
   in it directly, so Back from a store's orders always reaches the list. */
export const unstable_settings = { initialRouteName: "index" };

// 🔥 FIX: without this file, Expo Router's Tabs navigator had no way to
// know that index/[consumerId]/orders/[consumerId]/create-order all
// belong under ONE "Stores" tab — it was surfacing each file as its own
// separate top-level tab instead (the "stores..." duplicates you saw).
// (Creating a store is a screen of its own over the tabs: app/new-store.tsx)
export default function StoresLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[consumerId]/orders" />
      <Stack.Screen name="[consumerId]/create-order" />
    </Stack>
  );
}
