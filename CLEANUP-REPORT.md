# CLEANUP-REPORT

**תאריך:** מרץ 2025  
**היקף:** סריקה כחלק מ-DEEP SCAN; לא בוצע ניקוי אגרסיבי כדי לא לשבור פרויקט.

---

## 1. כפילויות קוד

| מקום | תיאור | סטטוס |
|------|--------|--------|
| server/routers.ts | לוגיקת submit חוזרת ל־chance / lotto / football (חסימה, deduction, transparency, commission) | **לא אוחד** – איחוד ידרוש פונקציה משותפת עם פרמטרים רבים; סיכון regression. הושאר כפי שהוא. |
| getTournamentById / getSubmissionById | נקראים מכל ה-routers ו-db | **לא כפול** – שימוש חוזר נכון. |

---

## 2. Dead code / code paths לא בשימוש

| פריט | קובץ | סטטוס |
|------|------|--------|
| ComponentShowcase | client/src/pages/ComponentShowcase.tsx | לא בשימוש ב-routes או ב-imports. **המלצה:** להסיר או לחבר ל-route רק ב-dev. **לא הוסר** במסגרת הניקוי השמרני. |
| getAgentCommissionsByAgentId | server/db.ts | ייבוא ב-routers – getAgentCommissionsByAgentIdExistingOnly ו-WithDateRange בשימוש. **לא מת.** |

---

## 3. תיקיות לא רלוונטיות

- **features/**, **core/** – לא קיימות כתיקיות נפרדות; הליבה ב־server/_core ו־server/ (routers, db). **אין תיקיות למחוק.**
- **data/** – מכיל DB (למשל worldcup.db). **נחוץ.**
- **scripts/** – create-admin, backup-db, load-test וכו'. **בשימוש.**

---

## 4. console.log / debug

| מקום | תיאור | סטטוס |
|------|--------|--------|
| server/db.ts | הודעות מיגרציה והתחלה ([DB] Added column...) | **לא הוסר** – שימושי ל-debug מיגרציה. ניתן להעביר ל-logger. |
| server/_core/index.ts | הודעות הרצה (פורט, כתובת) ב-development | **נשאר** – מקובל ב-dev. |
| server/_core/logger.ts | שימוש ב-console לפי רמה | **נשאר** – זה מנגנון הלוג. |
| scripts/* | הודעות להרצת סקריפטים | **נשאר** – סטנדרטי לסקריפטים. |

---

## 5. Imports

- לא בוצעה סריקה אוטומטית להסרת imports לא בשימוש (דורש כלי או הרצת ESLint עם כללי no-unused-vars). **לא בוצע** כדי למנוע שינויים מיותרים.

---

## 6. סיכום – מה בוצע

- **לא נמחקו קבצים** במסגרת ה-cleanup השמרני.
- **לא אוחדו** פונקציות כפולות גדולות (submit flows) כדי למנוע regression.
- **לא הוסרו** console.logים שקשורים למיגרציה/הרצה/סקריפטים.

**המלצות להמשך:**
- להריץ `pnpm run check` ו-`eslint` עם no-unused-vars ולנקות imports.
- להסיר או להגביל ל-dev את ComponentShowcase אם לא נחוץ.
- להעביר הודעות [DB] ב-db.ts ל-logger אם רוצים לוג אחיד.
