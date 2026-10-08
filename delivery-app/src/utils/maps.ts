import { Linking, Platform } from "react-native";

/** Opens the device's native maps app centered on the given coordinates —
 * no API key needed, and drivers generally prefer their own maps app
 * (with saved preferences, live traffic, turn-by-turn) over an embedded map. */
export function openInMaps(latitude: number, longitude: number, label?: string) {
  const query = label ? encodeURIComponent(label) : `${latitude},${longitude}`;
  const url = Platform.select({
    ios: `maps:0,0?q=${query}@${latitude},${longitude}`,
    android: `geo:0,0?q=${latitude},${longitude}(${query})`,
    default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
  });

  Linking.openURL(url as string).catch(() => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
  });
}
