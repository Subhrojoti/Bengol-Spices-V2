/* =====================================================================
   PRODUCT DESCRIPTION CLEAN-UP

   A product description is written in the panel's small rich-text box and
   stored as HTML. The panel shows it as HTML too, so whatever is stored is
   run in the browser of whoever opens the product, the admin included. An
   employee allowed to manage products (or anyone holding their login)
   could save a description carrying a script and read the admin's session
   with it.

   So only what the editor can actually produce is kept: bold, italic,
   underline, lists, line breaks, paragraphs and links. Every other tag is
   dropped, and so is every attribute except a link's web address. The
   text itself is never touched.
   ===================================================================== */

const ALLOWED_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "p",
  "div",
  "span",
  "br",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
]);

// Removed together with everything inside them
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|noscript|template|svg|math|textarea|title)\b[\s\S]*?(<\/\1\s*>|$)/gi;

/* A whole tag. The first form understands quoted attribute values, so a
   ">" inside one (title="a>b") does not end the tag early and leave the
   rest of it behind as text. The second catches whatever the first could
   not read (an unbalanced quote), so nothing tag-shaped is ever left. */
const QUOTED_TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;

// A link may only point at a web page or an email address
const safeHref = (attributes) => {
  const match = attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i);
  const href = (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();

  if (!/^(https?:\/\/|mailto:)/i.test(href)) return "";
  if (/["'<>`\s]/.test(href)) return "";

  return href;
};

/** @returns {string} the description with only harmless formatting left */
export const sanitizeDescription = (html) => {
  if (typeof html !== "string" || !html) return "";

  let previous;
  let text = html.replace(/<!--[\s\S]*?(-->|$)/g, "");

  const rewrite = (_tag, closing, name, attributes) => {
    const tag = name.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (closing) return `</${tag}>`;

    if (tag === "a") {
      const href = safeHref(attributes);
      return href
        ? `<a href="${href}" target="_blank" rel="noopener noreferrer">`
        : "<a>";
    }

    return `<${tag}>`;
  };

  // Repeated until nothing changes, so a tag split around a removed one
  // ("<scr<script>ipt>") cannot come back together
  do {
    previous = text;

    text = text
      .replace(DROP_WITH_CONTENT, "")
      .replace(QUOTED_TAG, rewrite)
      .replace(TAG, rewrite);
  } while (text !== previous);

  // A "<" left over at the very end is the start of a tag that never closed
  return text.replace(/<[a-zA-Z/!][^>]*$/, "").trim();
};
