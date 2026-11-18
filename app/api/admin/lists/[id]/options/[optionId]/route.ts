// Admin: one list option. PATCH { label } to rename, { direction: -1|1 }
// to move it, DELETE to remove it.
import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { deleteListOption, moveListOption, updateListOption } from "@/lib/db";

type Ctx = { params: Promise<{ id: string; optionId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const { optionId } = await params;
  let body: { label?: string; direction?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    if (body.direction === -1 || body.direction === 1) {
      await moveListOption(Number(optionId), body.direction);
    } else if (body.label !== undefined) {
      await updateListOption(Number(optionId), String(body.label));
    } else {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update the option." },
      { status: 400 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const { optionId } = await params;
  try {
    await deleteListOption(Number(optionId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not delete the option." },
      { status: 400 }
    );
  }
}
