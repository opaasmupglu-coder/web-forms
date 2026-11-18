// Admin: add a field to a form. POST the field definition.
import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { addFormField } from "@/lib/db";
import type { FieldType } from "@/lib/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await params;
  let body: {
    label?: string;
    type?: string;
    required?: boolean;
    listId?: number | null;
    options?: string[];
    placeholder?: string;
    helpText?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const field = await addFormField(Number(id), {
      label: String(body.label ?? ""),
      type: (body.type ?? "text") as FieldType,
      required: !!body.required,
      listId: body.listId ?? null,
      options: Array.isArray(body.options) ? body.options.map(String) : [],
      placeholder: String(body.placeholder ?? ""),
      helpText: String(body.helpText ?? ""),
    });
    return NextResponse.json({ field }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not add the field." },
      { status: 400 }
    );
  }
}
