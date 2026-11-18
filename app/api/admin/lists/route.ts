// Admin: option lists. GET all lists (with options), POST a new list.
import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { createOptionList, listOptionLists } from "@/lib/db";

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  try {
    return NextResponse.json({ lists: await listOptionLists() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load lists." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const list = await createOptionList(String(body.name ?? ""));
    return NextResponse.json({ list }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create the list." },
      { status: 400 }
    );
  }
}
