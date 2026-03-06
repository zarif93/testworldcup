# דוח Code Review – פרויקט World Cup 2026

**תאריך:** מרץ 2025  
**סטטוס:** תיקונים שבוצעו + ממצאים להמשך

---

## 1. רשימת באגים שנמצאו ותוקנו

### 1.1 הרשאות ו־API
- **`submissions.getAll` חשף את כל הטפסים לכולם (כולל אורחים)**  
  - **תיקון:** ה־endpoint מחזיר כעת: מנהל – כל הטפסים; משתמש מחובר – רק הטפסים שלו; אורח – מערך ריק.  
  - **קובץ:** `server/routers.ts`

- **דף דירוג (Leaderboard) הסתמך על `getAll` לדירוג מונדיאל**  
  - **תיקון:** כרטיס הדירוג למונדיאל טוען כעת ישירות `submissions.getByTournament({ tournamentId })` לכל טורניר, כך שהדירוג הציבורי זמין גם לאורחים בלי לחשוף את כל הטפסים.  
  - **קובץ:** `client/src/pages/Leaderboard.tsx`

### 1.2 לוגיקה ו־Audit
- **דחיית טופס (rejectSubmission) לא נרשמה ב־audit log**  
  - **תיקון:** נוסף `insertAdminAuditLog` עם פעולה "Reject Submission", `targetUserId` ו־`details` (submissionId, tournamentId).  
  - **קובץ:** `server/routers.ts`

---

## 2. רשימת שגיאות שתוקנו

| תיאור | קובץ | הערה |
|------|------|------|
| חסר רישום audit בדחיית טופס | `server/routers.ts` | נוסף `insertAdminAuditLog` ב־rejectSubmission |
| חשיפת כל הטפסים ב־getAll | `server/routers.ts` | getAll מחזיר לפי תפקיד/מחובר |
| דירוג מונדיאל תלוי ב־getAll | `client/src/pages/Leaderboard.tsx` | שימוש ב־getByTournament לכל טורניר |

---

## 3. קבצים שנמחקו

- **לא נמחקו קבצים.**  
- **הערה:** קיימים paths כפולים בגלל backslash vs forward slash (Windows) – אלה אותו קובץ; אין קבצים מתים שהוסרו במסגרת ה־review.

---

## 4. קבצים שעברו Refactor

| קובץ | שינוי |
|------|------|
| `server/routers.ts` | הגבלת `submissions.getAll` לפי תפקיד; הוספת audit ב־rejectSubmission |
| `client/src/pages/Leaderboard.tsx` | טעינת דירוג מונדיאל דרך `getByTournament` בתוך הכרטיס; הסרת תלות ב־getAll ו־byTournament |

---

## 5. שיפורי ביצועים שבוצעו

- **דף דירוג:** במקום לטעון את כל הטפסים (getAll) ולסנן בצד הלקוח – כל כרטיס טורניר מונדיאל טוען רק את הטפסים של אותו טורניר (`getByTournament`), כך שפחות נתונים נשלחים ופחות עיבוד ב־client.

---

## 6. ממצאים שלא תוקנו (המלצות)

### 6.1 לוגיקה ועסקים
- **נקודות שליליות:** `deductUserPoints` ב־db.ts בודק `current < amount` ומחזיר `false` – אין אפשרות ליתרה שלילית. **מצב:** תקין.
- **שליחת טופס אחרי נעילה:** ב־submit בודקים `tournament.isLocked` ו־`closesAt`. **מצב:** תקין.
- **חלוקת פרסים פעם אחת:** `distributePrizesForTournament` בודקת קיום רשומת `point_transactions` מסוג `prize` עם `referenceId = tournamentId` וזורקת אם כבר חולק. **מצב:** תקין.
- **עריכת טופס ללא חיוב:** `submissions.update` לא קוראת ל־deductUserPoints. **מצב:** תקין.

### 6.2 ביצועים
- **N+1 ב־exportPointsLogsCSV:** עבור כל שורה נשלחת קריאה ל־`getUserById` ו־`getAgentById`. **המלצה:** לאסוף את כל ה־userIds ו־agentIds ולטעון במנה אחת (batch) ולמפות ב־memory.
- **admin.updateMatchResult:** מעדכן תוצאה ואז טוען את כל המשחקים ואת כל הטפסים ומחשב נקודות בלולאה – כבד בטורנירים גדולים. **המלצה:** לחשב רק טפסים של התחרות/משחקים הרלוונטיים או לעדכן נקודות רק לטפסים שמושפעים.

### 6.3 ארכיטקטורה
- המבנה הנוכחי: ליבת שרת ב־`server/_core` (auth, context, trpc, cookies, env), לוגיקה ב־`server/routers.ts` ו־`server/db.ts`. אין EventBus או מודול Features נפרד; התקשורת בין “תחרויות”, “טפסים”, “נקודות” היא ישירה דרך db ו־routers. **המלצה:** אם הפרויקט יגדל – לשקול פיצול ל־feature modules ותקשורת דרך event bus או שירותים משותפים.

### 6.4 Database
- **אינדקס:** ב־db.ts (SQLite) קיים אינדקס `point_transactions_reference_action_idx` על (referenceId, actionType) – משמש את הבדיקה “פרסים כבר חולקו”. **מצב:** מתאים.
- **טרנזקציות:** `agentWithdrawFromPlayer` ו־`agentDepositToPlayer` משתמשים בנעילה (lock) ו־transaction ב־SQLite. **מצב:** מתאים.
- **כפילות חלוקת פרסים:** נמנעת על ידי בדיקת קיום רשומת prize ל־tournamentId. **מצב:** תקין.

### 6.5 ניקוי
- **console.log / console.warn / console.error:**  
  - ב־`server/db.ts` – בעיקר הודעות מיגרציה והתחלה; ניתן להעביר ל־logger.  
  - ב־`server/_core/index.ts` – הודעות הרצה ב־development; מתאים.  
  - ב־`server/_core/logger.ts` – שימוש ב־console לפי רמת לוג; מתאים.  
  - ב־scripts (create-admin, backup-db, load-test וכו') – שימוש ב־console סביר לסקריפטים.  
- **המלצה:** להשאיר כרגע; אם רוצים לוג אחיד – להעביר הודעות מ־db.ts ל־logger.

### 6.6 קבצים / קוד שלא בשימוש
- **ComponentShowcase.tsx:** לא נמצא שימוש ב־client (אין import או route). **המלצה:** להסיר או לחבר ל־route רק ב־dev אם נחוץ להצגת קומפוננטות.

---

## 7. ציון איכות קוד (0–100)

**ציון משוער: 78/100**

- **נימוק:**  
  - לוגיקת תחרויות, טפסים, נקודות ופרסים ברורה ומכוסה (נעילה, סגירה, חלוקה חד־פעמית, עריכה ללא חיוב).  
  - תיקון חשיפת טפסים ב־getAll והרחבת audit משפרים אבטחה ותיעוד.  
  - קוד הלקוח מאורגן (דפים, קומפוננטות, hooks).  
  - חיסרים: ריכוז גדול ב־routers.ts ו־db.ts, N+1 ב־export מסוים, מעט console.log בשרת, ואין עדיין הפרדה ברורה ל־Features + EventBus.

---

## 8. וידוא שהפרויקט עובד לאחר התיקונים

- **מומלץ להריץ:**
  - `pnpm run check` (TypeScript)
  - `pnpm run test` (בדיקות קיימות)
- **תרחישים לבדיקה ידנית:**
  - אורח נכנס לדירוג – רואים דירוג מונדיאל (כל טורניר נטען בנפרד).
  - משתמש מחובר נכנס לטפסים – רואים רק את הטפסים שלו.
  - מנהל נכנס לטפסים (או ל־admin) – רואים את כל הטפסים.
  - דחיית טופס ממנהל – מופיע רישום ב־audit log.

---

**סיכום:** בוצעו תיקוני באגים והרשאות (getAll, rejectSubmission audit) ו־refactor קל בדף הדירוג. שאר הממצאים תועדו כהמלצות להמשך בלי לשכתב את הפרויקט.
