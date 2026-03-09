/**
 * בדיקת יושרה כספית: סכום כל תנועות הנקודות = יתרות המשתמשים בפועל.
 * אם יש סטייה – מדפיס אזהרה.
 * הרצה: pnpm exec tsx scripts/financial-integrity-check.ts
 */
import "dotenv/config";
import { runFinancialIntegrityCheck } from "../server/db";

async function main() {
  const result = await runFinancialIntegrityCheck();
  console.log("Financial integrity check:", JSON.stringify(result, null, 2));
  if (!result.ok) {
    console.warn("WARNING: סטייה כספית – Net tracked point transactions ≠ System Balance. delta =", result.delta);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
