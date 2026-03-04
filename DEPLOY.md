# פריסה ל-Production (Ubuntu / Docker)

## Ubuntu 24.04 עם PM2 + Nginx (מומלץ)

להרצה על Ubuntu 24.04 LTS x64 עם Node, PM2 ו-Nginx:

1. **העתק את קובץ הסביבה:**  
   `cp .env.production.example .env` וערוך `.env` (חובה: `JWT_SECRET`).

2. **הרץ את סקריפט הפריסה:**  
   `chmod +x deploy.sh && ./deploy.sh`

3. **התקן והפעל Nginx:**  
   העתק את `nginx-worldcup2026.conf` ל־`/etc/nginx/sites-available/`, ערוך `server_name`, enable ו־reload.

פרטים מלאים, פקודות מדויקות ומבנה תיקיות: **ראו [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md)**.

---

## דרישות (Docker)

- **שרת:** Ubuntu 24.04 (או דומה)
- **Docker + Docker Compose** מותקנים
- **Git** (למשיכת הקוד)

---

## התקנה חד-פעמית על השרת

### 1. התקנת Docker (אם עדיין לא מותקן)

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable docker
sudo systemctl start docker
```

### 2. שכפול הפרויקט

```bash
cd ~
git clone https://github.com/zarif93/testworldcup.git
cd testworldcup
```

### 3. קובץ סביבה

**חשוב:** Docker Compose טוען משתנים מקובץ `.env`. אם הקובץ לא קיים, צור אותו:

```bash
touch .env
```

אם יש לך משתני סביבה (סיסמאות, כתובות):

```bash
nano .env
```

הוסף לפחות (מומלץ לפרודקשן):

```
JWT_SECRET=מחרוזת-סודית-אקראית-לחותימות-JWT
```

אופציונלי:

```
NODE_ENV=production
PORT=3000
SUPER_ADMIN_USERNAMES=Yoven!
```

אם **לא** תגדיר `JWT_SECRET`, האתר יעלה אבל יודפס אזהרה – עדכן והפעל מחדש לאבטחה.

---

## הרצה עם Docker (מומלץ)

מהתיקייה `~/testworldcup`:

```bash
cd ~/testworldcup
docker-compose build --no-cache
docker-compose up -d
```

האתר יעלה על **http://כתובת-השרת:3000**

### פקודות שימושיות

| פעולה | פקודה |
|--------|--------|
| לראות לוגים | `docker-compose logs -f` |
| לעצור | `docker-compose down` |
| לעדכן קוד ולהריץ מחדש | `git pull && docker-compose build --no-cache && docker-compose up -d` |

---

## הרצה בלי Docker (Node ישירות)

אם אתה מעדיף להריץ בלי Docker:

```bash
cd ~/testworldcup
git pull
npm install
npm run build
NODE_ENV=production PORT=3000 node dist/index.js
```

כדי שהשרת ירוץ ברקע ויפעל אחרי התנתקות, השתמש ב־**PM2** עם קובץ ה-ecosystem:

```bash
sudo npm install -g pm2
cd ~/testworldcup
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

---

## עדכון האתר אחרי שינויי קוד

### עם Docker

```bash
cd ~/testworldcup
git pull
docker-compose build --no-cache
docker-compose up -d
```

### בלי Docker (עם pm2)

```bash
cd ~/testworldcup
git pull
npm install
npm run build
pm2 reload ecosystem.config.cjs --env production
pm2 save
```

---

## נתונים (SQLite)

- קובץ ה-DB נשמר ב־`./data` (על השרת).
- ב-Docker: התיקייה `./data` ממופה ל־`/app/data` בתוך הקונטיינר – הנתונים נשמרים בין הרצות.

---

## פתרון בעיות

| בעיה | מה לבדוק |
|------|-----------|
| פורט 3000 תפוס | `sudo lsof -i :3000` או שנה ב־docker-compose את הפורט (למשל `3001:3000`) |
| אין הרשאות ל-Docker | `sudo usermod -aG docker $USER` ואז התנתק והתחבר מחדש |
| Build נכשל | וודא ש־`git pull` מעודכן ו־`tailwindcss` ו־`@tailwindcss/vite` ב־dependencies ב־package.json |
| קונטיינר ב־Restarting / האתר לא עולה | הרץ `docker logs worldcup2026-app` ובדוק את השגיאה. אם מופיע JWT_SECRET – הוסף ל־.env והפעל מחדש. אם מופיע Cannot find package – וודא ש־git pull ובנה מחדש. |
| שגיאה על קובץ .env לא קיים | הרץ `touch .env` ואז `docker-compose up -d` שוב. |
