import { hashPassword } from "../server/auth.ts";
import { createUser, getUserByUsername } from "../server/db.ts";

async function seedAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await getUserByUsername("Yoven");
    if (existingAdmin) {
      console.log("Admin user already exists");
      return;
    }

    // Hash the password
    const passwordHash = await hashPassword("Adir8043120");

    // Create admin user
    await createUser({
      username: "Yoven",
      email: "admin@worldcup2026.local",
      passwordHash,
      name: "Admin",
    });

    // Update role to admin in database
    const db = await getDb();
    if (db) {
      await db
        .update(users)
        .set({ role: "admin" })
        .where(eq(users.username, "Yoven"));
    }

    console.log("Admin user created successfully");
  } catch (error) {
    console.error("Failed to seed admin:", error);
    process.exit(1);
  }
}

seedAdmin();
