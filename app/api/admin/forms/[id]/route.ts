// Admin: one form. GET the full definition, PATCH title/description/
// success message/active, DELETE the form (fields + submissions go too).
import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { deleteForm, getForm, updateForm } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await params;
  try {
    const form = await getForm(Number(id));
    if (!form) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    return NextResponse.json({ form });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load the form." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await params;
  let body: {
    title?: string;
    description?: string;
    successMessage?: string;
    active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    await updateForm(Number(id), {
      title: body.title,
      description: body.description,
      successMessage: body.successMessage,
      active: body.active,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update the form." },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await params;
  try {
    await deleteForm(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not delete the form." },
      { status: 400 }
    );
  }
}
