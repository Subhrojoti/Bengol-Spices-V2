/* Positions sent by a phone, and how far one is from a store. */

const EARTH_RADIUS_M = 6371000;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/* A phone's position is never exact, and says how inexact it is
   (`accuracy`, in metres). A partner standing at the shop door with a
   reading that is 40 m out should not be refused, so that stated error is
   taken off the measured distance before it is compared with the limit.
   It is capped: the figure comes from the phone, and an unlimited allowance
   would let a reading claiming "accurate to 5 km" pass from anywhere. */
export const ACCURACY_ALLOWANCE_MAX_M = 60;

/** Metres between two points on the ground (great-circle distance). */
export const distanceInMetres = (from, to) => {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
};

const isCoordinate = (value, limit) =>
  typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;

/**
 * A usable point from anything shaped like { latitude, longitude }, or null.
 * 0,0 is what a phone with no fix reports, not a place a delivery happens.
 */
export const toPoint = (value) => {
  if (!value || typeof value !== "object") return null;

  const { latitude, longitude } = value;
  if (!isCoordinate(latitude, 90) || !isCoordinate(longitude, 180)) return null;
  if (latitude === 0 && longitude === 0) return null;

  return { latitude, longitude };
};

/**
 * The position a delivery partner's phone sent with a request, cleaned up,
 * or null when it sent none or sent something unusable. Never throws: a
 * malformed position is treated as no position.
 */
export const readLocation = (value) => {
  const point = toPoint(value);
  if (!point) return null;

  const accuracy =
    typeof value.accuracy === "number" &&
    Number.isFinite(value.accuracy) &&
    value.accuracy >= 0
      ? Math.round(value.accuracy)
      : null;

  return { ...point, accuracy, mocked: value.mocked === true };
};

/**
 * Is this position at the store?
 *
 * @param {object|null} location  from readLocation
 * @param {object|null} store     the store's saved { latitude, longitude }
 * @param {number} radius         metres that count as "at the store"
 * @returns {{ problem: string|null, distance: number|null }}
 *   problem is null when the position is acceptable, else one of
 *   "NO_LOCATION", "MOCKED", "TOO_FAR".
 */
export const checkAtStore = (location, store, radius) => {
  if (!location) return { problem: "NO_LOCATION", distance: null };

  const storePoint = toPoint(store);
  const distance = storePoint
    ? Math.round(distanceInMetres(location, storePoint))
    : null;

  // A position a fake-GPS app supplied says nothing about where the phone is
  if (location.mocked) return { problem: "MOCKED", distance };

  // No saved position for the store: nothing to compare with
  if (distance === null) return { problem: null, distance: null };

  const allowance = Math.min(location.accuracy ?? 0, ACCURACY_ALLOWANCE_MAX_M);

  return {
    problem: distance - allowance > radius ? "TOO_FAR" : null,
    distance,
  };
};

/** 45 → "45 m", 2380 → "2.4 km" */
export const formatDistance = (metres) =>
  metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
