/**
 * Run jackpot full purge migration (DELETE rows + DROP tables).
 * Usage: pnpm exec tsx scripts/run-jackpot-decommission-migration.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";

const dbPath = join(process.cwd(), "data", "worldcup.db");
const sqlPath = join(process.cwd(), "drizzle", "migrations", "sqlite-jackpot-decommission.sql");

const sql = readFileSync(sqlPath, "utf-8");
const db = new Database(dbPath);
db.exec(sql);
db.close();
console.log("Jackpot decommission migration applied.");
