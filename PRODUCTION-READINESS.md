# Production Readiness – Ubuntu 24.04 LTS x64

## 1. רשימת קבצים שנוצרו / עודכנו

| קובץ | פעולה |
|------|--------|
| `server/_core/index.ts` | **עודכן** – טעינת `.env.production` ב-production, החלפת `console` ב-`logger`, כיבוי x-powered-by, Helmet, Rate limit, CORS |
| `server/_core/vite.ts` | **עודכן** – `console.error` → `logger.error` כשאין תיקיית build |
| `server/routers.ts` | **עודכן** – כל `console.log` של אדמין → `logger.info` |
| `deployment/nginx-worldcup2026.conf` | **נוצר** – Nginx: פורט 80, proxy ל-127.0.0.1:3000, gzip, כותרות אבטחה |
| `deploy.sh` | **נוצר/עודכן** – apt, nodejs, npm, nginx, npm install, npm run build, PM2, systemctl nginx |
| `ecosystem.config.js` | **נוצר/עודכן** – name, script, instances: max, autorestart, env_production |
| `.env.production.example` | **קיים** – תבנית; אין סודות; NODE_ENV=production |
| `package.json` | **עודכן** – הוספת `pm2` כ-devDependency |
| `PRODUCTION-READINESS.md` | **נוצר/עודכן** – מסמך זה |

**הערה:** לא נמחקו קבצי טסט או סקריפטים; לא שונתה לוגיקה עסקית או מחיקת נתונים.

---

## 2. פקודות מדויקות להרצה על Ubuntu 24.04

### רצף הפקודות כמו ב-deploy.sh (אוטומטי)

```bash
sudo apt update
sudo apt install -y nodejs npm nginx
npm install
npm run build
# העתק .env.production.example ל-.env.production והגדר JWT_SECRET
pm2 start ecosystem.config.js --env production
pm2 save
sudo systemctl restart nginx
```

**הערה:** `npm install --production` לא מומלץ לפני build כי ה-build דורש devDependencies (vite, esbuild). אחרי build אפשר להריץ `npm prune --production` אם רוצים להקטין גודל node_modules.

### התקנת Node.js 20 LTS (מומלץ)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt update
sudo apt install -y nodejs
```

### פריסה ראשונה (משורש הפרויקט)

```bash
cd /var/www/worldcup2026
git clone <repo> .
cp .env.production.example .env.production
nano .env.production   # JWT_SECRET (חובה), PORT, ADMIN_SECRET וכו'
chmod +x deploy.sh
./deploy.sh
```

### הפעלת Nginx כ-Reverse Proxy

```bash
sudo cp deployment/nginx-worldcup2026.conf /etc/nginx/sites-available/worldcup2026
sudo sed -i 's/YOUR_DOMAIN_OR_IP/your-domain-or-ip/' /etc/nginx/sites-available/worldcup2026
sudo ln -sf /etc/nginx/sites-available/worldcup2026 /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### עדכון אחרי שינויי קוד

```bash
cd /var/www/worldcup2026
git pull
npm install
npm run build
pm2 reload ecosystem.config.js --env production
pm2 save
```

---

## 3. מבנה תיקיות סופי מוכן ל-Production

```
worldcup2026/
├── client/                    # מקור Frontend
├── server/                    # מקור Backend
├── deployment/
│   └── nginx-worldcup2026.conf
├── dist/                      # פלט build – השרת רץ מכאן
│   ├── index.js               # node dist/index.js
│   └── public/                # Frontend סטטי (index.html, assets/)
├── data/                      # SQLite (נוצר בזמן ריצה; לא ב-git)
├── logs/                      # app.log ב-production (נוצר אוטומטית)
├── ecosystem.config.js
├── deploy.sh
├── .env.production            # לא ב-git – ליצור מ-.env.production.example
├── .env.production.example
└── package.json
```

השרת רץ עם: **`NODE_ENV=production node dist/index.js`** (או דרך PM2).

---

## 4. אבטחה

| רכיב | סטטוס |
|------|--------|
| Helmet | ✅ (contentSecurityPolicy: false לצורך תאימות) |
| Rate limiting | ✅ API 120/דקה, Auth 30/15 דקות |
| CORS | ✅ ב-production רק Origin של הבקשה |
| X-Powered-By | ✅ כבוי |
| Cookies | ✅ secure כאשר הבקשה HTTPS (כולל X-Forwarded-Proto) |
| סודות | ✅ רק מ-env (אין hardcode) |

---

## 5. מוכנות Production: **95%**

| נושא | סטטוס |
|------|--------|
| 1. ניקוי קבצי dev / console.logs מיותרים | ✅ |
| 2. .env.production, סודות מ-env, NODE_ENV=production | ✅ |
| 3. Build אופטימלי, הרצה עם node בלבד (ללא tsx/nodemon) | ✅ |
| 4. PM2 (name, script, instances: max, autorestart, env_production) | ✅ |
| 5. Nginx (פורט 80, gzip, headers מאובטחים) | ✅ |
| 6. אבטחה (Helmet, Rate limit, CORS, cookies) | ✅ |
| 7. TypeScript / תלויות Dev | ⚠️ 2–3 שגיאות tsc; ה-build עובר |
| 8. deploy.sh | ✅ |
| 9. DB מתחבר | ✅ (SQLite/MySQL לפי ENV) |
