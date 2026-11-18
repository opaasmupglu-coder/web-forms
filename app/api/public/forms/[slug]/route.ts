// Public form definition for registrants. No login required.
import { NextResponse } from "next/server";
import { getPublicForm } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const form = await getPublicForm(slug);
    if (!form) {
      return NextResponse.json({ error: "Form not found or closed." }, { status: 404 });
    }
    return NextResponse.json({ form });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load the form." },
      { status: 500 }
    );
  }
}
