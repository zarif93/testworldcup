# פריסה ל-Production (Ubuntu / Docker)

## דרישות

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

### 3. קובץ סביבה (אופציונלי)

אם יש לך משתני סביבה (סיסמאות, כתובות וכו'):

```bash
nano .env
```

הוסף שורות כמו:

```
NODE_ENV=production
PORT=3000
SUPER_ADMIN_USERNAMES=Yoven!
```

שמור (Ctrl+O, Enter, Ctrl+X).

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

כדי שהשרת ירוץ ברקע ויפעל אחרי התנתקות, השתמש ב־**pm2**:

```bash
sudo npm install -g pm2
cd ~/testworldcup
pm2 start dist/index.js --name worldcup -- --env NODE_ENV=production
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
pm2 restart worldcup
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
