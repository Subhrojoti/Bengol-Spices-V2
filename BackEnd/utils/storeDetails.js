export const readGstNumber = (value) => {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new Error("Enter a valid 15-character GST number or leave it blank");
  const gst = value.trim().toUpperCase();
  if (gst && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst)) throw new Error("Enter a valid 15-character GST number or leave it blank");
  return gst;
};
export const registrationGps = (body, now = Date.now()) => {
  if (body.registrationVersion === undefined && body.locationAccuracy === undefined && body.locationCapturedAt === undefined) return {};
  const accuracy = Number(body.locationAccuracy), capturedAt = Number(body.locationCapturedAt), photoTakenAt = Number(body.photoTakenAt);
  if (!["2", 2].includes(body.registrationVersion) || body.locationMocked === true || body.locationMocked === "true") throw new Error("Capture a fresh, genuine GPS location after taking the store photo");
  if (body.locationAccuracy === "" || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 50) throw new Error("GPS accuracy must be within 50 metres. Please retry near the store.");
  if (!Number.isFinite(capturedAt) || !Number.isFinite(photoTakenAt) || capturedAt < photoTakenAt - 2000 || capturedAt > now + 30000 || now - capturedAt > 120000) throw new Error("The GPS reading is outdated. Capture the store location again before submitting.");
  return { accuracy, capturedAt: new Date(capturedAt), photoTakenAt: new Date(photoTakenAt) };
};
