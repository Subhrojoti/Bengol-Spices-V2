import * as Location from "expo-location";

/* Where the phone is, read once, at the moment the partner presses a
   button. Nothing here runs in the background or follows anyone around:
   the position is asked for, sent with that one action, and forgotten.

   The server decides what a position is worth (see BackEnd/utils/geo.js).
   The distance worked out here only lets the app say "you are 2 km from
   the store" before the partner has asked the store owner for their code,
   rather than after. */

export interface Fix {
  latitude: number;
  longitude: number;
  /** The phone's own estimate of how far off it may be, in metres */
  accuracy: number | null;
  /** Android says so when the position came from a fake-GPS app */
  mocked: boolean;
}

export type FixResult =
  | { ok: true; fix: Fix }
  /** permission: not allowed this time. blocked: refused for good, only Settings can change it.
      off: the phone's location switch is off. unavailable: no reading could be had. */
  | { ok: false; reason: "permission" | "blocked" | "off" | "unavailable" };

// The same allowance the server gives a phone's stated error
const ACCURACY_ALLOWANCE_MAX_M = 60;

const wait = (ms: number) => new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));

/**
 * @param timeoutMs how long to wait for a fresh reading. A delivery waits
 *   for a good one; an earlier step takes what it can get quickly.
 */
export async function readLocation(timeoutMs = 15000): Promise<FixResult> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();

    if (!permission.granted) {
      if (!permission.canAskAgain) return { ok: false, reason: "blocked" };
      permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return { ok: false, reason: permission.canAskAgain ? "permission" : "blocked" };
    }

    if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: "off" };

    const position =
      (await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), wait(timeoutMs)])) ??
      // No fresh reading in time: one from the last minute will do
      (await Location.getLastKnownPositionAsync({ maxAge: 60 * 1000 }));

    if (!position) return { ok: false, reason: "unavailable" };

    return {
      ok: true,
      fix: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: typeof position.coords.accuracy === "number" ? Math.round(position.coords.accuracy) : null,
        mocked: position.mocked === true,
      },
    };
  } catch {
    // Location switched off mid-read, no provider, and the like
    return { ok: false, reason: "unavailable" };
  }
}

/** What to tell the partner when no position could be read. */
export const LOCATION_HELP: Record<Exclude<FixResult, { ok: true }>["reason"], string> = {
  permission: "Allow Bengol Delivery to use your location, then try again.",
  blocked: "Location is turned off for Bengol Delivery. Open Settings, allow location for this app, then try again.",
  off: "Your phone's location is switched off. Turn it on, then try again.",
  unavailable: "Your phone could not find its location. Step outside or near a window, wait a few seconds, then try again.",
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Metres between two points on the ground. */
export function distanceInMetres(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Is this reading close enough to the store to confirm a delivery there? */
export function isAtStore(fix: Fix, store: { latitude: number; longitude: number }, radiusMetres: number): { near: boolean; distance: number } {
  const distance = Math.round(distanceInMetres(fix, store));
  const allowance = Math.min(fix.accuracy ?? 0, ACCURACY_ALLOWANCE_MAX_M);
  return { near: distance - allowance <= radiusMetres, distance };
}

/** 45 → "45 m", 2380 → "2.4 km" */
export const formatDistance = (metres: number) => (metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`);
