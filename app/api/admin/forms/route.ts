// Admin: forms. GET the list (with counts), POST a new form.
import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { createForm, listForms } from "@/lib/db";

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  try {
    return NextResponse.json({ forms: await listForms() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load forms." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  let body: { title?: string; description?: string; successMessage?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const form = await createForm({
      title: String(body.title ?? ""),
      description: String(body.description ?? ""),
      successMessage: String(body.successMessage ?? ""),
    });
    return NextResponse.json({ form }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create the form." },
      { status: 400 }
    );
  }
}
