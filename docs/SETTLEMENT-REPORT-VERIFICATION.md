# בדיקות דוח הסדר שחקן (Player Settlement Report)

## דרישות מקדימות

- SQLite (ללא `DATABASE_URL`)
- Node עם `npx tsx`

---

## שלב 1: הזרקת נתוני בדיקה

```bash
npx tsx scripts/seed-settlement-report-test-data.ts
```

**פלט מצופה:**

```
Created test user 999001
Created tournament 899001 Settlement Test T1
Created tournament 899002 Settlement Test T2
...
Created submission 899001 tournament 899001
...
Inserted financial_events for 6 cases.
Done. Test player ID for report: 999001
```

(אם כבר הרצת בעבר: "Test user already exists", "Financial events already seeded"...)

---

## שלב 2: הרצת סקריפט אימות (EXPECTED vs ACTUAL)

```bash
npx tsx scripts/run-settlement-report-verification.ts 999001
```

**פלט מצופה:**

```
EXPECTED:
-250
-125
+400
0
0
+300
finalResult: +325

ACTUAL:
-250
-125
+400
0
0
+300
finalResult: +325

All result values and finalResult match expected.

CSV export contains expected values.
```

(קוד יציאה 0)

---

## שלב 3: Endpoint דיבאג (רק בפיתוח)

הפעל את השרת:

```bash
npm run dev
```

בדפדפן או עם curl:

```bash
curl -s http://localhost:3000/debug/player-settlement/999001
```

**פלט מצופה (מקוצר):**

```json
{
  "userId": 999001,
  "username": "settlement_test_player",
  "rows": [
    { "competition": "Settlement Test T1", "entry": 500, "winnings": 250, "commission": 250, "result": -250 },
    { "competition": "Settlement Test T2", "entry": 500, "winnings": 375, "commission": 125, "result": -125 },
    ...
  ],
  "finalResult": 325
}
```

---

## שלב 4: בדיקה במסך אדמין + ייצוא CSV

1. התחבר כאדמין.
2. עבור למרכז כספים → טאב "שחקן".
3. בחר שחקן עם ID **999001** (או שם settlement_test_player).
4. בדוק:
   - שורה 1: השתתפות 500, זכיות 250, עמלה 250, **תוצאה -250**
   - שורה 2: 500, 375, 125, **-125**
   - שורה 3: 500, 900, 100, **+400**
   - שורה 4: 500, 500, 100, **0**
   - שורה 5: 0 (החזר), 0, 0, **0**
   - שורה 6: 0, 300, 0, **+300**
   - **תוצאה סופית: +325**
5. לחץ "ייצוא CSV" ובדוק שהקובץ מכיל את אותם ערכים (תוצאה סופית +325, ותוצאות השורות כבטבלה למעלה).

---

## אימותים נוספים (לוגיקה)

- **אין double counting** – כל ENTRY_FEE מופיע שורה אחת; סכום שורות = finalResult.
- **עמלה לא נכנסת להפסד שחקן** – result = winnings - entry בלבד.
- **החזר נספר נכון** – שורה 5: entry מוצג 0 (500−500), result 0.
- **finalResult סכום שורות** – סיכום result של כל השורות = finalResult.
- **אין rounding/sign bug** – ערכים שלמים; שלילי מוצג עם מינוס.

---

## מקרי הבדיקה (להזכרה)

| Case | השתתפות (נטו) | זכיות | עמלה | תוצאה |
|------|----------------|--------|------|--------|
| 1    | 500            | 250    | 250  | -250   |
| 2    | 500            | 375    | 125  | -125   |
| 3    | 500            | 900    | 100  | +400   |
| 4    | 500            | 500    | 100  | 0      |
| 5    | 0 (החזר)      | 0      | 0    | 0      |
| 6    | 0              | 300    | 0    | +300   |
| **סה"כ** |           |        |      | **+325** |
