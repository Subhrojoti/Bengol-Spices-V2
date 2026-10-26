// Uploaded document links must never interpret a javascript: or data: URL.
export const safeExternalUrl = (value) => {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
};
