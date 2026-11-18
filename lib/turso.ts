// Turso (libSQL) client. Config comes ONLY from env vars —
// TURSO_DATABASE_URL and TURSO_AUTH_TOKEN. Never hardcode a URL or token.
// For local dev/test use a local file DB: TURSO_DATABASE_URL=file:./local.db
import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

export function tursoUrl(): string | undefined {
  return process.env.TURSO_DATABASE_URL;
}

export function tursoToken(): string | undefined {
  return process.env.TURSO_AUTH_TOKEN;
}

/** Env vars still missing for a usable connection. */
export function missingEnv(): string[] {
  const missing: string[] = [];
  const url = tursoUrl();
  if (!url) missing.push("TURSO_DATABASE_URL");
  else if (!url.startsWith("file:") && !tursoToken()) missing.push("TURSO_AUTH_TOKEN");
  return missing;
}

export function getTurso(): Client | null {
  if (client) return client;
  const url = tursoUrl();
  if (!url) return null;
  if (!url.startsWith("file:") && !tursoToken()) return null;
  client = createClient({ url, authToken: tursoToken() });
  return client;
}
