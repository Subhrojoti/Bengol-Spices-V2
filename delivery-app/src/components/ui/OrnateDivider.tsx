import { View } from "react-native";
import { Flower2 } from "lucide-react-native";
import { colors } from "@/theme/colors";

export function OrnateDivider({ color = colors.sand.dark, iconColor }: { color?: string; iconColor?: string }) {
  return (
    <View className="my-4 flex-row items-center gap-3">
      <View className="h-px flex-1" style={{ backgroundColor: color }} />
      <Flower2 size={14} color={iconColor ?? colors.saffron[400]} />
      <View className="h-px flex-1" style={{ backgroundColor: color }} />
    </View>
  );
}
