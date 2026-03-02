/**
 * גיבוי קובץ SQLite (data/worldcup.db) לתיקיית backups עם חותמת זמן.
 * להרצה: pnpm exec tsx scripts/backup-db.ts
 */
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const dataDir = join(process.cwd(), "data");
const backupDir = join(process.cwd(), "backups");
const dbPath = join(dataDir, "worldcup.db");

function main() {
  if (!existsSync(dbPath)) {
    console.error("Database file not found:", dbPath);
    process.exit(1);
  }
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = join(backupDir, `worldcup_${stamp}.db`);
  copyFileSync(dbPath, dest);
  console.log("Backup created:", dest);
}

main();
