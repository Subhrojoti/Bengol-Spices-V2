import { ReactNode } from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "lucide-react-native";
import { colors } from "@/theme/colors";

const HERO_RADIUS = 28;

const styles = StyleSheet.create({
  shadow: {
    borderRadius: HERO_RADIUS,
    backgroundColor: colors.maroon[900],
    shadowColor: colors.maroon[900],
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 10,
  },
  gradient: {
    borderRadius: HERO_RADIUS,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(199,154,61,0.38)",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  orbTopRight: {
    position: "absolute",
    top: -100,
    right: -70,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(227,168,87,0.14)",
  },
  orbBottomLeft: {
    position: "absolute",
    bottom: -120,
    left: -70,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  hairline: { height: 1, backgroundColor: "rgba(255,255,255,0.14)" },
  hairlineVertical: { width: 1, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.14)" },
  statIcon: { backgroundColor: "rgba(255,255,255,0.10)" },
});

/**
 * Maroon gradient hero surface with a gold hairline, soft glow orbs and a
 * glossy sheen. The Dashboard, Leaderboard and Wallet all build on this so
 * every hero in the app shares one look.
 */
export function HeroCard({ children, style, contentStyle }: { children: ReactNode; style?: ViewStyle; contentStyle?: ViewStyle }) {
  return (
    <View style={[styles.shadow, style]}>
      <LinearGradient
        colors={[colors.maroon[900], colors.maroon[700], colors.maroon[600]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, contentStyle]}
      >
        <View pointerEvents="none" style={styles.orbTopRight} />
        <View pointerEvents="none" style={styles.orbBottomLeft} />
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </LinearGradient>
    </View>
  );
}

/** Thin hairline for use inside a HeroCard. */
export function HeroDivider({ vertical = false }: { vertical?: boolean }) {
  return <View style={vertical ? styles.hairlineVertical : styles.hairline} />;
}

/** Icon + value + label block for the bottom row of a HeroCard. */
export function HeroStat({ icon: Icon, label, value, className }: { icon: LucideIcon; label: string; value: string; className?: string }) {
  return (
    <View className={`flex-1 flex-row items-center gap-3 ${className ?? ""}`}>
      <View className="h-11 w-11 items-center justify-center rounded-xl" style={styles.statIcon}>
        <Icon size={18} color={colors.gold.DEFAULT} />
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} className="font-display-bold text-lg text-white">
          {value}
        </Text>
        <Text className="font-sans text-xs text-saffron-100">{label}</Text>
      </View>
    </View>
  );
}

/** Small-caps label used above headline numbers and inside cards. */
export function Eyebrow({ children, light = false, color }: { children: ReactNode; light?: boolean; color?: string }) {
  return (
    <Text
      className={`font-sans-semibold text-[11px] uppercase ${light ? "text-saffron-100" : "text-ink-500"}`}
      style={[{ letterSpacing: 1.4 }, color ? { color } : null]}
    >
      {children}
    </Text>
  );
}

export function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View className="mb-3 mt-6 flex-row items-end justify-between">
      <View className="flex-1 pr-3">
        <Text className="font-display-bold text-lg text-ink">{title}</Text>
        {subtitle ? <Text className="mt-0.5 font-sans text-xs text-ink-500">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "gold" }) {
  const gold = tone === "gold";
  return (
    <View className={`rounded-full border px-3 py-1 ${gold ? "border-gold/40 bg-gold-100" : "border-sand bg-white"}`}>
      <Text className={`font-sans-semibold text-[11px] ${gold ? "text-saffron-700" : "text-ink-700"}`}>{label}</Text>
    </View>
  );
}
