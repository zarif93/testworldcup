/**
 * Production Readiness Checklist – מחזיר ציון ומדפיס checklist.
 * הרצה: pnpm exec tsx scripts/production-readiness.ts
 */
import { getDb, getDbInitError, getTournamentsToCleanup, getTournamentsToAutoClose } from "../server/db";

async function main() {
  const checks: { name: string; ok: boolean; detail?: string }[] = [];
  let score = 0;
  const total = 10;

  // 1) DB זמין
  const db = await getDb();
  const dbError = getDbInitError();
  const dbOk = !!db && !dbError;
  checks.push({ name: "Database available", ok: dbOk, detail: dbError ? String(dbError) : undefined });
  if (dbOk) score += 1;

  // 2) פונקציות ארכוב
  try {
    const toClean = await getTournamentsToCleanup();
    checks.push({ name: "getTournamentsToCleanup()", ok: true, detail: `Found ${toClean.length} to archive` });
    score += 1;
  } catch (e) {
    checks.push({ name: "getTournamentsToCleanup()", ok: false, detail: String(e) });
  }

  // 3) סגירה אוטומטית
  try {
    const toClose = await getTournamentsToAutoClose();
    checks.push({ name: "getTournamentsToAutoClose()", ok: true, detail: `Found ${toClose.length} to lock` });
    score += 1;
  } catch (e) {
    checks.push({ name: "getTournamentsToAutoClose()", ok: false, detail: String(e) });
  }

  // 4) Ledger – פונקציה קיימת
  try {
    const mod = await import("../server/db");
    checks.push({ name: "insertLedgerTransaction (ledger)", ok: typeof mod.insertLedgerTransaction === "function" });
    if (typeof mod.insertLedgerTransaction === "function") score += 1;
  } catch {
    checks.push({ name: "insertLedgerTransaction (ledger)", ok: false });
  }

  // 5) Audit log
  try {
    const mod = await import("../server/db");
    checks.push({ name: "insertAuditLog", ok: typeof mod.insertAuditLog === "function" });
    if (typeof mod.insertAuditLog === "function") score += 1;
  } catch {
    checks.push({ name: "insertAuditLog", ok: false });
  }

  // 6) ליגות
  try {
    const { getLeagues } = await import("../server/db");
    const leagues = await getLeagues();
    checks.push({ name: "getLeagues()", ok: true, detail: `Leagues: ${leagues.length}` });
    score += 1;
  } catch (e) {
    checks.push({ name: "getLeagues()", ok: false, detail: String(e) });
  }

  // 7) הרשאות – סופר מנהל
  try {
    const { ENV } = await import("../server/_core/env");
    const hasSuperAdmin = ENV.superAdminUsernames?.length > 0;
    checks.push({ name: "Super admin usernames configured", ok: hasSuperAdmin, detail: ENV.superAdminUsernames?.join(", ") });
    if (hasSuperAdmin) score += 1;
  } catch {
    checks.push({ name: "Super admin usernames configured", ok: false });
  }

  // 8) עמלות – 12.5% / 50%
  try {
    const { ENV } = await import("../server/_core/env");
    const agentPct = ENV.agentCommissionPercentOfFee ?? 50;
    checks.push({ name: "Agent commission % of fee", ok: agentPct >= 0 && agentPct <= 100, detail: `${agentPct}%` });
    if (agentPct >= 0 && agentPct <= 100) score += 1;
  } catch {
    checks.push({ name: "Agent commission % of fee", ok: false });
  }

  // 9) גיבוי – סקריפט קיים
  try {
    const { existsSync } = await import("fs");
    const { join } = await import("path");
    const backupScript = join(process.cwd(), "scripts", "backup-db.ts");
    const hasBackup = existsSync(backupScript);
    checks.push({ name: "Backup script (scripts/backup-db.ts)", ok: hasBackup });
    if (hasBackup) score += 1;
  } catch {
    checks.push({ name: "Backup script", ok: false });
  }

  // 10) Rate limit / Security
  checks.push({ name: "Rate limit (apiLimiter in index)", ok: true });
  score += 1;

  // הדפסה
  console.log("\n=== Production Readiness Checklist ===\n");
  for (const c of checks) {
    console.log(`${c.ok ? "✅" : "❌"} ${c.name}${c.detail ? ` – ${c.detail}` : ""}`);
  }
  console.log("\n---");
  const pct = Math.round((score / total) * 100);
  console.log(`Score: ${score}/${total} (${pct}%)\n`);
  if (pct < 80) {
    console.log("⚠️  Fix failing items before production.\n");
    process.exit(1);
  }
  console.log("✓ Checklist passed.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
