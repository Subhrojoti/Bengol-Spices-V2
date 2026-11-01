import { useState } from "react";
import * as Location from "expo-location";

/* A store's location is saved once, here, and everything after relies on it:
   the delivery partner is sent there, and a delivery is checked against it.
   So a reading is only accepted when it can be trusted:

     mocked     a fake-location app supplied it
     imprecise  the phone itself says it may be more than MAX_ERROR_M out
                (Android gives an app that was allowed only "approximate"
                location a position off by a couple of kilometres)
     timeout    no fix came in TIMEOUT_MS (deep indoors, GPS just switched on)

   Any of these used to be saved as the store's location. */
const MAX_ERROR_M = 50;
const TIMEOUT_MS = 20000;

export type LocationCaptureResult =
  | { ok: true; latitude: number; longitude: number; accuracy: number; capturedAt: number }
  | { ok: false; reason: "permission" | "unavailable" | "mocked" | "timeout" }
  | { ok: false; reason: "imprecise"; accuracy: number };

const wait = (ms: number) => new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));

export function useLocationCapture() {
  const [capturing, setCapturing] = useState(false);

  const captureLocation = async (): Promise<LocationCaptureResult> => {
    setCapturing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return { ok: false, reason: "permission" };

      const startedAt = Date.now();
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }),
        wait(TIMEOUT_MS),
      ]);
      if (!position) return { ok: false, reason: "timeout" };

      if (position.mocked === true) return { ok: false, reason: "mocked" };
      if (!Number.isFinite(position.timestamp) || position.timestamp < startedAt - 2000 || position.timestamp > Date.now() + 30000) return { ok: false, reason: "unavailable" };

      const accuracy = position.coords.accuracy;
      if (typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy <= 0) return { ok: false, reason: "unavailable" };
      if (accuracy > MAX_ERROR_M) {
        return { ok: false, reason: "imprecise", accuracy: Math.round(accuracy) };
      }

      return { ok: true, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy, capturedAt: position.timestamp };
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
