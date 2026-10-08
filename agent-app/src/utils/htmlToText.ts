/**
 * A product description is written in the admin panel's rich-text box and
 * arrives as HTML ("<div>Rich <b>aroma</b></div><ul><li>…"). Put straight
 * into a Text it shows the tags themselves. This turns it into the plain
 * text a person would read: paragraphs and line breaks become new lines,
 * list items become bullets, and the tags are dropped.
 */
export function htmlToText(html?: string | null): string {
  if (!html) return "";

  return (
    html
      .replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\s*li\b[^>]*>/gi, "• ")
      .replace(/<\s*\/\s*(p|div|li|ul|ol|h[1-6]|blockquote)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      // last, so "&amp;lt;" ends as the text "&lt;" and not as "<"
      .replace(/&amp;/gi, "&")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
