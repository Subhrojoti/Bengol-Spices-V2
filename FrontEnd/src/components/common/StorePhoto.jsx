import { createContext, useCallback, useContext, useId, useState } from "react";
import { Dialog } from "@mui/material";
import { X } from "lucide-react";
import EntityAvatar from "./EntityAvatar";
import { safeExternalUrl } from "../../utils/safeExternalUrl";

const PhotoContext = createContext(null);

// One preview for the Admin shell; list rows keep their small lazy thumbnails.
export function StorePhotoProvider({ children }) {
  const [photo, setPhoto] = useState(null);
  const titleId = useId();
  const showPhoto = useCallback((src, name) => setPhoto({ src, name, failed: false }), []);

  return <PhotoContext.Provider value={showPhoto}>
    {children}
    <Dialog open={Boolean(photo)} onClose={() => setPhoto(null)} aria-labelledby={titleId} maxWidth="md" fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, margin: 2, width: "calc(100% - 32px)" } } }}>
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">Store photo</h2>
          <p className="mt-0.5 break-words text-sm text-slate-500">{photo?.name}</p>
        </div>
        <button type="button" onClick={() => setPhoto(null)} aria-label="Close store photo"
          className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
          <X size={20} />
        </button>
      </div>
      {photo && (photo.failed
        ? <p role="alert" className="p-10 text-center text-sm text-slate-600">Could not load this store photo. Close the preview and try again.</p>
        : <img src={photo.src} alt={`${photo.name || "Store"} store photo`}
          onError={() => setPhoto((current) => current?.src === photo.src ? { ...current, failed: true } : current)}
          className="max-h-[75dvh] min-h-32 w-full bg-slate-950 object-contain" />)}
    </Dialog>
  </PhotoContext.Provider>;
}

// The selection control and photo are siblings, avoiding buttons nested in buttons.
// Shared Employee screens keep their existing selection button and static avatar.
export function StoreSelectionCard({ children, className, ...props }) {
  const showPhoto = useContext(PhotoContext);
  if (!showPhoto) return <button type="button" className={className} {...props}>{children}</button>;
  return <div className={`relative ${className}`}>
    <button type="button" {...props} className="absolute inset-0 w-full rounded-[inherit] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500" />
    <div className="pointer-events-none contents">{children}</div>
  </div>;
}

export default function StorePhoto({ src, fallbackSrc, name, ...avatarProps }) {
  const showPhoto = useContext(PhotoContext);
  const original = safeExternalUrl(fallbackSrc || src);
  const avatar = <EntityAvatar src={src} fallbackSrc={fallbackSrc} name={name} {...avatarProps} />;
  if (!showPhoto || !original) return avatar;
  return <button type="button" onClick={() => showPhoto(original, name)}
    aria-label={`View store photo for ${name || "store"}`} title="View store photo"
    className="pointer-events-auto relative z-10 shrink-0 cursor-zoom-in rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
    {avatar}
  </button>;
}
