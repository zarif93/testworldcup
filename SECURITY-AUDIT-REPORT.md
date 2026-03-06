# SECURITY AUDIT REPORT

**תאריך:** 2025-03-05  
**פרויקט:** אתר תחרויות (צ'אנס/לוטו/כדורגל/מונדיאל + נקודות + סוכנים + אדמין)  
**סטטוס:** תיקונים שבוצעו + המלצות לפרודקשן

---

## 1. סיכום מנהלים

- **ציון מוכנות אבטחה (לאחר תיקונים): 78/100**
- **מה בוצע:** חיזוק Auth, הרשאות (IDOR), CORS, Rate limiting, Security headers, הגנת CSV injection, טסטי אבטחה.
- **מה חסר ל-100:** MFA ל-admin, CSP מחמיר, ריצת `npm audit fix` ועדכון תלויות עם CVE, WAF/תיעוד פרודקשן.

---

## 2. חולשות שנמצאו ותוקנו

### Phase 1 – Auth / Session / Tokens

| בעיה | תיקון |
|------|--------|
| JWT_SECRET לא חובה בפרודקשן | ב-production אם JWT_SECRET ריק – השרת זורק שגיאה (auth.ts). |
| סיסמה מינימלית 6 תווים | עודכן ל-8 תווים (auth.ts + routers register input). |
| אין rate limit ל-login (tRPC) | נוסף login rate limit: 5 ניסיונות לדקה ל-IP (server/_core/loginRateLimit.ts), ונקרא בתחילת auth.login. |

**Cookies:** כבר הוגדרו כראוי (getSessionCookieOptions): HttpOnly, Secure כש-HTTPS, SameSite.

---

### Phase 2 – Authorization + IDOR

| בעיה | תיקון |
|------|--------|
| submissions.getById ציבורי – כל אחד יכול לצפות בכל טופס | הומר ל-protectedProcedure + בדיקת בעלות: רק submission.userId === ctx.user.id או ctx.user.role === 'admin'. אחרת 403. |
| צפייה בטפסים ללא התחברות | ב-SubmissionPredictionsModal: השאילתה ל-getById מופעלת רק כאשר isAuthenticated; אורח רואה "התחבר כדי לצפות בפרטי טופס". |

---

### Phase 5 – CORS / Headers

| בעיה | תיקון |
|------|--------|
| CORS בפרודקשן יכול היה להסתמך על origin מהבקשה | תמיכה ב-ALLOWED_ORIGINS: אם מוגדר – רק origins ברשימה מורשים; אחרת כמו קודם (origin או * ב-dev). |
| חסרים security headers | נוספו ב-helmet: X-Frame-Options: deny, X-Content-Type-Options, Referrer-Policy: strict-origin-when-cross-origin, HSTS. |

---

### Phase 6 – Rate Limiting

| בעיה | תיקון |
|------|--------|
| אין הגבלה על ניסיונות login ב-tRPC | נוסף checkLoginRateLimit (5/דקה ל-IP) בתחילת auth.login. |
| שליחת טפסים | כבר קיים checkSubmissionRateLimit (5/דקה למשתמש). |

---

### Phase 8 – Export Security (CSV Injection)

| בעיה | תיקון |
|------|--------|
| ייצוא CSV ללא הגנה מפני נוסחאות Excel | ב-csvExport.ts: שדה שמתחיל ב-=+-@\t\r מקבל prefix גרש (') לפני היצוא כדי למנוע הפעלת נוסחאות. |

---

## 3. קבצים ששונו

| קובץ | שינוי |
|------|--------|
| SECURITY-THREAT-MODEL.md | חדש – מודל איומים ומיפוי. |
| SECURITY-AUDIT-REPORT.md | חדש – דוח זה. |
| server/auth.ts | JWT_SECRET חובה בפרודקשן; סיסמה מינימלית 8. |
| server/_core/loginRateLimit.ts | חדש – rate limit ל-login לפי IP. |
| server/_core/env.ts | הוספת allowedOrigins (מ-ALLOWED_ORIGINS). |
| server/_core/index.ts | CORS לפי allowlist כש-ALLOWED_ORIGINS מוגדר; helmet עם X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS. |
| server/routers.ts | register: password min 8; login: קריאה ל-checkLoginRateLimit; submissions.getById: protected + בדיקת בעלות. |
| server/csvExport.ts | escapeCsvCell – prefix ' לשדות שמתחילים ב-=+-@\t\r. |
| client/src/components/SubmissionPredictionsModal.tsx | שימוש ב-useAuth; getById רק כש-isAuthenticated; הודעות לאורח ו-403. |
| server/production-readiness.test.ts | טסטים: getById ללא auth → 401; getById כמשתמש לא בעלים → 403/NOT_FOUND; checkLoginRateLimit מגביל אחרי 5. |

---

## 4. מיגרציות DB

לא בוצעו מיגרציות DB במסגרת האודיט. כל השינויים הם בקוד ובהגדרות.

---

## 5. סיכונים שנותרו (Remaining Risks)

- **תלויות:** `npm audit` מדווח על 12 פגיעויות (dompurify, esbuild, fast-xml-parser ועוד). מומלץ להריץ `npm audit fix` ולעדכן גרסאות בהדרגה.
- **CSP:** כרגע contentSecurityPolicy כבוי (עקב תאימות). מומלץ להגדיר CSP מחמיר בהדרגה (למשל דיווח בלבד) ולאחר מכן לאכוף.
- **MFA:** אין 2FA למנהלים. מומלץ להוסיף OTP/2FA אופציונלי לכניסה ל-admin או לפעולות הרסניות.
- **Session invalidation:** אין invalidation מפורש בעת החלפת סיסמה (משתמש יכול להמשיך עם token ישן עד expiry). מומלץ לשמור רשימת tokens שמושבתים או TTL קצר יותר.
- **Audit logs:** קיימים insertAuditLog ו-insertAdminAuditLog; יש להמשיך לרשום כל פעולה רגישה (עדכון תוצאות, settlement, שינוי נקודות, ייצוא דוחות).

---

## 6. המלצות לפרודקשן

- **HTTPS:** להפעיל TLS ב-reverse proxy (nginx) ולוודא x-forwarded-proto מגיע נכון.
- **Secrets:** JWT_SECRET, ADMIN_SECRET ו-DATABASE_URL רק ב-env/מנהל סודות, לא בקוד.
- **ALLOWED_ORIGINS:** להגדיר בדומיין הפרודקשן (למשל `https://yourdomain.com`).
- **Backups:** גיבוי קבוע ל-DB ולקבצי config.
- **WAF:** לשקול WAF (למשל ModSecurity או שירות ענן) מול האתר.
- **ניטור:** לוגים ו-alerts על כשלונות התחברות, 403, ו-rate limit.

---

## 7. הוכחת הרצת טסטים

```text
npx vitest run server/production-readiness.test.ts
✓ server/production-readiness.test.ts (23 tests) 227ms
Test Files  1 passed (1)
Tests  23 passed (23)
```

כולל:
- הרשאות: user/agent לא ניגשים ל-admin; admin לא מוחק היסטוריה; משתמש לא מחובר מקבל 401 על getMine ו-getById.
- Security: getById כמשתמש לא בעלים → 403 או NOT_FOUND; checkLoginRateLimit חוסם אחרי 5 ניסיונות ל-IP.

---

## 8. ציון מוכנות אבטחה (0–100)

| קטגוריה | ציון | הערות |
|----------|------|--------|
| Auth / Session | 85 | JWT חובה בפרודקשן, סיסמה 8+, rate limit ל-login, cookies מאובטחים. חסר: MFA, invalidation בהחלפת סיסמה. |
| Authorization / IDOR | 85 | Guards ל-admin/superAdmin, getById מוגן לפי בעלות. חסר: ריכוז policies במקום אחד. |
| Input / Injection | 80 | Zod על ה-input, prepared statements ב-DB, הגנת CSV. חסר: CSP מחמיר, סניטציה מפורשת לכל output. |
| Business Logic | 82 | Idempotency ל-submit, rate limit לטפסים, settlement ו-debit בשרת. |
| CORS / Headers | 85 | Allowlist כש-ALLOWED_ORIGINS מוגדר, helmet עם headers בסיסיים. |
| Rate Limiting | 80 | login 5/dk, submissions 5/dk למשתמש, apiLimiter כללי. |
| Logging / Audit | 75 | audit_logs ו-admin_audit_log קיימים. יש להרחיב לכיסוי מלא ול-correlation id. |
| Export | 85 | הגנת CSV injection. |
| Dependencies | 65 | יש CVE ב-npm audit; נדרש עדכון. |

**ממוצע משוקלל (בערך): 78/100.**

**מה חסר ל-100:** עדכון תלויות (CVE), MFA ל-admin, CSP אכוף, ריכוז authorization layer, תיעוד פרודקשן ו-runbook לאבטחה.
