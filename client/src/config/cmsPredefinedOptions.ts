/**
 * Predefined CMS keys/categories/types for admin dropdowns.
 * Keeps internal values in English; labels can be Hebrew for UX.
 * Existing saved values not in these lists still display and remain editable (custom option).
 */

export type CmsOption = { value: string; labelHe: string; labelEn?: string };

/** באנרים – מיקום + תווית ידידותית + תיאור לעזר למנהל */
export type BannerPlacementOption = { value: string; labelHe: string; descriptionHe: string; labelEn?: string };

export const BANNER_PLACEMENTS: BannerPlacementOption[] = [
  { value: "homepage_hero", labelHe: "באנר ראשי בדף הבית", descriptionHe: "באנר ראשי – מוצג בראש דף הבית מעל כל התוכן", labelEn: "homepage_hero" },
  { value: "homepage_promo", labelHe: "באנר קידום בדף הבית", descriptionHe: "באנר קידום – מוצג מעל אזור התחרויות", labelEn: "homepage_promo" },
  { value: "homepage_secondary", labelHe: "באנר משני בדף הבית", descriptionHe: "באנר משני – מוצג באזור משני בדף הבית", labelEn: "homepage_secondary" },
  { value: "homepage_cta", labelHe: "באנר הנעה לפעולה", descriptionHe: "באנר CTA – קריאה לפעולה בדף הבית", labelEn: "homepage_cta" },
  { value: "about", labelHe: "באנר בדף אודות", descriptionHe: "מוצג בראש דף אודות", labelEn: "about" },
  { value: "contact", labelHe: "באנר בדף צור קשר", descriptionHe: "מוצג בראש דף צור קשר", labelEn: "contact" },
  { value: "faq", labelHe: "באנר בדף שאלות נפוצות", descriptionHe: "מוצג בראש דף שאלות נפוצות", labelEn: "faq" },
  { value: "terms", labelHe: "באנר בדף תקנון", descriptionHe: "מוצג בראש דף תקנון", labelEn: "terms" },
  { value: "privacy", labelHe: "באנר בדף פרטיות", descriptionHe: "מוצג בראש דף פרטיות", labelEn: "privacy" },
  { value: "info", labelHe: "באנר בדף מידע", descriptionHe: "מוצג בראש דף מידע", labelEn: "info" },
];

/** @deprecated Use BANNER_PLACEMENTS for admin UX; kept for backward compatibility where CmsOption[] is expected */
export const BANNER_KEYS: CmsOption[] = BANNER_PLACEMENTS.map((p) => ({ value: p.value, labelHe: p.labelHe, labelEn: p.labelEn }));

/** Get placement label by key (for list display) */
export function getBannerPlacementLabel(key: string): string {
  const found = BANNER_PLACEMENTS.find((p) => p.value === key);
  return found?.labelHe ?? key;
}

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

/** בלוקים גלובליים – מיקום + תווית ידידותית + תיאור */
export type SectionPlacementOption = { value: string; labelHe: string; descriptionHe: string; labelEn?: string };

export const SECTION_PLACEMENTS: SectionPlacementOption[] = [
  { value: "homepage_features", labelHe: "דף הבית – אזור תכונות", descriptionHe: "אזור תכונות – מוצג בדף הבית באזור ההסבר על יתרונות המערכת", labelEn: "homepage_features" },
  { value: "homepage_secondary", labelHe: "דף הבית – בלוק משני", descriptionHe: "בלוק משני – מוצג בדף הבית מתחת לאזור התחרויות כתוכן תומך", labelEn: "homepage_secondary" },
  { value: "homepage_cta", labelHe: "דף הבית – אזור CTA", descriptionHe: "בלוק CTA – מוצג לקראת סוף דף הבית לפני הפעולות התחתונות", labelEn: "homepage_cta" },
  { value: "homepage_hero", labelHe: "דף הבית – אזור גיבור", descriptionHe: "אזור גיבור – מוצג בראש דף הבית (לעיתים משמש יחד עם באנר)", labelEn: "homepage_hero" },
  { value: "homepage_promo", labelHe: "דף הבית – אזור פרומו", descriptionHe: "אזור פרומו – מוצג בדף הבית מעל או ליד אזור התחרויות", labelEn: "homepage_promo" },
  { value: "footer_links", labelHe: "פוטר – קישורים / תוכן", descriptionHe: "תוכן או קישורים בתחתית האתר (פוטר)", labelEn: "footer_links" },
  { value: "about", labelHe: "דף אודות – בלוק תוכן", descriptionHe: "בלוק תוכן שמוצג בדף אודות", labelEn: "about" },
  { value: "contact", labelHe: "דף צור קשר – בלוק תוכן", descriptionHe: "בלוק תוכן שמוצג בדף צור קשר", labelEn: "contact" },
  { value: "faq", labelHe: "דף שאלות נפוצות – בלוק תוכן", descriptionHe: "בלוק תוכן שמוצג בדף שאלות נפוצות", labelEn: "faq" },
  { value: "terms", labelHe: "דף תקנון – בלוק תוכן", descriptionHe: "בלוק תוכן שמוצג בדף תקנון", labelEn: "terms" },
  { value: "privacy", labelHe: "דף פרטיות – בלוק תוכן", descriptionHe: "בלוק תוכן שמוצג בדף פרטיות", labelEn: "privacy" },
  { value: "info", labelHe: "דף מידע – בלוק תוכן", descriptionHe: "בלוק תוכן שמוצג בדף מידע", labelEn: "info" },
];

/** @deprecated Use SECTION_PLACEMENTS for admin UX */
export const SECTION_KEYS: CmsOption[] = SECTION_PLACEMENTS.map((p) => ({ value: p.value, labelHe: p.labelHe, labelEn: p.labelEn }));

export function getSectionPlacementLabel(key: string): string {
  const found = SECTION_PLACEMENTS.find((p) => p.value === key);
  return found?.labelHe ?? key;
}

/** בלוקים – סוג בלוק + הסבר קצר */
export type SectionTypeOption = { value: string; labelHe: string; descriptionHe: string; labelEn?: string };

export const SECTION_TYPE_OPTIONS: SectionTypeOption[] = [
  { value: "hero", labelHe: "בלוק גיבור (Hero)", descriptionHe: "כותרת בולטת, תמונה אופציונלית וכפתור פעולה – מתאים לראש עמוד", labelEn: "hero" },
  { value: "features", labelHe: "רשימת תכונות", descriptionHe: "רשימת יתרונות או נקודות – כל שורה בתוכן הראשי תוצג כנקודה", labelEn: "features" },
  { value: "text", labelHe: "בלוק טקסט", descriptionHe: "טקסט חופשי עם כותרת ותת־כותרת – מתאים להסברים", labelEn: "text" },
  { value: "cta", labelHe: "בלוק קריאה לפעולה", descriptionHe: "קריאה לפעולה עם כפתור – מתאים להנעה להרשמה או לחיצה", labelEn: "cta" },
  { value: "cards", labelHe: "בלוק כרטיסים", descriptionHe: "תצוגת פריטים כנקודות או כרטיסים מתוך תוכן ראשי (שורה = פריט)", labelEn: "cards" },
  { value: "links", labelHe: "בלוק קישורים", descriptionHe: "רשימת קישורים – בפורמט: כותרת|כתובת בכל שורה", labelEn: "links" },
  { value: "html", labelHe: "בלוק HTML", descriptionHe: "תוכן HTML מוגבל – מתאים לעיצוב מותאם", labelEn: "html" },
  { value: "banner", labelHe: "בלוק באנר", descriptionHe: "תצוגת באנר עם תמונה וטקסט", labelEn: "banner" },
];

/** @deprecated Use SECTION_TYPE_OPTIONS for admin UX */
export const SECTION_TYPES: CmsOption[] = SECTION_TYPE_OPTIONS.map((t) => ({ value: t.value, labelHe: t.labelHe, labelEn: t.labelEn }));

export function getSectionTypeLabel(type: string): string {
  const found = SECTION_TYPE_OPTIONS.find((t) => t.value === type);
  return found?.labelHe ?? type;
}

export const CMS_CUSTOM_VALUE = "__custom__";
export const CMS_CUSTOM_LABEL_HE = "אחר (הקלד ידנית)";
