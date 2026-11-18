// Node-only password verification (scrypt). Imported ONLY by the login
// API route — never by middleware, which runs on the Edge runtime.
// Hash format: scrypt:<saltHex>:<derivedHex>, produced with
// crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
// and a 16-byte random salt. A malformed hash fails closed.
import { scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 } as const;
const DERIVED_LEN = 64;

export function verifyPassword(password: string): boolean {
  const stored = process.env.APP_PASSWORD_HASH;
  if (!stored) return false;
  try {
    const parts = stored.split(":");
    if (parts.length !== 3 || parts[0] !== "scrypt") return false;
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    if (salt.length !== 16 || expected.length !== DERIVED_LEN) return false;
    const derived = scryptSync(password, salt, DERIVED_LEN, SCRYPT_OPTS);
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
