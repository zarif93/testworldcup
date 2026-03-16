/**
 * מוחק את כל תחרויות המונדיאל הפתוחות – אלה שמופיעות בדף הראשי.
 * הרצה: pnpm tsx scripts/delete-open-mondial.ts
 */
import "dotenv/config";
import { getDb, getTournaments, deleteTournament } from "../server/db";

async function main() {
  try {
    const db = await getDb();
    if (!db) {
      console.error("מסד הנתונים לא זמין.");
      process.exit(1);
    }

    const all = await getTournaments();
    const openMondial = all.filter(
      (t) =>
        !t.isLocked &&
        ((t as { type?: string }).type === "football" ||
          (t as { type?: string }).type === undefined ||
          (t as { type?: string }).type === null)
    );

    if (openMondial.length === 0) {
      console.log("אין תחרויות מונדיאל פתוחות למחיקה.");
      process.exit(0);
    }

    console.log(`נמחק ${openMondial.length} תחרויות מונדיאל פתוחות:`);
    for (const t of openMondial) {
      await deleteTournament(t.id);
      console.log(`  נמחק: ${t.name} – ₪${t.amount} (id=${t.id})`);
    }
    console.log("המחיקה הושלמה.");
  } catch (err) {
    console.error("שגיאה:", err);
    process.exit(1);
  }
  process.exit(0);
}

main();
