// Admin: add options to a list. POST { labels: string[] } — one per line
// from the admin UI, or a single label.
import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { addListOptions } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await params;
  let body: { labels?: string[]; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const labels = Array.isArray(body.labels)
    ? body.labels
    : body.label
      ? [body.label]
      : [];
  try {
    const added = await addListOptions(Number(id), labels.map(String));
    return NextResponse.json({ added }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not add options." },
      { status: 400 }
    );
  }
}
