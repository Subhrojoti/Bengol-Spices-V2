import { View, Text } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { colors } from "@/theme/colors";

export function StatusDonutChart({ delivered, cancelled, returns }: { delivered: number; cancelled: number; returns: number }) {
  const total = delivered + cancelled + returns;
  const data =
    total === 0
      ? [{ value: 1, color: colors.sand.DEFAULT }]
      : [
          { value: delivered, color: colors.cardamom[600] },
          { value: cancelled, color: colors.chili[600] },
          { value: returns, color: colors.gold.DEFAULT },
        ];
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <View className="items-center">
      <PieChart
        data={data}
        donut
        radius={72}
        innerRadius={52}
        strokeWidth={total > 0 ? 3 : 0}
        strokeColor={colors.white}
        innerCircleColor={colors.white}
        centerLabelComponent={() => (
          <View className="items-center">
            <Text className="font-display-bold text-2xl text-ink">{total}</Text>
            <Text className="font-sans text-xs text-ink-500">Orders</Text>
          </View>
        )}
      />
      <View className="mt-5 w-full flex-row items-center">
        <LegendStat color={colors.cardamom[600]} label="Delivered" count={delivered} pct={pct(delivered)} />
        <View className="h-8 w-px bg-sand" />
        <LegendStat color={colors.chili[600]} label="Cancelled" count={cancelled} pct={pct(cancelled)} />
        <View className="h-8 w-px bg-sand" />
        <LegendStat color={colors.gold.DEFAULT} label="Returns" count={returns} pct={pct(returns)} />
      </View>
    </View>
  );
}

function LegendStat({ color, label, count, pct }: { color: string; label: string; count: number; pct: number }) {
  return (
    <View className="flex-1 items-center">
      <View className="flex-row items-center gap-1.5">
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <Text className="font-sans text-[11px] text-ink-500">{label}</Text>
      </View>
      <Text className="mt-1 font-display-bold text-base text-ink">{count}</Text>
      <Text className="font-sans text-[10px] text-ink-500">{pct}%</Text>
    </View>
  );
}
