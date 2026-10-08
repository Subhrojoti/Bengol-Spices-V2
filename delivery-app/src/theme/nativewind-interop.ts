// NativeWind only registers React Native's core components (View, Text, ...)
// and SafeAreaView for `className`. Any other component silently ignores it.
// Register the third-party components we style with className so that e.g.
// `rounded-3xl overflow-hidden` on a LinearGradient actually applies.
import { cssInterop } from "nativewind";
import { LinearGradient } from "expo-linear-gradient";

cssInterop(LinearGradient, { className: "style" });
