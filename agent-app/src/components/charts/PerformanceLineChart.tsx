import { useState } from "react";
import { View, Text, type LayoutChangeEvent } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { colors } from "@/theme/colors";

const MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 🔥 FIX: fills in any months missing from the backend's response with
// zero-value entries, so the chart always shows a full, complete-looking
// year instead of just 2-3 lonely points with a huge gap of empty space.
function fillFullYear(data: { month: string; sales: number }[]) {
  const byMonth = new Map(data.map((d) => [d.month, d.sales]));
  return MONTH_ORDER.map((month) => ({ month, sales: byMonth.get(month) ?? 0 }));
}

export function PerformanceLineChart({ data }: { data: { month: string; sales: number }[] }) {
  // 🔥 FIX: was computed from a fixed magic-number formula that
  // double-subtracted padding, leaving the chart much narrower than the
  // actual available space. Measuring the real container width instead —
  // correct regardless of any future spacing changes.
  const [containerWidth, setContainerWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width);

  const fullYear = fillFullYear(data);
  const chartData = fullYear.map((d) => ({ value: d.sales, label: d.month, labelTextStyle: { color: colors.ink[500], fontSize: 10 } }));
  const hasAnyValue = fullYear.some((d) => d.sales > 0);

  if (!hasAnyValue) {
    return (
      <View className="h-40 items-center justify-center">
        <Text className="font-sans text-sm text-ink-500">No sales recorded yet this year</Text>
      </View>
    );
  }

  return (
    <View onLayout={onLayout}>
      {containerWidth > 0 ? (
        <LineChart
          data={chartData}
          width={containerWidth - 16}
          height={170}
          color={colors.saffron[600]}
          thickness={3}
          curved
          areaChart
          startFillColor={colors.saffron[400]}
          endFillColor={colors.saffron[50]}
          startOpacity={0.5}
          endOpacity={0.05}
          dataPointsColor={colors.saffron[600]}
          dataPointsRadius={3}
          hideRules
          hideYAxisText
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={colors.sand.dark}
          initialSpacing={8}
          endSpacing={8}
          spacing={(containerWidth - 40) / (chartData.length - 1)}
          noOfSections={4}
          isAnimated
          animationDuration={600}
        />
      ) : null}
    </View>
  );
}
