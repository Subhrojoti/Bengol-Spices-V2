import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, TextInput, View } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import { colors } from "@/theme/colors";
import { toast } from "@/utils/toast";

// Five digits. The server refuses anything it does not have in stock.
const MAX_QUANTITY = 99999;

interface QuantityStepperProps {
  /** The quantity. 0 only while the box has been cleared and is still being typed in. */
  value: number;
  /** The fewest that can be ordered (the product's minimum order quantity). */
  min?: number;
  onChange: (quantity: number) => void;
  size?: "sm" | "md";
  accessibilityLabel?: string;
}

/**
 * − [ 12 ] +  where the number can be typed as well as stepped.
 *
 * Every keystroke goes straight to `onChange`, so what the box shows is
 * always what the caller holds: there is no typed-but-not-applied number
 * that an order could be placed without. While typing, the value can for a
 * moment be 0 (box cleared) or below the minimum; leaving the box puts it
 * right, and the caller should refuse to submit a quantity below `min`.
 */
export function QuantityStepper({ value, min = 1, onChange, size = "sm", accessibilityLabel = "Quantity" }: QuantityStepperProps) {
  const floor = Math.max(1, Math.floor(Number(min)) || 1);
  const [focused, setFocused] = useState(false);
  // What to go back to if the box is left empty
  const before = useRef(Math.max(value, floor));
  const input = useRef<TextInput>(null);

  // Android's back button closes the keyboard but leaves the box focused, so
  // a quantity left below the minimum was never put right. Closing the
  // keyboard counts as leaving the box.
  useEffect(() => {
    if (!focused) return undefined;
    const closed = Keyboard.addListener("keyboardDidHide", () => input.current?.blur());
    return () => closed.remove();
  }, [focused]);

  const step = (delta: number) => onChange(Math.min(MAX_QUANTITY, Math.max(floor, value + delta)));

  const handleChangeText = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "").slice(0, 5);
    onChange(digits === "" ? 0 : Number(digits));
  };

  const handleBlur = () => {
    setFocused(false);
    if (value >= floor) return;

    if (value > 0) {
      toast.info(`Minimum order is ${floor}`, "The quantity was set to the minimum.");
      onChange(floor);
    } else {
      onChange(before.current);
    }
  };

  const md = size === "md";
  const button = `${md ? "h-9 w-9" : "h-7 w-7"} items-center justify-center rounded-full bg-cream-100 active:opacity-70`;
  const iconSize = md ? 16 : 14;

  return (
    <View className={`flex-row items-center rounded-full border bg-white ${md ? "gap-1.5 px-2 py-1" : "gap-1 px-1.5 py-1"} ${focused ? "border-saffron-400" : "border-sand-dark"}`}>
      <Pressable onPress={() => step(-1)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Decrease quantity" className={button}>
        <Minus size={iconSize} color={colors.ink.DEFAULT} />
      </Pressable>

      <TextInput
        ref={input}
        value={focused && value === 0 ? "" : String(value)}
        onChangeText={handleChangeText}
        onFocus={() => {
          before.current = Math.max(value, floor);
          setFocused(true);
        }}
        onBlur={handleBlur}
        keyboardType="number-pad"
        inputMode="numeric"
        returnKeyType="done"
        maxLength={5}
        selectTextOnFocus
        accessibilityLabel={accessibilityLabel}
        className={`text-center font-sans-bold text-ink ${md ? "min-w-[52px] text-base" : "min-w-[40px] text-sm"}`}
        // Android pads a text box by default, which pushes the number off-centre in the pill
        style={{ paddingVertical: 0, paddingHorizontal: 2, includeFontPadding: false }}
      />

      <Pressable onPress={() => step(1)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Increase quantity" className={button}>
        <Plus size={iconSize} color={colors.ink.DEFAULT} />
      </Pressable>
    </View>
  );
}
