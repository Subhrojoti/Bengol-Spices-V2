import { View, Text } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { colors } from "@/theme/colors";
import { useChartWidth } from "./useChartWidth";

interface YearPoint {
  year: number;
  delivered: number;
}

const Y_AXIS_WIDTH = 0;
const MAX_BAR_WIDTH = 48;
const CHART_HEIGHT = 160;

export function YearlyComparisonChart({ data }: { data: YearPoint[] }) {
  const { width, onLayout } = useChartWidth();

  // Backend returns most-recent-first; show oldest-to-newest left-to-right.
  const ordered = [...data].reverse();
  const chartData = ordered.map((d) => ({
    value: d.delivered,
    label: String(d.year),
    frontColor: colors.saffron[600],
    labelTextStyle: { color: colors.ink[500], fontSize: 11 },
  }));

  if (chartData.length === 0) {
    return (
      <View className="h-40 items-center justify-center">
        <Text className="font-sans text-sm text-ink-500">No yearly data yet</Text>
      </View>
    );
  }

  // Spread the bars evenly across the full card width: equal gaps before,
  // between and after the bars, with a capped bar width so two or three
  // years do not turn into huge slabs.
  const count = chartData.length;
  const chartWidth = Math.max(width - Y_AXIS_WIDTH, 0);
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.floor((chartWidth / count) * 0.5));
  const spacing = Math.max((chartWidth - barWidth * count) / (count + 1), 0);

  return (
    <View onLayout={onLayout} style={{ width: "100%", minHeight: CHART_HEIGHT }}>
      {width > 0 ? (
        <BarChart
          data={chartData}
          width={chartWidth}
          height={CHART_HEIGHT}
          barWidth={barWidth}
          spacing={spacing}
          initialSpacing={spacing}
          endSpacing={spacing}
          yAxisLabelWidth={Y_AXIS_WIDTH}
          disableScroll
          barBorderRadius={6}
          hideRules
          hideYAxisText
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={colors.sand.dark}
          isAnimated
          animationDuration={600}
        />
      ) : null}
    </View>
  );
}
