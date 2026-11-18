// Admin: submissions. GET ?formId= lists that form's responses (newest
// first). DELETE ?id= removes one response.
import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { deleteSubmission, listSubmissions } from "@/lib/db";

export async function GET(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const formId = Number(new URL(req.url).searchParams.get("formId"));
  if (!formId) {
    return NextResponse.json({ error: "formId is required." }, { status: 400 });
  }
  try {
    const { form, submissions } = await listSubmissions(formId);
    if (!form) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    return NextResponse.json({ form, submissions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load submissions." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }
  try {
    await deleteSubmission(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not delete the response." },
      { status: 400 }
    );
  }
}
