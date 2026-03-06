# Deliverables – שדרוג PRO MAX ULTRA

## רשימת קבצים ששונו/נוספו

### Schema & DB
- `drizzle/schema-sqlite.ts` – ליגות (leagues), שדות תחרות (opensAt, closesAt, entryCostPoints, houseFeeRate, agentShareOfHouseFee, rulesJson, createdBy), submissions.agentId, טבלאות results, settlement, ledger_transactions, audit_logs
- `server/db.ts` – CREATE TABLE ל-leagues, results, settlement, ledger_transactions, audit_logs; ALTER ל-tournaments ו-submissions; פונקציות getLeagues, createLeague, updateLeague, softDeleteLeague, insertLedgerTransaction, insertAuditLog, getTournamentsToAutoClose, runAutoCloseTournaments; עדכון cleanupTournamentData (visibility=HIDDEN); חיווט addUserPoints/deductUserPoints ל-ledger

### API & Scheduler
- `server/routers.ts` – חסימת שליחת טפסים אחרי closesAt; agentId ב-upsertSubmission; admin: getLeagues, createLeague, updateLeague, softDeleteLeague
- `server/_core/index.ts` – ייבוא והרצת runAutoCloseTournaments כל דקה

### Tests & Scripts
- `server/production-readiness.test.ts` – בדיקה ל-getTournamentsToAutoClose / runAutoCloseTournaments
- `scripts/production-readiness.ts` – סקריפט checklist וציון מוכנות production

### תיעוד
- `docs/ADMIN-GUIDE.md` – מדריך מנהל: פתיחת תחרות לפי סוג, עדכון תוצאות, דוחות, ליגות, הרשאות
- `docs/DELIVERABLES.md` – המסמך הזה

---

## מיגרציות DB (SQLite)

- טבלאות חדשות: `leagues`, `results`, `settlement`, `ledger_transactions`, `audit_logs`
- עמודות חדשות ב-`tournaments`: opensAt, closesAt, entryCostPoints, houseFeeRate, agentShareOfHouseFee, rulesJson, createdBy, leagueId, וכל השדות הקיימים שלא היו ב-optionalCols (removalScheduledAt, visibility, lockedAt, minParticipants, totalPoolPoints, totalCommissionPoints, totalPrizePoolPoints)
- עמודה חדשה ב-`submissions`: agentId
- מיגרציה ל-`leagues`: הוספת enabled, deletedAt אם חסרים (ALTER)

המיגרציות רצות אוטומטית בהפעלת השרת (initSqlite).

---

## Endpoints חדשים/מעודכנים

### Admin (כולם דורשים admin + אימות קוד אם מוגדר)
- `admin.getLeagues` – query, input: `{ includeDisabled?: boolean }` – רשימת ליגות
- `admin.createLeague` – mutation, input: `{ name: string }` – יצירת ליגה
- `admin.updateLeague` – mutation, input: `{ id: number, name?: string, enabled?: boolean }` – עדכון ליגה
- `admin.softDeleteLeague` – mutation, input: `{ id: number }` – מחיקה רכה של ליגה

### Guard בטפסים
- שליחת טופס (submissions.submit): נחסמת אם `closesAt` עבר (בנוסף ל-status !== OPEN)

---

## בדיקות שעברו

- `pnpm test -- server/production-readiness.test.ts` (או `npx vitest run server/production-readiness.test.ts`) – 17 טסטים
- `pnpm exec tsx scripts/production-readiness.ts` – checklist 10/10

---

## וידוא דף ראשי

- תחרויות בדף הראשי: רק אלה עם `deletedAt = null`, `visibility = VISIBLE` (או ברירת מחדל), `hiddenFromHomepage = 0`, וסטטוס ב־UPCOMING/OPEN/LOCKED/CLOSED/SETTLED/RESULTS_UPDATED/PRIZES_DISTRIBUTED (getActiveTournaments).
- אחרי ארכוב (cleanupTournamentData): סטטוס ARCHIVED ו־visibility=HIDDEN – לא מוצגות בדף הראשי; נתונים ודוחות נשמרים.

---

## תיעוד למנהל

ראה `docs/ADMIN-GUIDE.md`: איך לפתוח תחרות לכל סוג (CHANCE, LOTTO, FOOTBALL, WORLDCUP), איך לעדכן תוצאות, איך להפיק דוחות, ליגות, והרשאות.
