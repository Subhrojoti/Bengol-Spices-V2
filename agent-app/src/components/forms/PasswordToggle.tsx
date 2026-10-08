import { Pressable } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { colors } from "@/theme/colors";

/** Eye / eye-off button for the `rightSlot` of a password input. */
export function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} hitSlop={8} accessibilityRole="button" accessibilityLabel={visible ? "Hide password" : "Show password"}>
      {visible ? <EyeOff size={18} color={colors.ink[500]} /> : <Eye size={18} color={colors.ink[500]} />}
    </Pressable>
  );
}
