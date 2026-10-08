import { useEffect, useState } from "react";
import { Store } from "lucide-react";

/**
 * A remote image with a real fallback: a store photo, a profile picture, a
 * product shot.
 *
 * Pages used to hide the <img> when it failed to load, which left an empty
 * gap where the picture should be — worse than never showing one. A missing
 * or broken image now falls back to the entity's initials, tinted from its
 * own name so the same store or person looks the same everywhere and two
 * rows stay distinguishable. Pass `fallback` for things that have no
 * meaningful initials, such as a product.
 */
const TINTS = [
  { bg: "#eaf1fc", ink: "#2a78d6" },
  { bg: "#f0edfd", ink: "#5b4bc4" },
  { bg: "#e6f7f0", ink: "#12805a" },
  { bg: "#fdf3e0", ink: "#a06c00" },
  { bg: "#fdecf2", ink: "#c2456e" },
  { bg: "#fdeee7", ink: "#c2532a" },
];

/** Stable per name, so an entity keeps the same colour across every screen. */
const tintFor = (name) => {
  const text = String(name || "");
  let hash = 0;

  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 100000;
  }

  return TINTS[hash % TINTS.length];
};

const initialsOf = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const EntityAvatar = ({
  src,
  name,
  fallback,
  className = "h-12 w-12 rounded-xl",
  imgClassName = "object-cover",
  bordered = true,
}) => {
  const [failed, setFailed] = useState(false);

  /* A new src deserves a fresh attempt — otherwise one broken URL would keep
     the fallback showing after the element is reused for another entity. */
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const border = bordered ? "border border-slate-200" : "";

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={`shrink-0 ${border} ${imgClassName} ${className}`}
      />
    );
  }

  const initials = initialsOf(name);
  const tint = tintFor(name);

  return (
    <span
      aria-hidden="true"
      style={fallback ? undefined : { "--tint": tint.bg, "--ink": tint.ink }}
      className={`grid shrink-0 place-items-center text-[14px] font-bold ${
        fallback ? "bg-slate-100 text-slate-300" : "tint-chip"
      } ${bordered ? "border border-slate-200/60" : ""} ${className}`}>
      {fallback || initials || <Store size={17} />}
    </span>
  );
};

export default EntityAvatar;
