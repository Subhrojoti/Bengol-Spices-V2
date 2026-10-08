import { useEffect } from "react";

/**
 * Fades and lifts every [data-reveal] element as it scrolls into view.
 * Driven by an IntersectionObserver, so scrolling costs nothing while idle.
 *
 * The hidden starting state only applies once <html> carries
 * "reveal-ready" (see index.css). That class is added here, after whatever
 * is already on screen has been marked visible. So:
 *
 *   - before JavaScript runs, a pre-rendered page shows its content. A
 *     search engine, a link preview and a slow phone all see the headline
 *     at once, rather than a blank hero waiting on a script;
 *   - on the first page of a visit nothing on screen flickers out and back;
 *   - moving between pages afterwards, sections animate in as before.
 */
export default function useReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll("[data-reveal]");
    const root = document.documentElement;

    if (!root.classList.contains("reveal-ready")) {
      const fold = window.innerHeight;

      nodes.forEach((node) => {
        if (node.getBoundingClientRect().top < fold) {
          node.classList.add("is-visible");
        }
      });

      root.classList.add("reveal-ready");
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    nodes.forEach((node) => {
      if (!node.classList.contains("is-visible")) observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);
}
