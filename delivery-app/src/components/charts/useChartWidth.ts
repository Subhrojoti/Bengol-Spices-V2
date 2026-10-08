import { useCallback, useState } from "react";
import type { LayoutChangeEvent } from "react-native";

/**
 * Measures the real width of the chart's container so the chart can fill it
 * exactly, instead of guessing from the screen width and hard-coded paddings.
 */
export function useChartWidth() {
  const [width, setWidth] = useState(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  }, []);

  return { width, onLayout };
}
