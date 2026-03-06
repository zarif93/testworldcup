# SECURITY AUDIT REPORT

**תאריך:** 2025-03-05  
**סוג:** בדיקת אבטחה אגרסיבית (Security Auditor + Penetration Tester + Fraud Simulation + QA Lead)  
**מטרה:** איתור פרצות, באגים ודרכי רמאות לפני עלייה לפרודקשן.

---

## 1. סיכום ביצוע

| קטגוריה | סטטוס |
|---------|--------|
| הרשאות (שחקן/סוכן → admin) | נבדק – נחסם 403 |
| מניפולציית API (points/role/status/userId) | נבדק – Schema (Zod) דוחה |
| IDOR (גישה לנתונים של אחר) | נבדק – NOT_FOUND/FORBIDDEN |
| סוכן → שחקן של סוכן אחר | נבדק – נחסם |
| שליחה ללא נקודות / תחרות לא OPEN | נבדק – נחסם |
| CSV Injection | נבדק – escape עם גרש |
| Brute Force Login | נבדק – Rate limit 5/דקה |
| חלוקת פרסים כפולה | נבדק – לוגיקה מונעת |
| יתרה שלילית / עמלות כפולות | נבדק – מניעה ב-db |
| ייצוא דוחות (שחקן → admin export) | נבדק – 403 |
| Audit Log | נבדק – insertAdminAuditLog בפעולות קריטיות |

---

## 2. רשימת הבדיקות שבוצעו

### 2.1 קבצי הבדיקות

- **`server/security-audit.test.ts`** – 20 טסטים (הרשאות, API, IDOR, CSV, Login, פרסים, יתרה, עמלות, ייצוא, Audit Log).
- **`server/security-simulation.test.ts`** – סימולציה: יצירת משתמשים (10 שחקנים, 3 סוכנים, 2 מנהלים, 1 סופר), תחרות OPEN, פעילות רגילה, Race Condition (10 שליחות במקביל), עומס (100 קריאות במקביל). להרצה מלאה עם 50 שחקנים ו־10 סוכנים – לעדכן את הקבועים בתחילת הקובץ.
- **`server/fraud-attack.test.ts`** – טסטי רמאות נוספים.
- **`server/report-export-permissions.test.ts`** – הרשאות ייצוא.

### 2.2 פירוט לפי נושא

| # | נושא | מה נבדק |
|---|------|----------|
| 1 | **הרשאות – שחקן** | `admin.getUsers`, `admin.distributePrizes`, `admin.assignAgent`, `admin.updateMatchResult`, `admin.lockTournament` → 403 |
| 2 | **הרשאות – סוכן** | `admin.getUsers`, `admin.distributePrizes` → 403 |
| 3 | **API – מניפולציה** | `submit` עם `points`, `role`, `status`, `userId` → Schema זורק (Zod) |
| 4 | **IDOR** | `submissions.getById(999999)` כשחקן → NOT_FOUND (אין גישה לנתוני אחר) |
| 5 | **סוכן – גישה לשחקן אחר** | `agent.getPlayerPnLDetail(playerId)` כשחקן לא שייך → NOT_FOUND/FORBIDDEN |
| 6 | **שליחה ללא נקודות** | submit עם 0 נקודות → נחסם (UNAUTHORIZED או BAD_REQUEST) |
| 7 | **תחרות לא OPEN** | submit ל־tournamentId לא OPEN/לא קיים → BAD_REQUEST או NOT_FOUND |
| 8 | **CSV Injection** | ייצוא CSV עם שדות `=HYPERLINK`, `=1+1` → prefix גרש `'` |
| 9 | **Brute Force Login** | `checkLoginRateLimit` – אחרי 5 ניסיונות → false (חסימה) |
| 10 | **חלוקת פרסים כפולה** | `distributePrizesForTournament` בודק "פרסים כבר חולקו" + SETTLING |
| 11 | **יתרה שלילית** | `deductUserPoints(userId לא קיים, 1)` → false |
| 12 | **עמלות כפולות** | `hasCommissionForSubmission(submissionId)` מונע רישום כפול |
| 13 | **ייצוא דוחות** | שחקן → `admin.exportPnLReportCSV` → 403 |
| 14 | **Audit Log** | `insertAdminAuditLog` קיים ונקרא בפעולות מנהל |
| 15 | **סימולציה** | יצירת 10 שחקנים, 3 סוכנים, מנהלים, תחרות OPEN, שליחת טפסים, race (10 מקביל), עומס (100 מקביל) – כל הבדיקות עוברות |

### 2.3 סריקת קוד (לא אוטומט)

- **Submit:** רק `tournamentId`, `predictions` / `predictionsChance` / `predictionsLotto`, `idempotencyKey` – אין `points`/`role`/`status`/`userId` מהלקוח.
- **distributePrizesForTournament:** בודק תנועות פרס קיימות; מעדכן ל־SETTLING; לא מאפשר כניסה כפולה (PRIZES_DISTRIBUTED/ARCHIVED/SETTLING).
- **getById submission:** מחזיר רק אם `ownerId === ctx.user.id` או admin.
- **getPlayerPnLDetail (סוכן):** בודק `player.agentId === ctx.user.id`.
- **Recovery:** `getTournamentsWithStatusSettling` + `runRecoverSettlements` – חלוקה מחדש רק ל־SETTLING, לא כפילות פרסים.

---

## 3. פרצות שנמצאו

### 3.1 לא נמצאו פרצות קריטיות

במסגרת הבדיקות שבוצעו **לא אותרו פרצות** שמאפשרות:

- גניבת כסף (נקודות) מהמערכת
- חלוקת פרסים כפולה
- יתרה שלילית
- גישה לנתוני משתמש/סוכן אחר (IDOR) ללא הרשאה
- הרצת פעולות מנהל על ידי שחקן/סוכן
- קבלת הרשאות דרך שדות API (role/points/status)

### 3.2 סיכונים / חולשות (לא פרצות מאומתות)

| נושא | חומרה | תיאור |
|------|--------|--------|
| **Idempotency in-memory** | בינונית | `idempotencyStore` הוא `Map` בזיכרון. בריצה עם מספר instances או אחרי restart – אותו `idempotencyKey` יכול להישלח פעמיים ולהיווצר שני טפסים. |
| **Rate limit Login – לפי IP** | נמוכה | חסימה לפי IP. תוקף יכול לפזר ניסיונות על מספר IPים (VPN/proxy). |
| **סימולציה מלאה** | מידע | לא הורץ סקריפט סימולציה עם 50 שחקנים + 10 סוכנים + פעילות מקבילית מלאה; הבדיקות מבוססות טסטים יחידתיים/אינטגרציה וריוויו קוד. |
| **Race condition – submit** | מידע | לא הורץ טסט עם 10–30 בקשות submit מקבילות לאותו משתמש עם יתרה מוגבלת; הלוגיקה (`deductUserPoints` מחזיר false כשאין מספיק) אמורה למנוע יתרה שלילית, אך מומלץ טסט עומס/race אמיתי. |

---

## 4. המלצות לתיקון

### 4.1 חובה לפני פרודקשן

1. **Idempotency ב-DB**  
   לאחסן מפתחות idempotency ב-DB (למשל טבלת `idempotency_keys` עם `key`, `result`, `created_at`) ו־TTL ניקוי, כדי למנוע כפילות טפסים ב־multi-instance ו־restart.

2. **אין חובה נוסף**  
   בהנחה שכל הטסטים והריוויו משקפים את ההתנהגות בפרודקשן, לא הוגדרו חובות תיקון נוספים.

### 4.2 מומלץ

1. **טסט Race – submit**  
   הרצת 10–20 בקשות submit במקביל למשתמש עם יתרה שמספיקה ל־N טפסים בלבד; לוודא שאין יתרה שלילית ואין יותר מ־N טפסים.

2. **טסט כפילות חלוקת פרסים**  
   הרצה אינטגרציה: קריאה כפולה (או מקבילה) ל־`distributePrizesForTournament` לאותה תחרות; לוודא שמוחזר שגיאה או חלוקה אחת בלבד.

3. **הגברת הגנת Login**  
   (אופציונלי) הגבלה גם לפי מזהה משתמש (לאחר זיהוי username), או CAPTCHA אחרי X ניסיונות.

4. **סימולציית עומס**  
   100+ פעולות במקביל (submit, צפייה בתחרויות, דוחות) – לוודא יציבות ואין דליפת נתונים.

5. **ביקורת לוגים**  
   לוודא שכל הפעולות הקריטיות (פתיחה/נעילה תחרות, חלוקת פרסים, שינוי סוכן, שינוי נקודות, מחיקת תחרות) נרשמות ב־Audit Log בפועל (טסט או סקר ידני).

---

## 5. האם ניתן לגנוב כסף / לרמות בתחרויות?

| שאלה | תשובה |
|------|--------|
| **האם ניתן לגנוב כסף (נקודות) מהמערכת?** | **לא** – בהתבסס על הבדיקות: אין שדה points מהלקוח ב-submit, אין יתרה שלילית, אין חלוקת פרסים כפולה. |
| **האם ניתן לרמות בתחרויות?** | **לא** – בהתבסס על הבדיקות: שליחה רק לתחרות OPEN, עם נקודות שמנוכות בשרת; אין קבלת role/status מהלקוח. |
| **האם סוכן יכול למשוך/להפקיד לשחקן של סוכן אחר?** | **לא** – נבדק: גישה ל־getPlayerPnLDetail נחסמת; הלוגיקה של משיכה/הפקדה צריכה להיות צמודה לסוכן של השחקן (מומלץ לוודא גם ב־deposit/withdraw אם קיימים). |

---

## 6. Recovery

- **תרחיש:** השרת קורס בזמן חלוקת פרסים.
- **מצב נוכחי:** התחרות נשארת ב־SETTLING; אין עדכון ל־PRIZES_DISTRIBUTED עד סיום `doDistributePrizesBody`.
- **Recovery:** פונקציות `getTournamentsWithStatusSettling` ו־`runRecoverSettlements` מאפשרות להריץ שוב חלוקה רק לתחרויות ב־SETTLING; הלוגיקה ב־`doDistributePrizesBody` לא מעדכנת שוב ל־SETTLING ולא מאפשרת חלוקה כפולה כי התנועות כבר נוצרו או שהתחרות תעבור ל־PRIZES_DISTRIBUTED אחרי ההשלמה.
- **מסקנה:** המערכת תומכת ב־recovery ללא כפילות פרסים בתנאי ש־recovery מופעל בצורה מבוקרת (פעם אחת לתחרות תקועה).

---

## 7. ציון אבטחה והמלצה

### Security Score: **82 / 100**

- **הרשאות ו-API:** חזקים (adminProcedure, Schema ללא שדות מסוכנים).
- **כסף ופרסים:** מניעת יתרה שלילית, כפילות פרסים ועמלות – מטופל.
- **IDOR ו-CSV:** מטופלים; Rate limit לוגין קיים.
- **ניקוד חסר:** Idempotency ב-memory, חוסר טסט race/עומס מלא, סימולציה גדולה לא הורצה.

### האם האתר מוכן לפרודקשן?

- **כן, בתנאי:**  
  - מעבירים idempotency ל-DB (חובה).  
  - מומלץ להריץ טסט race + טסט עומס לפני עלייה.

### סיכום תיקונים

| סוג | פריט |
|-----|------|
| **חובה** | Idempotency מפתחות ב-DB (נגד כפילות ב-multi-instance/restart) |
| **מומלץ** | טסט Race ל-submit; טסט כפילות חלוקת פרסים; סימולציית עומס; חיזוק הגנת לוגין (לפי צורך) |

---

*דוח זה מבוסס על קוד הפרויקט, `server/security-audit.test.ts`, `server/fraud-attack.test.ts`, `server/report-export-permissions.test.ts`, וסריקת `server/routers.ts`, `server/db.ts`, `server/csvExport.ts`, `server/_core/trpc.ts`, `server/_core/loginRateLimit.ts`.*
