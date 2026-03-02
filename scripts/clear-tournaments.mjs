/**
 * מנקה את כל התחרויות והנתונים הקשורים מהמסד (SQLite).
 * אחרי הרצה – דף הבית יראה "אין תחרויות", והמצב נשמר (אין seed בהפעלת השרת).
 * הרצה: node scripts/clear-tournaments.mjs (מתוך שורש הפרויקט)
 */
import Database from "better-sqlite3";
import { join } from "path";
import { existsSync } from "fs";

const dataDir = join(process.cwd(), "data");
const dbPath = join(dataDir, "worldcup.db");

if (!existsSync(dbPath)) {
  console.log("לא נמצא קובץ DB:", dbPath);
  process.exit(0);
}

const db = new Database(dbPath);

try {
  // מחיקה בסדר הנכון בגלל תלויות (לא משאירים רשומות יתומות)
  db.exec("DELETE FROM agent_commissions");
  db.exec("DELETE FROM submissions");
  db.exec("DELETE FROM chance_draw_results");
  db.exec("DELETE FROM lotto_draw_results");
  db.exec("DELETE FROM tournaments");

  const n = db.prepare("SELECT COUNT(*) as c FROM tournaments").get();
  console.log("נוקה. מספר תחרויות כעת:", n.c);
} finally {
  db.close();
}
