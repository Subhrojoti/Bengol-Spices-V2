import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SITE, metaFor } from "./site";

/* Finds the tag or creates it. The pre-rendered pages already carry these
   tags, so on a first visit this only confirms what is there. */
const upsert = (selector, create) => {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = create();
    document.head.appendChild(node);
  }
  return node;
};

const setMeta = (attribute, key, content) => {
  const node = upsert(`meta[${attribute}="${key}"]`, () => {
    const meta = document.createElement("meta");
    meta.setAttribute(attribute, key);
    return meta;
  });
  node.setAttribute("content", content);
};

/**
 * Keeps the document title, description, canonical address, share tags and
 * the robots instruction in step with the current route.
 *
 * Public pages are indexable. Everything else (the logins and the four
 * panels) is marked noindex, so a signed-in screen can never turn up in
 * search results.
 *
 * Renders nothing. Mounted once, beside the router.
 */
export default function RouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = metaFor(pathname);
    const url = meta.canonical ?? `${SITE.url}${pathname}`;

    document.title = meta.title;

    setMeta("name", "description", meta.description);
    setMeta("name", "robots", meta.index ? "index, follow" : "noindex, nofollow");

    setMeta("property", "og:title", meta.title);
    setMeta("property", "og:description", meta.description);
    setMeta("property", "og:url", url);
    setMeta("name", "twitter:title", meta.title);
    setMeta("name", "twitter:description", meta.description);

    const existing = document.head.querySelector('link[rel="canonical"]');

    if (meta.canonical) {
      const link =
        existing ??
        document.head.appendChild(
          Object.assign(document.createElement("link"), { rel: "canonical" }),
        );
      link.setAttribute("href", meta.canonical);
    } else if (existing) {
      // A panel screen has no public address to point at
      existing.remove();
    }
  }, [pathname]);

  return null;
}
