// Admin sign-in. POST { password } -> sets the auth cookie on success.
// The cookie value is a hash of the stored APP_PASSWORD_HASH, so the
// middleware can check it without ever seeing the password.
import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth-server";
import { AUTH_COOKIE, appPasswordSet, cookieValue } from "@/lib/auth";

export async function POST(req: Request) {
  if (!appPasswordSet()) {
    return NextResponse.json(
      { error: "No admin password is configured (APP_PASSWORD_HASH is missing)." },
      { status: 500 }
    );
  }
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const password = String(body.password ?? "");
  if (!password || !verifyPassword(password)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await cookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
