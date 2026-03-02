# הפעלת האתר על שרת (אחרי Clone מ-GitHub)

## דרישות
- **Node.js** גרסה 18 או חדשה (`node -v`)
- **pnpm** (או npm) – אם אין: `npm install -g pnpm`

## שלבים בשרת

### 1. כניסה לתיקיית הפרויקט
```bash
cd /path/to/your-project
```
(החלף ב־path שבו עשית clone)

### 2. התקנת תלויות
```bash
pnpm install
```
אם אין לך pnpm:
```bash
npm install
```

### 3. קובץ .env (חובה בפרודקשן)
הקובץ `.env` לא עולה ל־GitHub. **צור אותו בשרת** בתיקיית הפרויקט:

```bash
nano .env
```

הוסף לפחות:
```
JWT_SECRET=מחרוזת-סודית-אקראית-למשל-מפתח-ארוך
```
אופציונלי (לניהול):
```
ADMIN_SECRET=קוד-סודי-לכניסה-ללוח-הניהול
PORT=3000
```

שמור (ב־nano: Ctrl+O, Enter, Ctrl+X).

### 4. בנייה
```bash
pnpm run build
```
או:
```bash
npm run build
```

### 5. הפעלת האתר
```bash
pnpm start
```
או:
```bash
npm start
```

השרת יעלה על פורט 3000 (או הערך של `PORT` ב־.env).  
גישה: `http://כתובת-השרת:3000`

---

## להרצה ברקע (מומלץ בשרת)

כדי שהאתר ימשיך לרוץ אחרי סגירת הטרמינל, השתמש ב־**pm2**:

```bash
npm install -g pm2
pnpm run build
pm2 start dist/index.js --name worldcup
pm2 save
pm2 startup
```

פקודות שימושיות:
- `pm2 status` – לראות סטטוס
- `pm2 logs worldcup` – לוגים
- `pm2 restart worldcup` – הפעלה מחדש אחרי עדכון קוד

---

## יצירת משתמש מנהל (פעם ראשונה)

ערוך את הקובץ `scripts/create-admin.ts` והגדר:
- `ADMIN_USERNAME` – שם משתמש למנהל
- `ADMIN_PASSWORD` – סיסמה
- `ADMIN_PHONE` – מספר טלפון

אז הרץ:
```bash
pnpm run create-admin
```
(יוצר את מסד הנתונים אם עדיין לא קיים)

---

## עדכון אחרי שינויי קוד מ-GitHub

```bash
git pull
pnpm install
pnpm run build
pm2 restart worldcup
```
