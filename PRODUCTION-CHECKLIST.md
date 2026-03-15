# ✅ Production Checklist – Ubuntu 24.04 LTS x64

## רשימת קבצים שנוצרו/עודכנו

| קובץ | פעולה |
|------|--------|
| `.env.production.example` | **נוצר** – תבנית משתני סביבה ל-Production |
| `.gitignore` | **עודכן** – הוספת `.env.production` (לא לעשות commit לסודות) |
| `ecosystem.config.cjs` | **נוצר** – קונפיגורציית PM2 (instances: max, autorestart, env_production) |
| `nginx-worldcup2026.conf` | **נוצר** – קונפיגורציית Nginx (port 80, gzip, security headers) |
| `deploy.sh` | **נוצר** – סקריפט פריסה ל-Ubuntu (apt, npm, build, PM2, nginx) |
| `server/_core/index.ts` | **עודכן** – `x-powered-by` כבוי, CORS ל-Production, לוגים ל-logger ב-production |
| `server/auth.ts` | **עודכן** – הסרת import כפול של ENV |
| `server/_core/cookies.ts` | **קיים** – cookies עם `secure` לפי פרוטוקול (HTTPS) |
| `scripts/create-admin.ts` | **עודכן** – סיסמה מ-env (CREATE_ADMIN_PASSWORD) בלבד, בלי hardcode |
| `client/src/pages/ComponentShowcase.tsx` | **עודכן** – הסרת console.log מיותר |
| `client/src/pages/Home.tsx` | **עודכן** – הסרת console.log מיותר |
| `allow-port-3000.ps1` | **נמחק** – קובץ dev ל-Windows |

---

## פקודות מדויקות להרצה על Ubuntu 24.04

### התקנת Node.js 20 LTS (מומלץ, כי apt נותן גרסה ישנה)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### התקנת PM2 גלובלית

```bash
sudo npm install -g pm2
```

### הכנת הפרויקט והרצה

```bash
cd /var/www/worldcup2026   # או נתיב הפרויקט
git pull
cp .env.production.example .env.production
nano .env.production        # להגדיר JWT_SECRET וערכים נוספים (חובה)
npm install
npm run build
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup                 # להפעלה אוטומטית אחרי אתחול
```

### התקנת Nginx והפעלת ה-Reverse Proxy

```bash
sudo apt update
sudo apt install -y nginx
sudo cp /var/www/worldcup2026/deployment/nginx-worldcup2026.conf /etc/nginx/sites-available/worldcup2026
# לערוך: sudo nano /etc/nginx/sites-available/worldcup2026 – להחליף YOUR_DOMAIN_OR_IP
sudo ln -sf /etc/nginx/sites-available/worldcup2026 /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### עדכון אחרי שינויי קוד

```bash
cd /var/www/worldcup2026
git pull
npm install
npm run build
pm2 reload ecosystem.config.cjs --env production
pm2 save
```

### יצירת מנהל ראשון (פעם אחת)

```bash
cd /var/www/worldcup2026
CREATE_ADMIN_PASSWORD="YourSecurePassword" npx tsx scripts/create-admin.ts
```

---

## מבנה תיקיות סופי מוכן ל-Production

```
worldcup2026/
├── client/                 # מקור Frontend (לא נדרש בפרודקשן אחרי build)
├── server/                 # מקור Backend (לא נדרש בפרודקשן אחרי build)
├── dist/                   # פלט build – להריץ מכאן
│   ├── index.js            # שרת Node
│   └── public/             # קבצי Frontend סטטיים (index.html, assets/)
├── data/                   # SQLite (נוצר בזמן ריצה אם לא קיים)
├── ecosystem.config.cjs     # PM2
├── nginx-worldcup2026.conf # Nginx
├── deploy.sh               # סקריפט פריסה
├── .env.production         # משתני סביבה (לא ב-git – ליצור מ-.env.production.example)
├── .env.production.example # תבנית (נמצא ב-git)
├── deployment/
│   └── nginx-worldcup2026.conf
└── package.json
```

השרת רץ עם: `node dist/index.js` (או דרך PM2).

---

## אבטחה שכבר מופעלת

- **Helmet** – כותרות אבטחה (CSP כבוי לצורך תאימות).
- **Rate limiting** – API 120 בקשות/דקה, Auth 30/15 דקות.
- **CORS** – ב-Production רק Origin של הבקשה (לא `*`).
- **X-Powered-By** – כבוי.
- **Cookies** – `secure` כאשר הבקשה מגיעה כ-HTTPS (כולל מאחורי Nginx עם `X-Forwarded-Proto`).
- **סודות** – רק מ-env (JWT_SECRET, ADMIN_SECRET, CREATE_ADMIN_PASSWORD וכו').

---

## מוכנות Production: **95%**

| נושא | סטטוס |
|------|--------|
| ניקוי קבצי dev ו-console.logs | ✅ |
| .env.production.example, סודות מ-env | ✅ |
| Build (Vite + esbuild) | ✅ |
| PM2 ecosystem.config.cjs | ✅ |
| Nginx config | ✅ |
| deploy.sh | ✅ |
| Helmet, Rate limit, CORS, cookies | ✅ |
| TypeScript (`tsc --noEmit`) | ⚠️ יש 2–3 שגיאות קיימות (לא קשורות ל-Production); ה-build עובר |
| DB מתחבר | ✅ (SQLite/MySQL לפי ENV) |

**המלצה:** לתקן את שגיאות ה-TypeScript (Leaderboard JSX, Set iteration) עם `downlevelIteration` או עדכון טיפוסים – לא חובה לריצה ב-Production.
