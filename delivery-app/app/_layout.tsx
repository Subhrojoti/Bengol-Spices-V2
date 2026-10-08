import "../global.css";
import "@/theme/nativewind-interop";
import { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet } from "react-native";
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

// Matches the top of assets/splash-screen.png so any gap between the native
// splash and our in-app splash is invisible.
const SPLASH_BACKGROUND = "#025E57";
// Keep the branded splash on screen at least this long so it doesn't flash.
const MIN_SPLASH_MS = 900;
const SPLASH_FADE_MS = 350;

export default function RootLayout() {
  useReactQueryAppStateFocus();

  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
          <BootSplash />
          <Toast config={toastConfig} />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  useEffect(() => {
    // Safety net: if BootSplash never manages to take over (e.g. the image
    // fails to load), still release the native splash once auth is resolved.
    if (!isBootstrapping) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isBootstrapping]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isBootstrapping && !isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={!isBootstrapping && isAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="notifications/index" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="profile/index" />
        <Stack.Screen name="help" />
        <Stack.Screen name="deliveries/[orderId]" />
        <Stack.Screen name="returns/[returnId]" />
      </Stack.Protected>
    </Stack>
  );
}

/**
 * Full-screen branded splash rendered by JS while the app bootstraps.
 *
 * Android 12+ only ever shows a small centered icon for the native splash, so
 * the full poster in assets/splash-screen.png can't be a native splash there.
 * Instead we show it here, on top of everything, and release the native splash
 * the moment our image has decoded. On iOS the native splash is the same
 * poster, so the hand-off is seamless.
 */
function BootSplash() {
  const { isBootstrapping } = useAuth();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;

  const releaseNativeSplash = () => {
    SplashScreen.hideAsync().catch(() => {});
  };

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isBootstrapping || !minTimeElapsed) return;
    Animated.timing(opacity, { toValue: 0, duration: SPLASH_FADE_MS, useNativeDriver: true }).start(() =>
      setVisible(false),
    );
  }, [isBootstrapping, minTimeElapsed, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity, backgroundColor: SPLASH_BACKGROUND, zIndex: 1000 }]}>
      <Image
        source={require("../assets/splash-screen.png")}
        style={{ width: "100%", height: "100%" }}
        resizeMode="cover"
        onLoad={releaseNativeSplash}
        onError={releaseNativeSplash}
      />
    </Animated.View>
  );
}
