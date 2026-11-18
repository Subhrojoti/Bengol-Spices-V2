import { useState } from "react";
import { View, Text } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";
import { Button } from "@/components/ui/Button";

/** Manual recovery only: rendering again must never automatically resend money. */
export function AppRecovery({ retry }: ErrorBoundaryProps) {
  const [trying, setTrying] = useState(false);
  return <View className="flex-1 items-center justify-center bg-cream px-8 py-16">
    <Text className="text-center font-display-bold text-xl text-ink">Couldn't display this screen</Text>
    <Text className="mt-3 text-center font-sans text-sm text-ink-500">Please reopen the screen. If you were placing an order or recording a payment, check its history before submitting again.</Text>
    <View className="mt-5"><Button label="Reopen screen" loading={trying} onPress={async () => {
      if (trying) return;
      setTrying(true);
      try { await retry(); } catch { /* Keep the recovery screen available. */ }
      finally { setTrying(false); }
    }} /></View>
  </View>;
}
