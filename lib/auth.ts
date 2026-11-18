// Password-gate helpers safe for the Edge runtime (middleware).
// The gate is driven ONLY by APP_PASSWORD_HASH — never by a plaintext
// password. The cookie is a hash of the stored hash string, so the
// middleware can check it with Web Crypto alone; the actual password
// verification (scrypt) happens in the Node-only login route
// (see lib/auth-server.ts).
export const AUTH_COOKIE = "ip_auth";

export function appPasswordSet(): boolean {
  return !!process.env.APP_PASSWORD_HASH;
}

export async function cookieValue(): Promise<string> {
  const data = new TextEncoder().encode(process.env.APP_PASSWORD_HASH || "");
  const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
