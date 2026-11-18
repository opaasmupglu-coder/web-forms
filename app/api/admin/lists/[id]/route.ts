// Admin: one option list. PATCH rename, DELETE the list (its options go
// too; form fields that used it fall back to inline options).
import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { deleteOptionList, renameOptionList } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await params;
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    await renameOptionList(Number(id), String(body.name ?? ""));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not rename the list." },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await params;
  try {
    await deleteOptionList(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not delete the list." },
      { status: 400 }
    );
  }
}
