/**
 * Predefined CMS keys/categories/types for admin dropdowns.
 * Keeps internal values in English; labels can be Hebrew for UX.
 * Existing saved values not in these lists still display and remain editable (custom option).
 */

export type CmsOption = { value: string; labelHe: string; labelEn?: string };

/** באנרים – מפתחות מוגדרים מראש */
export const BANNER_KEYS: CmsOption[] = [
  { value: "homepage_hero", labelHe: "דף הבית – באנר ראשי", labelEn: "homepage_hero" },
  { value: "homepage_promo", labelHe: "דף הבית – פרומו", labelEn: "homepage_promo" },
  { value: "homepage_secondary", labelHe: "דף הבית – משני", labelEn: "homepage_secondary" },
  { value: "homepage_cta", labelHe: "דף הבית – CTA", labelEn: "homepage_cta" },
  { value: "about", labelHe: "אודות", labelEn: "about" },
  { value: "info", labelHe: "מידע", labelEn: "info" },
  { value: "contact", labelHe: "צור קשר", labelEn: "contact" },
  { value: "faq", labelHe: "שאלות נפוצות", labelEn: "faq" },
  { value: "terms", labelHe: "תקנון", labelEn: "terms" },
  { value: "privacy", labelHe: "פרטיות", labelEn: "privacy" },
];

/** הודעות/פופאפ – סוג (variant) עם תווית בעברית */
export const ANNOUNCEMENT_VARIANTS: CmsOption[] = [
  { value: "info", labelHe: "מידע", labelEn: "info" },
  { value: "warning", labelHe: "אזהרה", labelEn: "warning" },
  { value: "success", labelHe: "הצלחה", labelEn: "success" },
  { value: "neutral", labelHe: "ניטרלי", labelEn: "neutral" },
];

/** הודעות – מפתח מיקום (אם יתווסף לשמירה בעתיד) */
export const ANNOUNCEMENT_PLACEMENT_KEYS: CmsOption[] = [
  { value: "announcement_top", labelHe: "הודעה בראש הדף", labelEn: "announcement_top" },
  { value: "popup_home", labelHe: "פופאפ דף הבית", labelEn: "popup_home" },
  { value: "popup_global", labelHe: "פופאפ גלובלי", labelEn: "popup_global" },
];

/** דפים – slugs נפוצים */
export const PAGE_SLUGS: CmsOption[] = [
  { value: "about", labelHe: "אודות", labelEn: "about" },
  { value: "info", labelHe: "מידע", labelEn: "info" },
  { value: "faq", labelHe: "שאלות נפוצות", labelEn: "faq" },
  { value: "contact", labelHe: "צור קשר", labelEn: "contact" },
  { value: "terms", labelHe: "תקנון", labelEn: "terms" },
  { value: "privacy", labelHe: "פרטיות", labelEn: "privacy" },
  { value: "how-it-works", labelHe: "איך זה עובד", labelEn: "how-it-works" },
  { value: "transparency", labelHe: "שקיפות", labelEn: "transparency" },
];

/** סקשנים – מפתחות */
export const SECTION_KEYS: CmsOption[] = [
  { value: "homepage_hero", labelHe: "דף הבית – באנר ראשי", labelEn: "homepage_hero" },
  { value: "homepage_features", labelHe: "דף הבית – תכונות", labelEn: "homepage_features" },
  { value: "homepage_cta", labelHe: "דף הבית – CTA", labelEn: "homepage_cta" },
  { value: "homepage_promo", labelHe: "דף הבית – פרומו", labelEn: "homepage_promo" },
  { value: "homepage_secondary", labelHe: "דף הבית – משני", labelEn: "homepage_secondary" },
  { value: "footer_links", labelHe: "קישורי פוטר", labelEn: "footer_links" },
  { value: "about", labelHe: "אודות", labelEn: "about" },
  { value: "info", labelHe: "מידע", labelEn: "info" },
  { value: "faq", labelHe: "שאלות נפוצות", labelEn: "faq" },
  { value: "contact", labelHe: "צור קשר", labelEn: "contact" },
  { value: "terms", labelHe: "תקנון", labelEn: "terms" },
  { value: "privacy", labelHe: "פרטיות", labelEn: "privacy" },
];

/** סקשנים – סוגים (type) */
export const SECTION_TYPES: CmsOption[] = [
  { value: "hero", labelHe: "גיבור (Hero)", labelEn: "hero" },
  { value: "features", labelHe: "תכונות", labelEn: "features" },
  { value: "cta", labelHe: "קריאה לפעולה", labelEn: "cta" },
  { value: "text", labelHe: "טקסט", labelEn: "text" },
  { value: "html", labelHe: "HTML", labelEn: "html" },
  { value: "cards", labelHe: "כרטיסים", labelEn: "cards" },
  { value: "banner", labelHe: "באנר", labelEn: "banner" },
  { value: "links", labelHe: "קישורים", labelEn: "links" },
];

export const CMS_CUSTOM_VALUE = "__custom__";
export const CMS_CUSTOM_LABEL_HE = "אחר (הקלד ידנית)";
