import { useState } from "react";
import * as Location from "expo-location";

export type LocationCaptureResult =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: "permission" | "unavailable" };

export function useLocationCapture() {
  const [capturing, setCapturing] = useState(false);

  const captureLocation = async (): Promise<LocationCaptureResult> => {
    setCapturing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return { ok: false, reason: "permission" };
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      return { ok: true, latitude: position.coords.latitude, longitude: position.coords.longitude };
    } catch {
      // 🔥 FIX: with device location switched off this throws "Current location
      // is unavailable". Nothing caught it, so the tap did nothing and the
      // rejection went unhandled.
      return { ok: false, reason: "unavailable" };
    } finally {
      setCapturing(false);
    }
  };

  return { captureLocation, capturing };
}
