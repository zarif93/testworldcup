# הרצה מקומית ב‑Windows – הוראות מדויקות

## A. מה נבדק

- **drizzle.config.ts** – דורש `DATABASE_URL`, dialect: `"mysql"`. משמש רק ל־`drizzle-kit` (פקודת `db:push`).
- **package.json** – `"db:push": "drizzle-kit generate && drizzle-kit migrate"`; `"dev": "cross-env NODE_ENV=development tsx watch server/_core/index.ts"`.
- **server/db.ts** – `USE_SQLITE = !process.env.DATABASE_URL`. כש־`DATABASE_URL` **לא** מוגדר: אפליקציה רצה על **SQLite** עם קובץ `./data/worldcup.db`. הסכמה והמיגרציות רצות **בתוך הקוד** ב־`initSqlite()` (CREATE TABLE IF NOT EXISTS + ALTER וכו'), **לא** דרך drizzle-kit.
- **server/_core/loadEnv.ts** – טוען `.env` מ־`process.cwd()`. בפרודקשן גם `.env.production`.
- **.env.production.example** – מציין: "Database: leave empty for SQLite (./data/worldcup.db), or set for MySQL".
- **אין** קובץ `.env` או `.env.local` ברשימת הקבצים (ייתכן ש־.gitignore מסתיר).

---

## B. איזה DB הפרויקט משתמש

- **הרצה מקומית בלי `DATABASE_URL`:** הפרויקט משתמש ב־**SQLite** – קובץ `data\worldcup.db` (נוצר אוטומטית בהרצה הראשונה).
- **כש־`DATABASE_URL` מוגדר:** הפרויקט מתחבר ל־**MySQL** והסכמה נדחפת דרך `drizzle-kit` (פקודת `db:push`).

לסביבת טסט מקומית עם כל עדכוני Jackpot (כולל טבלאות ג׳קפוט ו־financial_events) יש להריץ **בלי** `DATABASE_URL` – כלומר SQLite. המיגרציות כבר מוטמעות ב־`server/db.ts` ורצות בעת `getDb()` הראשונה.

---

## C. איזה קובץ env צריך

- קובץ אחד: **`.env`** בתיקיית השורש של הפרויקט (`C:\Users\User\Desktop\testworldcup\.env`).
- **אין** צורך ב־`.env.local` או `.env.development` להרצת dev מקומית; `loadEnv.ts` טוען רק `.env` (ובפרודקשן גם `.env.production`).

---

## D. מה בדיוק לשים ב־env

יצור/עריכה של `C:\Users\User\Desktop\testworldcup\.env` עם התוכן הבא (להרצה מקומית עם SQLite):

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=local-dev-secret-change-in-production
```

- **אל תגדיר** `DATABASE_URL` – כדי שהאפליקציה תשתמש ב־SQLite ב־`data\worldcup.db`.
- אם יש שורה `DATABASE_URL=...` – **מחק או השאר ריק** (או הערה עם `#`).

---

## E. פקודות להרצה מא' עד ת'

הרצה בסביבת **development** (מומלץ לבדיקות):

1. **התקנת תלויות (אם עדיין לא):**
   ```bash
   cd C:\Users\User\Desktop\testworldcup
   npm install
   ```

2. **וידוא ש־.env קיים וללא DATABASE_URL:**
   - קובץ `C:\Users\User\Desktop\testworldcup\.env` עם שלוש השורות מהסעיף D.
   - אם יש `DATABASE_URL` – להסיר.

3. **הרצת שרת פיתוח (ללא db:push):**
   ```bash
   npm run dev
   ```
   - בהרצה הראשונה ייווצר התיק `data` והקובץ `data\worldcup.db`, וכל הטבלאות (כולל site_settings, financial_events וכו') ייווצרו/יעודכנו אוטומטית על ידי `server/db.ts`.
   - בפלט אמור להופיע משהו בדומה ל: `[Database] Using SQLite (./data/worldcup.db)`.
   - שרת ה־API רץ על `http://localhost:3000` (או ה־PORT שמוגדר ב־.env); Vite משרת את הקליינט.

**הערה:** אל תריץ `npm run db:push` לסביבה מקומית עם SQLite. הפקודה מיועדת ל־MySQL ודורשת `DATABASE_URL`; ב־SQLite הסכמה מנוהלת רק מתוך הקוד.

---

הרצה מקומית ב־**production mode** (build + הפעלת ה־server):

1. **הכנה:** כמו למעלה – `.env` עם `JWT_SECRET` וללא `DATABASE_URL`.

2. **Build:**
   ```bash
   cd C:\Users\User\Desktop\testworldcup
   npm run build
   ```
   - אמור להסתיים בלי שגיאות וליצור תיקיית `dist` עם `index.js`.

3. **הרצת שרת production:**
   ```bash
   npm run start
   ```
   - ב־production ה־validateConfig דורש `JWT_SECRET` לא ריק; וודא ש־`.env` (או `.env.production` אם אתה טוען אותו) מכיל `JWT_SECRET` תקין.

4. **DB:** אותו קובץ `data\worldcup.db` – אין צורך ב־db:push. אם זה הרצה ראשונה, הטבלאות ייווצרו בעת הקריאה הראשונה ל־getDb().

---

## F. איך לבדוק שהכול הצליח

1. **וידוא שהמיגרציה/DB רצו:**
   - אחרי הרצת `npm run dev` (או `npm run start`) פעם אחת – וודא שנוצר הקובץ:
     `C:\Users\User\Desktop\testworldcup\data\worldcup.db`

2. **וידוא שטבלאות קיימות:**
   - אם מותקן `sqlite3` (למשל מ־[sqlite.org](https://www.sqlite.org/download.html)):
     ```bash
     cd C:\Users\User\Desktop\testworldcup
     sqlite3 data\worldcup.db ".tables"
     ```
     אמור לכלול בין השאר: `site_settings`, `financial_events`, `tournaments`, `users`.
   - או בדיקה דרך האפליקציה: התחבר כמנהל ונווט להגדרות – אם המסכים נטענים בלי שגיאות DB, הטבלאות קיימות.

3. **וידוא שהאפליקציה רצה על הקוד החדש:**
   - פתח דפדפן ב־`http://localhost:3000`.
   - בדוק מסך ראשי ותחרויות.
   - כמנהל: מרכז כספים, דוחות, ייצוא CSV – וודא שמופיע username בפורמט `username (#id)`.

---

## G. מה לעשות אם DATABASE_URL עדיין לא מזוהה

ההודעה "DATABASE_URL is required to run drizzle commands" מופיעה רק כשמריצים **drizzle-kit** (למשל `npm run db:push`). ב־**הרצת האפליקציה** (dev או start) אין חובה על `DATABASE_URL` – ואם הוא לא מוגדר, הפרויקט עובר אוטומטית ל־SQLite.

- **אם אתה רוצה רק להריץ את האפליקציה מקומית עם SQLite:**
  - אל תריץ `npm run db:push`.
  - השאר את `.env` **בלי** `DATABASE_URL` והרץ `npm run dev` (או `npm run build` ואז `npm run start`). המיגרציות ל־SQLite רצות מתוך `server/db.ts`.

- **אם אתה חייב להריץ `db:push` (למשל לסביבת MySQL):**
  - הוסף ל־`.env` שורת חיבור MySQL, למשל:
    ```env
    DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/DBNAME
    ```
  - אז `npm run db:push` יעבוד, אבל **האפליקציה** תנסה להתחבר ל־MySQL. לסביבת טסט מקומית עם SQLite עדיף לא להגדיר `DATABASE_URL` ולא להריץ `db:push`.

---

## ניקוי cache / build / DB (בטוח)

- **Build ישן:** מחק את התיקייה `dist` והרץ שוב `npm run build`:
  ```bash
  rmdir /s /q dist
  npm run build
  ```
- **Cache של Vite / node_modules:** ניקוי node_modules והתקנה מחדש:
  ```bash
  rmdir /s /q node_modules
  del package-lock.json
  npm install
  ```
- **DB ישן (SQLite):** אם אתה רוצה DB חדש לגמרי (כל הנתונים יימחקו):
  - עצור את השרת.
  - מחק את הקובץ `data\worldcup.db` (או את כל תיקיית `data`).
  - הפעל שוב `npm run dev` – הקובץ והטבלאות ייווצרו מחדש.
