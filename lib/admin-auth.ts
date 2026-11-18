// Server-side admin gate for API routes. The admin cookie is the
// SHA-256 of the stored APP_PASSWORD_HASH (see lib/auth.ts); the actual
// password check happens only in the login route.
import { cookies } from "next/headers";
import { AUTH_COOKIE, cookieValue } from "./auth";

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const cookie = store.get(AUTH_COOKIE)?.value;
  if (!cookie) return false;
  return cookie === (await cookieValue());
}

export function unauthorized(): Response {
  return Response.json({ error: "Sign in required." }, { status: 401 });
}
