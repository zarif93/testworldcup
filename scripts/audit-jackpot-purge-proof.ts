/**
 * Deterministic proof: Jackpot purge audit on live SQLite DB.
 * Run: npx tsx scripts/audit-jackpot-purge-proof.ts
 */
import Database from "better-sqlite3";
import { join } from "path";

const dbPath = join(process.cwd(), "data", "worldcup.db");
const db = new Database(dbPath, { readonly: true });

function run<T>(label: string, query: string): T {
  try {
    const stmt = db.prepare(query);
    return stmt.get() as T;
  } catch (e) {
    console.log(`[${label}] Error:`, (e as Error).message);
    throw e;
  }
}

function runAll<T>(label: string, query: string): T[] {
  try {
    return db.prepare(query).all() as T[];
  } catch (e) {
    console.log(`[${label}] Error:`, (e as Error).message);
    throw e;
  }
}

console.log("=== 1. FINANCIAL EVENTS ===\n");
const feJackpot = run<{ "COUNT(*)": number }>(
  "financial_events JACKPOT%",
  "SELECT COUNT(*) FROM financial_events WHERE eventType LIKE 'JACKPOT%'"
);
console.log("SELECT COUNT(*) FROM financial_events WHERE eventType LIKE 'JACKPOT%';");
console.log("Result:", feJackpot["COUNT(*)"]);
const feTotal = run<{ "COUNT(*)": number }>("financial_events total", "SELECT COUNT(*) FROM financial_events");
console.log("Total rows in financial_events:", feTotal["COUNT(*)"]);

console.log("\n=== 2. POINT TRANSACTIONS ===\n");
const ptColumns = runAll<{ name: string }>("pragma pt", "PRAGMA table_info(point_transactions)");
const hasMeta = ptColumns.some((c) => c.name === "metadataJson");
const ptSql = `SELECT COUNT(*) FROM point_transactions 
WHERE description LIKE '%jackpot%' 
   OR actionType LIKE '%jackpot%'${hasMeta ? "\n   OR metadataJson LIKE '%jackpot%'" : ""}`;
console.log(ptSql + ";");
const ptCount = hasMeta
  ? (run<{ c: number }>("point_transactions", "SELECT COUNT(*) as c FROM point_transactions WHERE description LIKE '%jackpot%' OR actionType LIKE '%jackpot%' OR metadataJson LIKE '%jackpot%'")).c
  : (run<{ c: number }>("point_transactions", "SELECT COUNT(*) as c FROM point_transactions WHERE description LIKE '%jackpot%' OR actionType LIKE '%jackpot%'")).c;
console.log("Result:", ptCount);
if (!hasMeta) console.log("(point_transactions has no metadataJson column; omitted from query)");

console.log("\n=== 3. PAYMENT TRANSACTIONS ===\n");
const payColumns = runAll<{ name: string }>("pragma pay", "PRAGMA table_info(payment_transactions)");
const payHasMeta = payColumns.some((c) => c.name === "metadataJson");
const paySql = payHasMeta
  ? "SELECT COUNT(*) as c FROM payment_transactions WHERE type LIKE '%jackpot%' OR metadataJson LIKE '%jackpot%'"
  : "SELECT COUNT(*) as c FROM payment_transactions WHERE type LIKE '%jackpot%'";
console.log(paySql + ";");
const payCount = payHasMeta
  ? (run<{ c: number }>("payment_transactions", "SELECT COUNT(*) as c FROM payment_transactions WHERE type LIKE '%jackpot%' OR metadataJson LIKE '%jackpot%'")).c
  : (run<{ c: number }>("payment_transactions", "SELECT COUNT(*) as c FROM payment_transactions WHERE type LIKE '%jackpot%'")).c;
console.log("Result:", payCount);

console.log("\n=== 4. ANALYTICS EVENTS ===\n");
console.log("SELECT COUNT(*) FROM analytics_events WHERE eventName LIKE '%jackpot%';");
let aeCount = 0;
try {
  const tbl = runAll<{ name: string }>("master", "SELECT name FROM sqlite_master WHERE type='table' AND name='analytics_events'");
  if (tbl.length > 0) {
    aeCount = (run<{ "COUNT(*)": number }>("analytics_events", "SELECT COUNT(*) FROM analytics_events WHERE eventName LIKE '%jackpot%'"))["COUNT(*)"];
  }
} catch {
  aeCount = 0;
}
console.log("Result:", aeCount);

console.log("\n=== 5. SITE SETTINGS ===\n");
console.log("SELECT COUNT(*) FROM site_settings WHERE key LIKE '%jackpot%';");
let ssCount = 0;
try {
  ssCount = (run<{ "COUNT(*)": number }>("site_settings", "SELECT COUNT(*) FROM site_settings WHERE key LIKE '%jackpot%'"))["COUNT(*)"];
} catch {
  ssCount = 0;
}
console.log("Result:", ssCount);

console.log("\n=== 6. TABLES ===\n");
console.log("SELECT name FROM sqlite_master WHERE type='table';");
const tables = runAll<{ name: string }>("tables", "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
const jackpotTables = tables.filter((t) => t.name.startsWith("jackpot_"));
console.log("Tables:", tables.map((t) => t.name).join(", "));
console.log("Tables starting with jackpot_:", jackpotTables.length === 0 ? "NONE" : jackpotTables.map((t) => t.name).join(", "));

console.log("\n=== 7. FOREIGN KEYS ===\n");
console.log("PRAGMA foreign_key_check;");
db.exec("PRAGMA foreign_keys = ON");
const fk = runAll<{ table: string; rowid: number; parent: string; fkid: number }>("fk", "PRAGMA foreign_key_check");
console.log("Result:", fk.length === 0 ? "empty (OK)" : JSON.stringify(fk, null, 2));

db.close();

const allZero =
  feJackpot["COUNT(*)"] === 0 &&
  ptCount === 0 &&
  payCount === 0 &&
  aeCount === 0 &&
  ssCount === 0 &&
  jackpotTables.length === 0 &&
  fk.length === 0;

if (!allZero) {
  process.exit(1);
}
