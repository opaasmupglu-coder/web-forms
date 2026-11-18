// Admin: one form field. PATCH to edit it (or { direction: -1|1 } to move
// it), DELETE to remove it.
import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { deleteFormField, moveFormField, updateFormField } from "@/lib/db";
import type { FieldType } from "@/lib/types";

type Ctx = { params: Promise<{ id: string; fieldId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const { fieldId } = await params;
  let body: {
    label?: string;
    type?: string;
    required?: boolean;
    listId?: number | null;
    options?: string[];
    placeholder?: string;
    helpText?: string;
    direction?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    if (body.direction === -1 || body.direction === 1) {
      await moveFormField(Number(fieldId), body.direction);
    } else {
      await updateFormField(Number(fieldId), {
        label: body.label,
        type: body.type as FieldType | undefined,
        required: body.required,
        listId: body.listId,
        options: Array.isArray(body.options) ? body.options.map(String) : undefined,
        placeholder: body.placeholder,
        helpText: body.helpText,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update the field." },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const { fieldId } = await params;
  try {
    await deleteFormField(Number(fieldId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not delete the field." },
      { status: 400 }
    );
  }
}
