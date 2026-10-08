import { useThemeMode } from "./useThemeMode";

/* The parts of a chart that are not data: grid lines, axis labels, the
   hover highlight, the tooltip box. The chart library takes these as plain
   colour values, which no stylesheet can change, so each chart asks here
   for the set that suits the mode in force. Series colours are the same in
   both modes and stay with each chart. */

const LIGHT = {
  grid: "#e1e0d9",
  axis: "#898781",
  // the band or line that follows the pointer
  cursor: "rgba(15,23,42,0.04)",
  // the ring round a highlighted point, in the colour of the card behind it
  dotStroke: "#ffffff",
  // the empty part of a progress ring
  track: "#e5e7eb",
  // the library's own axes and tooltip box: left exactly as it draws them
  axisProps: {},
  tooltip: {},
};

const DARK = {
  grid: "#243044",
  axis: "#7a889d",
  cursor: "rgba(148,163,184,0.10)",
  dotStroke: "#111a2b",
  track: "#2a3649",
  axisProps: { stroke: "#3b4a61", tick: { fill: "#7a889d" } },
  tooltip: {
    contentStyle: {
      backgroundColor: "#111a2b",
      border: "1px solid #2a3649",
      borderRadius: 10,
      color: "#e2e8f0",
    },
    labelStyle: { color: "#94a3b8" },
    itemStyle: { color: "#e2e8f0" },
  },
};

/**
 * @param {object} [light]  a chart's own light-mode values, where it has
 *                          always differed from the defaults above
 */
export const useChartChrome = (light) => {
  const { dark } = useThemeMode();
  return dark ? DARK : light ? { ...LIGHT, ...light } : LIGHT;
};
