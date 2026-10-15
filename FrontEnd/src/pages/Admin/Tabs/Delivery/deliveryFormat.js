/* How the delivery alerts and the delivery trail word dates, distances and
   what was wrong with a location. */

export const dateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** 45 → "45 m", 2380 → "2.4 km" */
export const distanceText = (metres) =>
  metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;

export const mapLink = (point) =>
  point ? `https://www.google.com/maps?q=${point.latitude},${point.longitude}` : null;

export const PROBLEM_LABEL = {
  TOO_FAR: "Far from the store",
  NO_LOCATION: "No location sent",
  MOCKED: "Fake-GPS app active",
  WRONG_CODE: "Wrong delivery code",
};
