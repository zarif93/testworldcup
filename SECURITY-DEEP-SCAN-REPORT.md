# SECURITY-DEEP-SCAN-REPORT

**תאריך:** מרץ 2025  
**סטטוס:** תיקונים קריטיים בוצעו; ממצאים וחסרים מתועדים.

---

## 1. Findings (Critical / High / Medium / Low)

### Critical – תוקן

| # | ממצא | סיכון | תיקון |
|---|------|--------|--------|
| 1 | **אישור טופס כפול (Approve)** – קריאה כפולה ל־approveSubmission יכלה לעדכן סטטוס פעמיים ו/או לרשום עמלה פעמיים | Double commission / state inconsistency | בדיקת סטטוס לפני עדכון: אם `status === 'approved'` מחזירים `{ success: true }` בלי לכתוב ל-DB |
| 2 | **דחיית טופס כפולה (Reject)** – ללא אידמפוטנטיות | לוג לא עקבי | אם `status === 'rejected'` מחזירים success בלי עדכון |
| 3 | **חלוקת פרסים כפולה (Double Payout)** – שני תהליכים יכלו לעבור את הבדיקה "כבר חולקו" במקביל | גניבת פרסים | נעילת settlement: עדכון `status = 'SETTLING'` רק כאשר `status NOT IN ('PRIZES_DISTRIBUTED','SETTLING')`; אם `returning()` מחזיר 0 שורות – זורקים שגיאה |

### High – טופל / קיים

| # | ממצא | סטטוס |
|---|------|--------|
| 4 | **Double Spend (נקודות)** – `deductUserPoints` ללא טרנזקציה ב-Drizzle path | **נותר:** מומלץ לעטוף ב־transaction + קריאת יתרה בתוך ה-transaction (דורש refactor ל־addUserPoints/deductUserPoints עם פרמטר `tx`) |
| 5 | **עריכת טופס (Edit)** – אינה מחייבת שוב; רק UPDATE לאותו submissionId | **מאומת:** אין debit במסלול update |
| 6 | **החזר (Refund)** – רק כש־!prizesDistributed ו־!finishedOrArchived ב־deleteTournament | **מאומת:** Refund מותר רק לפני settlement |
| 7 | **IDOR – submissions.getById / update** – בדיקת בעלות (isOwner \|\| isAdmin) | **מאומת** |
| 8 | **Agent – שחקן לא של הסוכן** – ב־getPlayerPnLDetail ו־withdrawFromPlayer/depositToPlayer ב-db | **מאומת:** `agentId` נבדק ב-db |

### Medium

| # | ממצא | סטטוס |
|---|------|--------|
| 9 | **Rate limit submissions** – היה 5/דקה; הוגדל ל־30/דקה לפי דרישה | **תוקן** |
| 10 | **Login rate limit** – 5/דקה ל-IP (loginRateLimit.ts) | **קיים** |
| 11 | **Idempotency key** – submit תומך ב־idempotencyKey (30s TTL) | **קיים** |
| 12 | **CSV Export** – escape לתאים שמתחילים ב־=+-\@ (csvExport.ts) | **קיים** |
| 13 | **Payload validation** – Zod על כל ה-inputs ב-tRPC | **קיים** |

### Low

| # | ממצא | סטטוס |
|---|------|--------|
| 14 | **Admin export** – אין rate limit ייעודי ל-exports | המלצה: 10/דקה ל-exports |
| 15 | **סוכן – withdraw/deposit** – מבוצע ב-transaction ב-SQLite (agentWithdrawFromPlayer / agentDepositToPlayer) | **קיים** |

---

## 2. Fixes Applied (סיכום)

- **routers.ts**
  - **approveSubmission:** שליפת טופס בהתחלה; אם `status === 'approved'` – return success ללא עדכון/עמלה; אחרת עדכון סטטוס, עמלה, audit.
  - **rejectSubmission:** אם `status === 'rejected'` – return success; אחרת עדכון + audit.
  - **submissions.getAll:** כבר הוגדר לפי תפקיד (מנהל = כל הטפסים, משתמש = שלו, אורח = []) – מאומת.
  - **Rate limit טפסים:** SUBMISSIONS_PER_MINUTE 5 → 30.
- **db.ts**
  - **distributePrizesForTournament:** נעילת settlement – עדכון `status = 'SETTLING'` עם תנאי `notInArray(status, ['PRIZES_DISTRIBUTED','SETTLING'])` ו־`.returning({ id })`; אם `updated.length === 0` – בדיקה מחדש של prize rows וזריקת שגיאה מתאימה.
  - **ייבוא:** הוספת `notInArray` מ-drizzle-orm.

---

## 3. Remaining Risks (מה עדיין חסר ל-100)

1. **טרנזקציה ל־deductUserPoints/addUserPoints (Drizzle)**  
   כרגע: קריאת יתרה ואז update + insert בשתי פעולות. במקרה של עומס, שני requests יכולים לקרוא אותה יתרה. **פתרון מומלץ:** להריץ את כל הפעולה ב־`db.transaction()` ולקרוא יתרה בתוך ה-transaction (ולהעביר `tx` ל־addUserPoints/deductUserPoints).

2. **Rate limit ל-exports**  
   אין הגבלה ייעודית ל־export (CSV וכו'). מומלץ: 10–60 בקשות לדקה למשתמש/מנהל.

3. **Admin actions rate limit**  
   אין הגבלה כללית ל־admin (למעט login). מומלץ: 60 פעולות לדקה ל-admin.

4. **לוג חשוד (Suspicious activity)**  
   אין עדיין לוג/התראה על פעולות חריגות (למשל הרבה approve ברצף, הרבה distribute וכו').

5. **Policy layer אחיד**  
   הרשאות מפוזרות ב-middleware (protectedProcedure, adminProcedure, superAdminProcedure) ובבדיקות ידניות בתוך ה-handlers. איחוד ל־requireRole/requirePermission מרכזי יכול לשפר עקביות.

---

## 4. Checklist מוכנות (Security)

| פריט | סטטוס |
|------|--------|
| מניעת שליחת טופס אחרי סגירה/נעילה | ✅ |
| מניעת חיוב כפול (idempotency key ל� submit) | ✅ |
| עריכת טופס ללא חיוב | ✅ |
| אישור/דחייה אידמפוטנטיים | ✅ |
| חלוקת פרסים פעם אחת (נעילת SETTLING) | ✅ |
| החזר רק לפני settlement | ✅ |
| נקודות לא שליליות (בדיקה ב-deductUserPoints) | ✅ |
| בדיקות בעלות (IDOR) על submission/user/agent | ✅ |
| Rate limit login | ✅ |
| Rate limit submissions | ✅ (30/דקה) |
| Validation (Zod) על כל ה-inputs | ✅ |
| CSV injection (escape) | ✅ |
| רישום ב-audit/ledger לתנועות קריטיות | ✅ |
| טרנזקציה ל-debit (Drizzle path) | ⚠️ מומלץ |
| Rate limit exports/admin | ⚠️ מומלץ |

---

## 5. ציון מוכנות: 82/100

- **נימוק:**  
  - טופלו פרצות קריטיות: approve/reject idempotent, חלוקת פרסים עם נעילה, rate limit טפסים.  
  - קיימות: בדיקות הרשאות, validation, CSV escape, audit, refund rules, agent transactions ב-SQLite.  
  - חסר: טרנזקציה מלאה ל-debit ב-Drizzle, rate limits ל-exports/admin, ולוג/התראה על פעילות חריגה.

---

## 6. קבצים ששונו

- `server/routers.ts` – approve/reject idempotent, rate limit 30/min.
- `server/db.ts` – נעילת SETTLING ב־distributePrizesForTournament, ייבוא notInArray.
- `DEEP-SCAN-INVENTORY.md` – נוצר (מיפוי endpoints ו-risk).
- `SECURITY-DEEP-SCAN-REPORT.md` – קובץ זה.

---

## 7. הרצת בדיקות ואימות

```bash
# TypeScript
pnpm run check

# Unit / integration
pnpm run test

# Production readiness (הרשאות ותרחישי קיצון)
pnpm run test:production
```

**לוודא אחרי השינויים:**
- התחברות משתמש ומנהל.
- שליחת טופס (חיוב נקודות).
- עריכת טופס (ללא חיוב).
- נעילת תחרות – חסימת שליחה.
- אישור טופס פעם שנייה – מחזיר success בלי לשנות נתונים.
- חלוקת פרסים – פעם ראשונה עוברת; ניסיון שני נחסם עם הודעת שגיאה.
