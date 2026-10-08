import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import Toast from "react-native-toast-message";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { queryClient } from "@/api/queryClient";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { toastConfig } from "@/theme/toastConfig";
import { useReactQueryAppStateFocus } from "@/hooks/useReactQueryAppStateFocus";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useReactQueryAppStateFocus();

  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // 🔥 FIX: this used to `return null` here while fonts were loading —
  // meaning the Stack didn't exist yet during that window either, the same
  // class of bug as the isBootstrapping issue below. Now fontsReady is
  // threaded into RootNavigator and combined with isBootstrapping to
  // control ONLY when the splash screen hides — the Stack itself always
  // renders from the very first frame, regardless of font-loading state.
  const fontsReady = fontsLoaded || !!fontError;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator fontsReady={fontsReady} />
          <Toast config={toastConfig} />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const ready = fontsReady && !isBootstrapping;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  // The Stack always renders (never returns null) — Expo Router's internal
  // deep-link resolution expects the navigator to exist immediately;
  // conditionally withholding it caused a "state update on unmounted
  // component" crash. Neither guard is true until everything's ready, so
  // no screens are active yet, but the navigator container itself exists
  // from the first render — covered by the native splash screen until then.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={ready && !isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={ready && isAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="notifications/index" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="profile/index" />
        <Stack.Screen name="profile/change-password" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="help" />
        <Stack.Screen name="returns/index" />
        <Stack.Screen name="orders/[orderId]/index" />
        <Stack.Screen name="orders/[orderId]/collect-payment" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      </Stack.Protected>
    </Stack>
  );
}
