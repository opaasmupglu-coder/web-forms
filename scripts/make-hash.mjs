// Generate the APP_PASSWORD_HASH for Vercel from an admin password.
// Usage:  ADMIN_PASSWORD='your-password' node scripts/make-hash.mjs
// Prints only the hash — paste it into Vercel as APP_PASSWORD_HASH.
// The password itself is never written anywhere.
import { scryptSync, randomBytes } from "node:crypto";

const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error("Set ADMIN_PASSWORD in the environment and re-run.");
  process.exit(1);
}
const salt = randomBytes(16);
const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
console.log(`scrypt:${salt.toString("hex")}:${derived.toString("hex")}`);
