/**
 * Load env files before any other server code runs.
 * Must be the first import in server/_core/index.ts so BASE_URL, JWT_SECRET, etc.
 * are in process.env before env.ts (and thus OAuth/Auth) are evaluated.
 */
import dotenv from "dotenv";

dotenv.config();
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: ".env.production", override: true });
}
