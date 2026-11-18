// Starter content for a fresh database: the schema, the PGLU Offices
// list, an empty Names list, and one sample Registration form.
// Run with `npm run seed` (reads TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
// from the environment; use TURSO_DATABASE_URL=file:./local.db locally).
// Safe to re-run: it only inserts what is missing.
import { getTurso } from "./turso";
import { ensureSchema } from "./db";
import { slugify } from "./types";

const OFFICES = [
  "Office of the Provincial Governor (OPG)",
  "Office of the Provincial Administrator (OPA)",
  "Sangguniang Panlalawigan Office (SPO)",
  "Provincial Treasurer's Office (PTO)",
  "Provincial Assessor's Office (OPAss)",
  "Provincial Health Office (PHO)",
  "Provincial Social Welfare and Development Office (PSWDO)",
  "Provincial Budget Office (PBO)",
  "Provincial Planning and Development Office (PPDO)",
  "Provincial Agriculturist Office (OPAg)",
  "Provincial Disaster Risk Reduction and Management Office (PDRRMO)",
  "Provincial Human Resource Management and Development Office (PHRMDO)",
  "Provincial Legal Office (PLO)",
  "Provincial Engineering Office (PEO)",
  "Provincial General Services Office (PGSO)",
  "Provincial Environment and Natural Resources Office (PGENRO)",
  "Provincial Veterinary Office (OPVet)",
  "Provincial Library",
  "Provincial Information Office (PIO)",
  "Provincial Tourism Office (LUPTO)",
  "Provincial Information and Communications Technology Office (PICTO)",
  "Provincial Accounting Office (OPAcc)",
  "Bids and Awards Committee Secretariat Division (BACSD)",
  "Local Economic Enterprise and Investment Promotion Office (LEEIPO)",
  "Provincial Cooperative Development Office (PCDO)",
  "Public Employment Service Office (PESO)",
  "Provincial Youth and Sports Development Office (PYESDO)",
  "La Union Provincial Jail (LUPJ)",
  "Social Services Division (SSD)",
  "Bacnotan District Hospital (BDH)",
  "Balaoan District Hospital (BLDH)",
  "Caba District Hospital (CDH)",
  "Naguilian District Hospital (NDH)",
  "Rosario District Hospital (RDH)",
];

export async function seed(): Promise<{ offices: number; forms: number }> {
  const db = getTurso();
  if (!db) throw new Error("No database configured (set TURSO_DATABASE_URL).");
  await ensureSchema();

  let officesSeeded = 0;
  let officesRow = await db.execute({
    sql: "SELECT id FROM option_lists WHERE slug = ?",
    args: ["offices"],
  });
  let officesId: number;
  if (officesRow.rows.length === 0) {
    const res = await db.execute({
      sql: "INSERT INTO option_lists (name, slug) VALUES (?, ?) RETURNING id",
      args: ["Offices", "offices"],
    });
    officesId = Number(res.rows[0].id);
  } else {
    officesId = Number(officesRow.rows[0].id);
  }
  const existing = await db.execute({
    sql: "SELECT value FROM list_options WHERE list_id = ?",
    args: [officesId],
  });
  const have = new Set(existing.rows.map((r) => String(r.value)));
  const maxRes = await db.execute({
    sql: "SELECT COALESCE(MAX(sort_order), -1) AS m FROM list_options WHERE list_id = ?",
    args: [officesId],
  });
  let order = Number(maxRes.rows[0]?.m ?? -1) + 1;
  for (const office of OFFICES) {
    if (have.has(office)) continue;
    await db.execute({
      sql: "INSERT INTO list_options (list_id, label, value, sort_order) VALUES (?, ?, ?, ?)",
      args: [officesId, office, office, order],
    });
    order++;
    officesSeeded++;
  }

  // Names list exists but starts empty — the admin adds people.
  const namesRow = await db.execute({
    sql: "SELECT id FROM option_lists WHERE slug = ?",
    args: ["names"],
  });
  if (namesRow.rows.length === 0) {
    await db.execute({
      sql: "INSERT INTO option_lists (name, slug) VALUES (?, ?)",
      args: ["Names", "names"],
    });
  }

  // Sample Registration form, only when no form exists yet.
  let formsSeeded = 0;
  const formsRow = await db.execute("SELECT COUNT(*) AS n FROM forms");
  if (Number(formsRow.rows[0]?.n ?? 0) === 0) {
    const formRes = await db.execute({
      sql: "INSERT INTO forms (title, slug, description, success_message) VALUES (?, ?, ?, ?) RETURNING id",
      args: [
        "Registration",
        "registration",
        "Register for an event or activity. Pick your office and name from the lists — just start typing to search.",
        "Thank you — your registration has been recorded.",
      ],
    });
    const formId = Number(formRes.rows[0].id);
    const fields: {
      label: string;
      type: string;
      required: number;
      listSlug: string | null;
      placeholder: string;
      help: string;
    }[] = [
      { label: "Office", type: "dropdown", required: 1, listSlug: "offices", placeholder: "Type to search your office…", help: "" },
      { label: "Full Name", type: "dropdown", required: 1, listSlug: "names", placeholder: "Type to search your name…", help: "If your name is not listed, ask the admin to add it." },
      { label: "Position / Designation", type: "text", required: 1, listSlug: null, placeholder: "e.g. Administrative Officer V", help: "" },
      { label: "Contact Number", type: "tel", required: 1, listSlug: null, placeholder: "09XXXXXXXXX", help: "" },
      { label: "Email Address", type: "email", required: 0, listSlug: null, placeholder: "you@example.com", help: "" },
      { label: "Remarks", type: "textarea", required: 0, listSlug: null, placeholder: "Anything else to note…", help: "" },
    ];
    let sort = 0;
    for (const f of fields) {
      let listId: number | null = null;
      if (f.listSlug) {
        const lr = await db.execute({
          sql: "SELECT id FROM option_lists WHERE slug = ?",
          args: [f.listSlug],
        });
        listId = lr.rows.length ? Number(lr.rows[0].id) : null;
      }
      await db.execute({
        sql: `INSERT INTO form_fields (form_id, label, type, required, list_id, options_json, placeholder, help_text, sort_order)
              VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?)`,
        args: [formId, f.label, f.type, f.required, listId, f.placeholder, f.help, sort],
      });
      sort++;
    }
    formsSeeded = 1;
  }

  return { offices: officesSeeded, forms: formsSeeded };
}

export { slugify };
