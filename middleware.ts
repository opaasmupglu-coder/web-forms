import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, appPasswordSet, cookieValue } from "@/lib/auth";

// Only the admin area is gated. Public form pages (/f/[slug]), the
// public submit API, the login page and the auth route stay open so
// registrants never need a password. The admin lives at /form-admin;
// /api/admin/* is the internal admin API, not a page.
export const config = {
  matcher: ["/form-admin/:path*", "/api/admin/:path*"],
};

export async function middleware(req: NextRequest) {
  if (!appPasswordSet()) return NextResponse.next();
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie === (await cookieValue())) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}
