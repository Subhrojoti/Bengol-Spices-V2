import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { onCelebrate } from "@/utils/celebrate";
import { colors } from "@/theme/colors";

const PIECES = 36;
const DURATION = 2600;
const PALETTE = [colors.saffron[600], colors.saffron[400], colors.gold.DEFAULT, colors.cardamom[600], colors.chili[600], colors.maroon[600]];

interface Piece {
  left: number;
  size: number;
  color: string;
  round: boolean;
  delay: number;
  drift: number;
  spin: number;
  fall: number;
}

const between = (min: number, max: number) => min + Math.random() * (max - min);

function makePieces(width: number, height: number): Piece[] {
  return Array.from({ length: PIECES }, (_, i) => ({
    left: between(0, width - 12),
    size: between(7, 12),
    color: PALETTE[i % PALETTE.length],
    round: i % 3 === 0,
    delay: between(0, 500),
    drift: between(-60, 60),
    spin: between(2, 6) * (i % 2 ? 1 : -1),
    fall: between(height * 0.55, height * 0.95),
  }));
}

/**
 * Confetti falling over the whole screen for a couple of seconds, whenever
 * something calls celebrate(). Mounted once, in the root layout, so it shows
 * over any screen. It never takes a touch, and draws nothing at all between
 * celebrations.
 *
 * Built on React Native's own Animated, moved on the native thread, so it
 * needs no extra library and does not stutter while a list is loading.
 */
export function Confetti() {
  const [burst, setBurst] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const { width, height } = Dimensions.get("window");

  useEffect(() => onCelebrate(() => setBurst((n) => n + 1)), []);

  // A fresh scatter for each celebration
  const pieces = useMemo(() => (burst > 0 ? makePieces(width, height) : []), [burst, width, height]);

  useEffect(() => {
    if (burst === 0) return undefined;

    progress.setValue(0);
    const run = Animated.timing(progress, { toValue: 1, duration: DURATION + 500, easing: Easing.linear, useNativeDriver: true });
    run.start(({ finished }) => {
      if (finished) setBurst(0);
    });

    return () => run.stop();
  }, [burst, progress]);

  if (burst === 0) return null;

  const total = DURATION + 500;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((piece, i) => {
        const start = piece.delay / total;
        const end = (piece.delay + DURATION) / total;
        const range = [0, start, end, 1];

        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              top: -20,
              left: piece.left,
              width: piece.size,
              height: piece.round ? piece.size : piece.size * 1.6,
              borderRadius: piece.round ? piece.size / 2 : 2,
              backgroundColor: piece.color,
              opacity: progress.interpolate({ inputRange: [0, start, start + 0.02, end - 0.12, end, 1], outputRange: [0, 0, 1, 1, 0, 0], extrapolate: "clamp" }),
              transform: [
                { translateY: progress.interpolate({ inputRange: range, outputRange: [0, 0, piece.fall, piece.fall], extrapolate: "clamp" }) },
                { translateX: progress.interpolate({ inputRange: range, outputRange: [0, 0, piece.drift, piece.drift], extrapolate: "clamp" }) },
                { rotate: progress.interpolate({ inputRange: range, outputRange: ["0deg", "0deg", `${piece.spin * 180}deg`, `${piece.spin * 180}deg`], extrapolate: "clamp" }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
