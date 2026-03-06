# עריכת טופס (Edit) vs יצירת טופס חדש (Create) – סיכום

## 1. רשימת קבצים ששונו

| קובץ | שינויים |
|------|---------|
| **drizzle/schema-sqlite.ts** | שדות `editedCount` (ברירת מחדל 0), `lastEditedAt` (timestamp אופציונלי) בטבלת `submissions`. |
| **server/db.ts** | מיגרציה: הוספת עמודות `editedCount`, `lastEditedAt`. פונקציה חדשה `updateSubmissionContent(id, predictions, actorId, actorRole, diffJson)` – מעדכנת תוכן טופס, מעלה `editedCount`, מעדכנת `lastEditedAt`, ורושמת `SUBMISSION_EDITED` ב־`audit_logs`. |
| **server/routers.ts** | ייבוא `updateSubmissionContent`. פרוצדורה חדשה `submissions.update` (עריכה): קלט `submissionId` + אחד מ־`predictions` / `predictionsChance` / `predictionsLotto`. בדיקות: בעלות (userId או admin), תחרות OPEN, לא נעולה. **אין חיוב, אין debit, אין ledger, אין עדכון PrizePool.** רישום audit עם diff. |
| **client/src/pages/PredictionForm.tsx** | תמיכה ב־`?edit=submissionId` ו־`?duplicateFrom=submissionId`. טעינת טופס לפי `getById(submissionId)`, מילוי מקדים, במצב עריכה – שליחה ל־`submissions.update` (כפתור "עדכן טופס (ללא חיוב)"). במצב שכפול – שליחה ל־`submissions.submit` (חיוב כרגיל). באנרים: "מצב עריכה – ללא חיוב", "מצב שכפול – תחייב X נקודות". |
| **client/src/pages/Submissions.tsx** | לשונית "הטפסים שלי" (רק למחובר) עם `getMine()`. ליד כל טופס: [ערוך טופס (חינם)] → `/predict/:tid?edit=:sid`, [שכפל כטופס חדש] → `/predict/:tid?duplicateFrom=:sid`. בטבלת "כל הטפסים" – אותם כפתורים לטפסים של המשתמש. |
| **server/production-readiness.test.ts** | טסטים: `submissions.update` על טופס לא קיים מחזיר NOT_FOUND; `updateSubmissionContent` פונקציה קיימת. |

---

## 2. הפרדה בין Create ל-Edit

- **Create (טופס חדש):** `submissions.submit` – תמיד יוצר שורה חדשה, מבצע debit נקודות, ledger ENTRY_DEBIT, עדכון PrizePool/עמלות. ה־endpoint היחיד שמבצע חיוב.
- **Edit (עדכון טופס):** `submissions.update` – מעדכן טופס קיים לפי `submissionId`. **אין debit, אין ENTRY_DEBIT, אין שינוי הכנסות/עמלות/PrizePool.** רק עדכון `predictions` + `updatedAt` + `editedCount` + `lastEditedAt` + רישום audit.

---

## 3. דוגמאות API (הוכחה ש-Edit לא מחייב)

### Create – חיוב (POST logic ב־submit)

```ts
// tRPC: submissions.submit
await caller.submissions.submit({
  tournamentId: 1,
  predictions: [ /* 72 משחקים */ ],
});
// תוצאה: נקודות יורדות, נוצרת שורת submission חדשה, ledger ENTRY_DEBIT, עדכון PrizePool.
```

### Edit – ללא חיוב (PATCH logic ב־update)

```ts
// tRPC: submissions.update
await caller.submissions.update({
  submissionId: 42,
  predictions: [ /* 72 משחקים (עודכנו) */ ],
});
// תוצאה: { success: true, noCharge: true }. אין deductUserPoints, אין insertTransparencyLog, אין recordAgentCommission.
// רק: updateSubmissionContent() + insertAuditLog(SUBMISSION_EDITED).
```

### בדיקה בטסט

- `submissions.update({ submissionId: 999999, predictions: [...] })` עם טופס לא קיים → `NOT_FOUND` (השרת לא מגיע ל־debit כי הטופס לא נמצא).
- בקוד: ב־`submissions.update` אין קריאה ל־`deductUserPoints`, `insertTransparencyLog`, או `recordAgentCommission` – רק `updateSubmissionContent` ו־`insertAuditLog`.

---

## 4. אבטחה בצד שרת

- **עריכה:** רק בעל הטופס (`submission.userId === ctx.user.id`) או מנהל (`ctx.user.role === 'admin'`). אחרת `FORBIDDEN`.
- **תנאי עריכה:** `tournament.status === 'OPEN'` ו־`!tournament.isLocked`. אחרת `BAD_REQUEST` ("אי אפשר לערוך אחרי סגירת התחרות" / "הטורניר נעול").
- **Audit:** כל עריכה נרשמת ב־`audit_logs`: `action: SUBMISSION_EDITED`, `entityType: submission`, `entityId: submissionId`, `diffJson: { old, new }`.

---

## 5. תרחישי בדיקה מומלצים

1. משתמש יוצר טופס חדש → נקודות יורדות פעם אחת.
2. משתמש עורך את אותו טופס 5 פעמים → נקודות לא משתנות.
3. משתמש מנסה לערוך אחרי LOCKED/CLOSED → נחסם עם הודעת שגיאה.
4. משתמש משכפל טופס → נוצר submission חדש ונקודות יורדות שוב.
5. דוחות כספיים: עריכה לא משנה סכומים; Duplicate/Create כן.
