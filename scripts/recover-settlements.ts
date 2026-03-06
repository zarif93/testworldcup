/**
 * Recovery מתחרויות תקועות ב-SETTLING.
 * בודק תחרויות עם status=SETTLING: אם הפרסים כבר חולקו – מעדכן ל-PRIZES_DISTRIBUTED; אחרת מריץ חלוקה.
 * הרצה: pnpm exec tsx scripts/recover-settlements.ts
 * השרת מריץ לוגיקה דומה אוטומטית כל דקה (רק לתחרויות שתקועות מעל 5 דקות).
 */
import "dotenv/config";
import { getTournamentsWithStatusSettling, runRecoverSettlements } from "../server/db";

async function main() {
  const stuck = await getTournamentsWithStatusSettling();
  console.log("תחרויות ב-SETTLING:", stuck.length, stuck.map((r) => r.id));
  if (stuck.length === 0) {
    console.log("אין תחרויות לתקן.");
    process.exit(0);
    return;
  }
  const { recovered, errors } = await runRecoverSettlements();
  console.log("שוחזרו:", recovered.length, recovered);
  if (errors.length > 0) console.error("שגיאות:", errors);
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
