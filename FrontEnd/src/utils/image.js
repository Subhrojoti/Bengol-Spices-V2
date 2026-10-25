// Deliver a small square preview for list avatars. Leave signed/custom URLs
// alone: changing their transformation would invalidate their access signature.
export const imageThumbnail = (src, edge = 144) => {
  if (typeof src !== "string" || !src) return src;
  try {
    const url = new URL(src);
    if (!["http:", "https:"].includes(url.protocol) || url.hostname !== "res.cloudinary.com" || url.search) return src;
    const marker = "/image/upload/";
    const position = src.indexOf(marker);
    if (position < 0) return src;
    const asset = src.slice(position + marker.length);
    // Existing transformations, signed delivery, and empty paths are preserved.
    if (!asset || /^(?:s--|[a-z]{1,3}_)/.test(asset)) return src;
    const size = Math.max(48, Math.min(512, Math.round(Number(edge) || 144)));
    return `${src.slice(0, position + marker.length)}c_fill,g_center,h_${size},w_${size}/f_auto/q_auto/${asset}`;
  } catch { return src; }
};
