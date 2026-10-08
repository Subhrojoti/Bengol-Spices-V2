import { Stack } from "expo-router";

// 🔥 FIX: without this file, Expo Router's Tabs navigator had no way to
// know that index/create/[consumerId]/orders/[consumerId]/create-order all
// belong under ONE "Stores" tab — it was surfacing each file as its own
// separate top-level tab instead (the "stores..." duplicates you saw).
export default function StoresLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="[consumerId]/orders" />
      <Stack.Screen name="[consumerId]/create-order" />
    </Stack>
  );
}
