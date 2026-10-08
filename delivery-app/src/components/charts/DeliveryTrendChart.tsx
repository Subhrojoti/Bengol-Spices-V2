import { View, Text } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { colors } from "@/theme/colors";
import { useChartWidth } from "./useChartWidth";
import { shortMonthLabel } from "./labels";

interface MonthlyPoint {
  month: string;
  delivered: number;
}

// Y-axis text is hidden, so reserve no width for it; the line starts
// EDGE_SPACING in from the left and ends EDGE_SPACING before the right edge.
const Y_AXIS_WIDTH = 0;
const EDGE_SPACING = 16;
const CHART_HEIGHT = 170;

export function DeliveryTrendChart({ data }: { data: MonthlyPoint[] }) {
  const { width, onLayout } = useChartWidth();

  const chartData = data.map((d) => ({
    value: d.delivered,
    label: shortMonthLabel(d.month),
    labelTextStyle: { color: colors.ink[500], fontSize: 10 },
  }));

  const hasAnyValue = data.some((d) => d.delivered > 0);

  if (!hasAnyValue) {
    return (
      <View className="h-40 items-center justify-center">
        <Text className="font-sans text-sm text-ink-500">No deliveries recorded yet this year</Text>
      </View>
    );
  }

  const chartWidth = Math.max(width - Y_AXIS_WIDTH, 0);
  const spacing = chartData.length > 1 ? (chartWidth - EDGE_SPACING * 2) / (chartData.length - 1) : 0;

  return (
    <View onLayout={onLayout} style={{ width: "100%", minHeight: CHART_HEIGHT }}>
      {width > 0 ? (
        <LineChart
          data={chartData}
          width={chartWidth}
          height={CHART_HEIGHT}
          spacing={spacing}
          initialSpacing={EDGE_SPACING}
          endSpacing={EDGE_SPACING}
          yAxisLabelWidth={Y_AXIS_WIDTH}
          disableScroll
          color={colors.saffron[600]}
          thickness={3}
          curved
          areaChart
          startFillColor={colors.saffron[400]}
          endFillColor={colors.saffron[50]}
          startOpacity={0.5}
          endOpacity={0.05}
          hideDataPoints={false}
          dataPointsColor={colors.saffron[600]}
          dataPointsRadius={4}
          hideRules
          hideYAxisText
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={colors.sand.dark}
          noOfSections={4}
          isAnimated
          animationDuration={600}
        />
      ) : null}
    </View>
  );
}
