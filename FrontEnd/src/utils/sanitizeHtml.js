/* =====================================================================
   SHOWING A PRODUCT DESCRIPTION SAFELY

   A description is written in the small rich-text box on the product form
   and stored as HTML, and the panel shows it as HTML. Shown exactly as
   stored, anything in it runs in the browser of whoever opens the product:
   a description saved with a script in it (by an employee allowed to manage
   products, or by anyone using their login) would run for the admin and
   could read the admin's session.

   So before it is put on the page, it is rebuilt from scratch keeping only
   what the editor can produce: bold, italic, underline, lists, paragraphs,
   line breaks and links to web pages. Every other tag and every attribute
   is left out. The text is never changed.

   The server cleans descriptions the same way when they are saved
   (BackEnd/utils/sanitizeHtml.js); this covers the ones saved before that.
   ===================================================================== */

const KEEP = new Set([
  "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "P", "DIV", "SPAN", "BR",
  "UL", "OL", "LI", "A", "H1", "H2", "H3", "H4", "BLOCKQUOTE",
]);

// Left out together with everything inside them
const DROP = new Set([
  "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "NOSCRIPT", "TEMPLATE",
  "SVG", "MATH", "TEXTAREA", "TITLE", "LINK", "META", "BASE", "FORM",
  "INPUT", "BUTTON", "SELECT", "IMG", "PICTURE", "VIDEO", "AUDIO", "SOURCE",
  "CANVAS", "FRAME", "FRAMESET", "APPLET",
]);

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

const copyClean = (from, into) => {
  for (const node of from.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      into.appendChild(document.createTextNode(node.nodeValue));
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue; // comments and the like

    const tag = node.tagName.toUpperCase();
    if (DROP.has(tag)) continue;

    // A tag that is not on either list is passed over but its text is kept
    if (!KEEP.has(tag)) {
      copyClean(node, into);
      continue;
    }

    const element = document.createElement(tag.toLowerCase());

    if (tag === "A") {
      const href = (node.getAttribute("href") || "").trim();
      if (SAFE_LINK.test(href)) {
        element.setAttribute("href", href);
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer");
      }
    }

    copyClean(node, element);
    into.appendChild(element);
  }
};

/** @returns {string} HTML that is safe to put on the page */
export const sanitizeHtml = (html) => {
  if (typeof html !== "string" || !html) return "";

  // Nowhere to parse it (the build's pre-rendering): plain text only
  if (typeof DOMParser === "undefined" || typeof document === "undefined") {
    return html.replace(/<[^>]*>/g, "").replace(/[<>]/g, "");
  }

  /* Parsed into a separate document that belongs to no window: nothing in
     it loads or runs while it is being read. */
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const clean = document.createElement("div");
  copyClean(parsed.body, clean);

  return clean.innerHTML;
};
