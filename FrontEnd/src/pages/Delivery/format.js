/* Formatting helpers shared by the delivery panel pages. */

export const n = (value) => Number(value || 0);

export const inr = (value) => `₹${n(value).toLocaleString("en-IN")}`;

export const day = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const dayTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const hasCoordinates = (location) =>
  location != null &&
  Number.isFinite(Number(location.latitude)) &&
  Number.isFinite(Number(location.longitude)) &&
  !(Number(location.latitude) === 0 && Number(location.longitude) === 0);

/** Google Maps turn-by-turn directions to a place, or null without a location */
export const directionsUrl = (location) =>
  hasCoordinates(location)
    ? `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`
    : null;

export const embedMapUrl = (location) =>
  hasCoordinates(location)
    ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}&z=15&output=embed`
    : null;

/** The last four characters, the rest hidden: account and ID numbers */
export const masked = (value) => {
  const text = String(value || "");
  if (!text) return "";
  return text.length <= 4 ? text : `•••• ${text.slice(-4)}`;
};
