// Public submission endpoint. No login required — but the server
// re-validates required fields, emails, and dropdown choices.
import { NextResponse } from "next/server";
import { submitForm } from "@/lib/db";

export async function POST(req: Request) {
  let body: { formId?: number; values?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const formId = Number(body.formId);
  if (!formId || typeof body.values !== "object" || body.values === null) {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }
  try {
    const id = await submitForm(formId, body.values);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save your response." },
      { status: 400 }
    );
  }
}
