# SECURITY THREAT MODEL

## 1. מיפוי הפרויקט

### טכנולוגיות
- **Backend:** Node.js, Express, tRPC (procedures: public / protected / admin / superAdmin)
- **Frontend:** React, Vite, wouter, tRPC client
- **DB:** SQLite (better-sqlite3) / אופציונלי MySQL; Drizzle ORM + raw prepared statements ב-init
- **Auth:** JWT (jose) ב-cookie (`app_session_id`), OAuth (Manus) או local login (username+password, bcrypt)
- **תלויות אבטחה:** helmet, express-rate-limit, cors (custom middleware), bcryptjs, jose

### תיקיות מרכזיות
- `server/` – auth.ts, db.ts, routers.ts, csvExport.ts, _core/ (context, trpc, env, sdk, oauth)
- `client/src/` – pages (Login, Register, AdminPanel, AgentDashboard, Submissions, PredictionForm)
- `drizzle/` – schema-sqlite.ts
- `shared/` – const.ts

### Endpoints (tRPC routes)
- **Auth:** auth.register, auth.login, auth.logout, auth.me, auth.checkUsername
- **Points:** auth.getPointsHistory, auth.getPlayerPnL, auth.exportMyPlayerReport (protected/agent)
- **Tournaments:** tournaments.getAll, getById, getPublicStats, getCustomFootballMatches
- **Matches:** matches.getAll, getById
- **Submissions:** submit (protected), update (protected), getAll (public), getById (public), getByTournament, getMine, getMyEntriesForTournament, get*Leaderboard
- **Transparency:** getSummary (public)
- **Admin:** getStatus, verifyCode, getUsers, getAllSubmissions, getPendingSubmissionsCount, getFinancialReport, getDataFinancialRecords, approveSubmission, rejectSubmission, depositPoints, withdrawPoints, getPointsLogs, getBalanceSummary, getAgentsWithBalances, exportPnLSummaryCSV, exportAgentPnLCSV, exportPlayerPnLCSV, exportPointsLogsCSV, deletePointsLogsHistory (superAdmin), distributePrizes, updateMatchResult, updateMatch, lockTournament, hideTournamentFromHomepage, getTransparencySummary, getTransparencyLog, deleteTransparencyHistory (superAdmin), createAdmin, deleteAdmin, …
- **Agent:** getWallet, withdrawFromPlayer, depositToPlayer, getMyPlayersWithBalances, getAgentTransferLog, getBalanceSummary

### נקודות קריטיות
- Login/Register (local auth + OAuth callback)
- Admin panel (verifyCode cookie, adminProcedure)
- Agent wallet & transfer (agentProcedure / ownership)
- Submissions submit/update (points debit, tournament OPEN)
- Results & settlement (updateMatchResult, distributePrizes)
- Points deposit/withdraw (admin), agent deposit/withdraw
- Export CSV (admin/agent – PnL, points logs)
- SuperAdmin: deletePointsLogsHistory, deleteTransparencyHistory, createAdmin, deleteAdmin

---

## 2. Assets

| Asset | תיאור | רגישות |
|------|--------|--------|
| Points / balance | יתרות שחקנים וסוכנים | גבוהה |
| Tournament results | תוצאות משחקים, הגרלות | גבוהה |
| Payouts / settlement | חלוקת פרסים | גבוהה |
| Agent commissions | עמלות סוכנים | גבוהה |
| Admin actions | נעילה, אישור טפסים, הפקדות/משיכות | גבוהה |
| User data | username, phone, name, role, agentId | בינונית |
| Submissions | ניחושים, סטטוס, תשלום | בינונית |
| Financial reports / transparency log | דוחות כספיים, שקיפות | בינונית |

---

## 3. Actors

| Actor | יכולות |
|-------|--------|
| Guest | צפייה בתחרויות, דירוגים, שקיפות; לא שליחת טפסים |
| User | שליחת/עדכון טפסים (לעצמו), צפייה בנקודות ובדוחות אישיים |
| Agent | ניהול שחקנים שלו בלבד, הפקדה/משיכה מיתרת הסוכן |
| Admin | ניהול תחרויות, תוצאות, אישור/דחיית טפסים, הפקדות/משיכות, דוחות, ייצוא |
| SuperAdmin | כמו Admin + מחיקת היסטוריה, ניהול מנהלים |
| Attacker (external) | ניסיון לעקוף auth, להעלות הרשאות, לשנות נקודות/תוצאות, לגנוב נתונים |

---

## 4. Attack Vectors

| Vector | תיאור | צעדי הגנה |
|--------|--------|------------|
| Auth bypass | התחזות ללא token / token מזויף | JWT_SECRET חובה, cookie HttpOnly/Secure/SameSite |
| Privilege escalation | שליחת role/agentId/points ב-API | לא לקבל שדות רגישים מלקוח; server-controlled |
| IDOR | גישה ל-submission/user/agent של אחר | בדיקת ownership בכל endpoint שמקבל id |
| CSRF | פעולה בשם המשתמש מאתר זר | SameSite cookie; אופציונלי CSRF token |
| XSS | הזרקת סקריפט בשם/כותרת/הערות | escape ב-frontend; CSP |
| SQLi | הזרקת SQL ב-input | Prepared statements / ORM בלבד |
| SSRF | fetch ל-URL מהלקוח | אם יש – allowlist hosts; חסימת private IPs |
| Rate abuse | brute force login, הצפת submissions | Rate limit ל-login, submissions, admin |
| Race conditions | כפילות settlement / כפילות debit | Idempotency; lock או בדיקת סטטוס |
| Replay | שימוש חוזר ב-request | Idempotency key; token expiry |
| Tampering | שינוי payload (points, amounts) | חישוב בשרת בלבד; validation |
| CSV injection | ייצוא עם =+@ ב-Excel | prefix ' לשדות שמתחילים ב-=+@ |
| Cron manipulation | שינוי זמן/לוגיקה של cleanup | קוד קבוע; אין הפעלה מלקוח |

---

## 5. הנחות

- השרת רץ מאחורי reverse proxy (למשל nginx) ב-production; HTTPS מופעל שם.
- JWT_SECRET ו-ADMIN_SECRET מוגדרים ב-production (או השרת מזהיר).
- משתמשים לא יכולים לערוך cookie או token ישירות מלבד התחזות אם ה-secret דלף.
- DB (SQLite/MySQL) נגיש רק לשרת; אין גישה ישירה מלקוח.

---

## 6. סיכום סיכונים (לפני תיקונים)

- **גבוה:** CORS ב-dev מאפשר `*`; ב-production origin מהבקשה – לאפשר רק allowlist. JWT_SECRET fallback ב-production.
- **בינוני:** getById(submission) ציבורי – לחשוף רק מטא-דאטה או להגביל לבעלים/admin. ייצוא CSV בלי הגנה מפני CSV injection.
- **בינוני:** Rate limit כללי ל-API; אין rate limit ספציפי ל-login (יש authLimiter על /api/oauth/callback בלבד – login מקומי ב-tRPC).
- **נמוך:** SQL עם prepared statements; אין concatenation של קלט משתמש ל-SQL.

---

*מסמך זה הוא בסיס ל-SECURITY-AUDIT-REPORT.md ולתיקוני אבטחה בהמשך.*
