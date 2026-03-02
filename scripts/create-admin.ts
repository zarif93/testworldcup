/**
 * סקריפט חד-פעמי ליצירת משתמש סופר מנהל (Yoven!)
 * סופר מנהל הוא היחיד שיכול ליצור/למחוק/לערוך מנהלים אחרים.
 * הרצה: pnpm tsx scripts/create-admin.ts
 */
import { hashPassword } from "../server/auth";
import { createAdminUser, getUserByUsername, updateUserRole } from "../server/db";

const ADMIN_USERNAME = "Yoven!";
const ADMIN_PASSWORD = "Adir8043120";
const ADMIN_PHONE = "0500000000";

async function main() {
  try {
    const existing = await getUserByUsername(ADMIN_USERNAME);
    if (existing) {
      await updateUserRole(existing.id, "admin");
      console.log(`משתמש "${ADMIN_USERNAME}" כבר קיים – עודכן לתפקיד מנהל.`);
      return;
    }

    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    await createAdminUser({
      username: ADMIN_USERNAME,
      phone: ADMIN_PHONE,
      passwordHash,
      name: "מנהל",
    });

    console.log("משתמש המנהל נוצר בהצלחה.");
    console.log("  שם משתמש:", ADMIN_USERNAME);
    console.log("  סיסמה:", ADMIN_PASSWORD);
  } catch (err) {
    console.error("שגיאה:", err);
    process.exit(1);
  }
  process.exit(0);
}

main();
