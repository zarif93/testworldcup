/**
 * CMS page body: plain text ↔ HTML for editing and display.
 * - Save: convert plain text (with \n / \n\n) to <p> and <br /> so stored value has structure.
 * - Load: convert stored HTML back to plain text for the textarea so Enter/blank lines are visible.
 * - Display: normalizeBodyContent in CmsPageView handles both plain and HTML.
 */

/** Detect if string looks like HTML (has block-level or br tags). */
export function looksLikeHtml(s: string): boolean {
  const trimmed = s.trim();
  return (
    /<(p|br|ul|ol|li|h2|h3|div)[\s>]/i.test(trimmed) ||
    /<\/(p|ul|ol|li|h2|h3|div)>/i.test(trimmed)
  );
}

/** Escape HTML entities in plain text (for use inside tags). */
export function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Convert plain text (with \n and \n\n) to HTML with <p> and <br />.
 * Double newlines → separate <p>; single newlines → <br />.
 * Does not sanitize – caller should sanitize if output is used in dangerouslySetInnerHTML.
 */
export function plainTextToHtml(plain: string): string {
  if (!plain || typeof plain !== "string") return "";
  const trimmed = plain.trim();
  if (!trimmed) return "";

  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return paragraphs
    .map((block) => {
      const lines = block.split(/\n/);
      const inner = lines.map((line) => escapeHtmlText(line)).join("<br />");
      return "<p>" + inner + "</p>";
    })
    .join("\n");
}

/**
 * Convert HTML body to plain text for the editor textarea.
 * </p><p> or block boundaries → \n\n; <br> → \n; strip other tags, decode entities.
 */
export function htmlToPlainText(html: string): string {
  if (!html || typeof html !== "string") return "";
  let out = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/div>\s*/gi, "\n\n")
    .replace(/<div[^>]*>/gi, "")
    .replace(/<\/h[23]>\s*/gi, "\n\n")
    .replace(/<h[23][^>]*>/gi, "");
  out = out.replace(/<[^>]+>/g, ""); // strip any remaining tags
  out = out
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  out = out.replace(/\n{3,}/g, "\n\n").trim(); // collapse many newlines to double
  return out;
}
