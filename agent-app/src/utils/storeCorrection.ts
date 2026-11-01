import type { Store } from "@/types/api";

export const correctionValues = (store: Store) => ({
  storeName: store.storeName || "", ownerName: store.ownerName || "", phone: store.phone || "", gstNumber: store.gstNumber || "",
  state: store.address?.state || "", city: store.address?.city || "", street: store.address?.street || "", pincode: store.address?.pincode || "",
});
export type CorrectionValues = ReturnType<typeof correctionValues>;
export interface CorrectionGps { latitude: number; longitude: number; accuracy: number; capturedAt: number; photoTakenAt: number }
export const validStoreLocation = (location: { latitude: number; longitude: number } | null | undefined) => Boolean(location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude) && Math.abs(location.latitude) <= 85 && Math.abs(location.longitude) <= 180);

export function buildStoreCorrection(store: Store, form: CorrectionValues, gps: CorrectionGps | null, hasPhoto: boolean, now = Date.now()): { changes: Record<string, unknown>; error?: string } {
  const initial = correctionValues(store), values = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])) as CorrectionValues;
  const changes: Record<string, unknown> = {};
  const fail = (error: string) => ({ changes: {}, error });
  if (!values.storeName || !values.ownerName) return fail("Enter the store name and owner name.");
  if (values.storeName.length > 120 || values.ownerName.length > 120) return fail("Store and owner names must be 120 characters or fewer.");
  if (!/^\d{10}$/.test(values.phone)) return fail("Enter a valid 10-digit phone number.");
  if (![values.state, values.city, values.street].every(value => value && value.length <= 300) || !/^\d{6}$/.test(values.pincode)) return fail("Enter a complete address and a valid 6-digit pincode.");
  values.gstNumber = values.gstNumber.toUpperCase();
  if (values.gstNumber && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(values.gstNumber)) return fail("Enter a valid GST number, or leave it blank.");
  for (const key of ["storeName", "ownerName", "phone", "gstNumber"] as const) if (values[key] !== initial[key].trim()) changes[key] = values[key];
  if (["state", "city", "street", "pincode"].some(key => values[key as keyof CorrectionValues] !== initial[key as keyof CorrectionValues].trim())) changes.address = { state: values.state, city: values.city, street: values.street, pincode: values.pincode };
  if (hasPhoto && !gps) return fail("Capture an accurate location for the replacement photo before submitting. Tap Retry GPS capture.");
  if (gps) {
    if (!validStoreLocation(gps) || gps.latitude < 6 || gps.latitude > 38 || gps.longitude < 68 || gps.longitude > 98 || gps.accuracy <= 0 || gps.accuracy > 50 || !Number.isFinite(gps.accuracy)) return fail("Capture a valid store location with GPS accuracy within 50 metres.");
    if (!Number.isFinite(gps.capturedAt) || now - gps.capturedAt > 120000 || gps.capturedAt > now + 30000 || !Number.isFinite(gps.photoTakenAt) || gps.photoTakenAt > gps.capturedAt + 2000) return fail("GPS reading expired. Retry location capture before submitting.");
    changes.location = gps;
  }
  if (!Object.keys(changes).length && !hasPhoto) return fail("Change at least one detail before submitting.");
  return { changes };
}
