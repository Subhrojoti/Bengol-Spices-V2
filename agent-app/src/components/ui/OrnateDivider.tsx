import { View } from "react-native";
import { Flower2 } from "lucide-react-native";

export function OrnateDivider({ color = "#D4C3A3", iconColor }: { color?: string; iconColor?: string }) {
  return (
    <View className="my-4 flex-row items-center gap-3">
      <View className="h-px flex-1" style={{ backgroundColor: color }} />
      <Flower2 size={14} color={iconColor ?? color} />
      <View className="h-px flex-1" style={{ backgroundColor: color }} />
    </View>
  );
}
