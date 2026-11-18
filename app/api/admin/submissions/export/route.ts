// Admin: export a form's submissions as CSV. GET ?formId=
import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { listSubmissions } from "@/lib/db";

function csvCell(v: string): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const formId = Number(new URL(req.url).searchParams.get("formId"));
  if (!formId) {
    return NextResponse.json({ error: "formId is required." }, { status: 400 });
  }
  try {
    const { form, submissions } = await listSubmissions(formId, 5000);
    if (!form) return NextResponse.json({ error: "Form not found." }, { status: 404 });
    const headers = ["Submitted", ...form.fields.map((f) => f.label)];
    const lines = [headers.map(csvCell).join(",")];
    for (const s of submissions) {
      const row = [
        new Date(s.createdAt + "Z").toISOString().replace("T", " ").slice(0, 19),
        ...form.fields.map((f) => s.data[`field_${f.id}`] ?? ""),
      ];
      lines.push(row.map(csvCell).join(","));
    }
    const csv = lines.join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${form.slug}-submissions.csv"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not export submissions." },
      { status: 500 }
    );
  }
}
