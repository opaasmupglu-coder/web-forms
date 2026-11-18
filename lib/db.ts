// Turso reads/writes for the form system.
// Tables are created on first use (ensureSchema is idempotent and runs
// at most once per process), so a fresh Turso database works with no
// manual setup — the seed script only adds starter content.
import { getTurso, missingEnv } from "./turso";
import type {
  FieldType,
  FormDef,
  FormField,
  FormSummary,
  OptionItem,
  OptionList,
  PublicForm,
  Submission,
} from "./types";
import { slugify } from "./types";

let schemaEnsured = false;

const DDL = [
  `CREATE TABLE IF NOT EXISTS option_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS list_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    success_message TEXT NOT NULL DEFAULT 'Thank you — your response has been recorded.',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS form_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL,
    required INTEGER NOT NULL DEFAULT 0,
    list_id INTEGER,
    options_json TEXT NOT NULL DEFAULT '[]',
    placeholder TEXT NOT NULL DEFAULT '',
    help_text TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_list_options_list ON list_options(list_id)`,
  `CREATE INDEX IF NOT EXISTS idx_form_fields_form ON form_fields(form_id)`,
  `CREATE INDEX IF NOT EXISTS idx_submissions_form ON submissions(form_id)`,
];

export async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  const db = getTurso();
  if (!db) return;
  for (const sql of DDL) await db.execute(sql);
  schemaEnsured = true;
}

function requireDb() {
  const db = getTurso();
  if (!db) {
    const missing = missingEnv();
    throw new Error(
      `Database is not connected (missing ${missing.join(", ")}).`
    );
  }
  return db;
}

function parseOptionsJson(raw: unknown): string[] {
  try {
    const v = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- public

/** The form a registrant sees, with dropdown options resolved. Null when
 *  the slug does not exist or the form is inactive. */
export async function getPublicForm(slug: string): Promise<PublicForm | null> {
  const db = getTurso();
  if (!db) return null;
  await ensureSchema();
  const formRes = await db.execute({
    sql: "SELECT id, title, slug, description, success_message, active FROM forms WHERE slug = ?",
    args: [slug],
  });
  if (formRes.rows.length === 0) return null;
  const f = formRes.rows[0];
  if (Number(f.active) !== 1) return null;
  const fieldsRes = await db.execute({
    sql: `SELECT ff.id, ff.form_id, ff.label, ff.type, ff.required, ff.list_id,
                 ff.options_json, ff.placeholder, ff.help_text, ff.sort_order,
                 ol.name AS list_name
          FROM form_fields ff
          LEFT JOIN option_lists ol ON ol.id = ff.list_id
          WHERE ff.form_id = ? ORDER BY ff.sort_order, ff.id`,
    args: [Number(f.id)],
  });
  const fields: PublicForm["fields"] = [];
  for (const r of fieldsRes.rows) {
    let options: { label: string; value: string }[] = [];
    if (r.list_id !== null && r.list_id !== undefined) {
      const optRes = await db.execute({
        sql: "SELECT label, value FROM list_options WHERE list_id = ? ORDER BY sort_order, id",
        args: [Number(r.list_id)],
      });
      options = optRes.rows.map((o) => ({ label: String(o.label), value: String(o.value) }));
    } else {
      options = parseOptionsJson(r.options_json).map((v) => ({ label: v, value: v }));
    }
    fields.push({
      id: Number(r.id),
      formId: Number(r.form_id),
      label: String(r.label),
      type: String(r.type) as FieldType,
      required: Number(r.required) === 1,
      listId: r.list_id === null ? null : Number(r.list_id),
      listName: r.list_name === null ? null : String(r.list_name),
      options,
      placeholder: String(r.placeholder ?? ""),
      helpText: String(r.help_text ?? ""),
      sortOrder: Number(r.sort_order),
    });
  }
  return {
    id: Number(f.id),
    title: String(f.title),
    slug: String(f.slug),
    description: String(f.description ?? ""),
    successMessage: String(f.success_message ?? ""),
    fields,
  };
}

/** Validate and store one public submission. Throws on bad input. */
export async function submitForm(
  formId: number,
  values: Record<string, string>
): Promise<number> {
  const db = requireDb();
  await ensureSchema();
  const formRes = await db.execute({
    sql: "SELECT id, active FROM forms WHERE id = ?",
    args: [formId],
  });
  if (formRes.rows.length === 0) throw new Error("Form not found.");
  if (Number(formRes.rows[0].active) !== 1) throw new Error("This form is closed.");
  const fieldsRes = await db.execute({
    sql: "SELECT id, label, type, required, list_id, options_json FROM form_fields WHERE form_id = ? ORDER BY sort_order, id",
    args: [formId],
  });
  const clean: Record<string, string> = {};
  for (const r of fieldsRes.rows) {
    const key = `field_${Number(r.id)}`;
    const raw = String(values[key] ?? "").trim();
    if (Number(r.required) === 1 && raw === "") {
      throw new Error(`“${String(r.label)}” is required.`);
    }
    if (raw !== "" && String(r.type) === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      throw new Error(`“${String(r.label)}” does not look like an email address.`);
    }
    if (raw !== "" && String(r.type) === "dropdown") {
      // The value must be one of the field's current options.
      let allowed: string[] = [];
      if (r.list_id !== null && r.list_id !== undefined) {
        const optRes = await db.execute({
          sql: "SELECT value FROM list_options WHERE list_id = ?",
          args: [Number(r.list_id)],
        });
        allowed = optRes.rows.map((o) => String(o.value));
      } else {
        allowed = parseOptionsJson(r.options_json);
      }
      if (allowed.length > 0 && !allowed.includes(raw)) {
        throw new Error(`“${String(r.label)}” is not a valid choice.`);
      }
    }
    clean[key] = raw;
  }
  const res = await db.execute({
    sql: "INSERT INTO submissions (form_id, data_json) VALUES (?, ?)",
    args: [formId, JSON.stringify(clean)],
  });
  return Number(res.lastInsertRowid);
}

/** All active forms, for the public index page. */
export async function listActiveForms(): Promise<{ title: string; slug: string; description: string }[]> {
  const db = getTurso();
  if (!db) return [];
  await ensureSchema();
  const res = await db.execute(
    "SELECT title, slug, description FROM forms WHERE active = 1 ORDER BY title"
  );
  return res.rows.map((r) => ({
    title: String(r.title),
    slug: String(r.slug),
    description: String(r.description ?? ""),
  }));
}

// ---------------------------------------------------------------- lists

export async function listOptionLists(): Promise<OptionList[]> {
  const db = requireDb();
  await ensureSchema();
  const listsRes = await db.execute("SELECT id, name, slug FROM option_lists ORDER BY name");
  const out: OptionList[] = [];
  for (const l of listsRes.rows) {
    const optsRes = await db.execute({
      sql: "SELECT id, label, value, sort_order FROM list_options WHERE list_id = ? ORDER BY sort_order, id",
      args: [Number(l.id)],
    });
    out.push({
      id: Number(l.id),
      name: String(l.name),
      slug: String(l.slug),
      options: optsRes.rows.map((o) => ({
        id: Number(o.id),
        label: String(o.label),
        value: String(o.value),
        sortOrder: Number(o.sort_order),
      })),
    });
  }
  return out;
}

export async function createOptionList(name: string): Promise<OptionList> {
  const db = requireDb();
  await ensureSchema();
  const clean = name.trim();
  if (!clean) throw new Error("List name is required.");
  const slug = slugify(clean);
  if (!slug) throw new Error("List name must contain letters or numbers.");
  const res = await db.execute({
    sql: "INSERT INTO option_lists (name, slug) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING RETURNING id",
    args: [clean, slug],
  });
  if (res.rows.length === 0) throw new Error(`A list named “${clean}” already exists.`);
  return { id: Number(res.rows[0].id), name: clean, slug, options: [] };
}

export async function renameOptionList(id: number, name: string): Promise<void> {
  const db = requireDb();
  const clean = name.trim();
  if (!clean) throw new Error("List name is required.");
  await db.execute({ sql: "UPDATE option_lists SET name = ? WHERE id = ?", args: [clean, id] });
}

export async function deleteOptionList(id: number): Promise<void> {
  const db = requireDb();
  // Fields pointing at this list fall back to their inline options.
  await db.execute({ sql: "UPDATE form_fields SET list_id = NULL WHERE list_id = ?", args: [id] });
  await db.execute({ sql: "DELETE FROM list_options WHERE list_id = ?", args: [id] });
  await db.execute({ sql: "DELETE FROM option_lists WHERE id = ?", args: [id] });
}

export async function addListOptions(listId: number, labels: string[]): Promise<OptionItem[]> {
  const db = requireDb();
  const clean = labels.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return [];
  const maxRes = await db.execute({
    sql: "SELECT COALESCE(MAX(sort_order), -1) AS m FROM list_options WHERE list_id = ?",
    args: [listId],
  });
  let order = Number(maxRes.rows[0]?.m ?? -1) + 1;
  const added: OptionItem[] = [];
  for (const label of clean) {
    const res = await db.execute({
      sql: "INSERT INTO list_options (list_id, label, value, sort_order) VALUES (?, ?, ?, ?) RETURNING id",
      args: [listId, label, label, order],
    });
    added.push({ id: Number(res.rows[0].id), label, value: label, sortOrder: order });
    order++;
  }
  return added;
}

export async function updateListOption(id: number, label: string): Promise<void> {
  const db = requireDb();
  const clean = label.trim();
  if (!clean) throw new Error("Option text is required.");
  await db.execute({
    sql: "UPDATE list_options SET label = ?, value = ? WHERE id = ?",
    args: [clean, clean, id],
  });
}

export async function deleteListOption(id: number): Promise<void> {
  const db = requireDb();
  await db.execute({ sql: "DELETE FROM list_options WHERE id = ?", args: [id] });
}

export async function moveListOption(id: number, direction: -1 | 1): Promise<void> {
  const db = requireDb();
  const cur = await db.execute({
    sql: "SELECT list_id, sort_order FROM list_options WHERE id = ?",
    args: [id],
  });
  if (cur.rows.length === 0) return;
  const listId = Number(cur.rows[0].list_id);
  const order = Number(cur.rows[0].sort_order);
  const neighbor = await db.execute({
    sql:
      direction === -1
        ? "SELECT id, sort_order FROM list_options WHERE list_id = ? AND sort_order < ? ORDER BY sort_order DESC LIMIT 1"
        : "SELECT id, sort_order FROM list_options WHERE list_id = ? AND sort_order > ? ORDER BY sort_order ASC LIMIT 1",
    args: [listId, order],
  });
  if (neighbor.rows.length === 0) return;
  const nid = Number(neighbor.rows[0].id);
  const norder = Number(neighbor.rows[0].sort_order);
  await db.execute({ sql: "UPDATE list_options SET sort_order = ? WHERE id = ?", args: [norder, id] });
  await db.execute({ sql: "UPDATE list_options SET sort_order = ? WHERE id = ?", args: [order, nid] });
}

// ---------------------------------------------------------------- forms

export async function listForms(): Promise<FormSummary[]> {
  const db = requireDb();
  await ensureSchema();
  const res = await db.execute(
    "SELECT id, title, slug, description, active FROM forms ORDER BY title"
  );
  const out: FormSummary[] = [];
  for (const r of res.rows) {
    const fc = await db.execute({
      sql: "SELECT COUNT(*) AS n FROM form_fields WHERE form_id = ?",
      args: [Number(r.id)],
    });
    const sc = await db.execute({
      sql: "SELECT COUNT(*) AS n FROM submissions WHERE form_id = ?",
      args: [Number(r.id)],
    });
    out.push({
      id: Number(r.id),
      title: String(r.title),
      slug: String(r.slug),
      description: String(r.description ?? ""),
      active: Number(r.active) === 1,
      fieldCount: Number(fc.rows[0]?.n ?? 0),
      submissionCount: Number(sc.rows[0]?.n ?? 0),
    });
  }
  return out;
}

export async function getForm(id: number): Promise<FormDef | null> {
  const db = requireDb();
  await ensureSchema();
  const res = await db.execute({
    sql: "SELECT id, title, slug, description, success_message, active FROM forms WHERE id = ?",
    args: [id],
  });
  if (res.rows.length === 0) return null;
  const f = res.rows[0];
  const fieldsRes = await db.execute({
    sql: `SELECT ff.id, ff.form_id, ff.label, ff.type, ff.required, ff.list_id,
                 ff.options_json, ff.placeholder, ff.help_text, ff.sort_order,
                 ol.name AS list_name
          FROM form_fields ff
          LEFT JOIN option_lists ol ON ol.id = ff.list_id
          WHERE ff.form_id = ? ORDER BY ff.sort_order, ff.id`,
    args: [id],
  });
  return {
    id: Number(f.id),
    title: String(f.title),
    slug: String(f.slug),
    description: String(f.description ?? ""),
    successMessage: String(f.success_message ?? ""),
    active: Number(f.active) === 1,
    fields: fieldsRes.rows.map((r) => ({
      id: Number(r.id),
      formId: Number(r.form_id),
      label: String(r.label),
      type: String(r.type) as FieldType,
      required: Number(r.required) === 1,
      listId: r.list_id === null ? null : Number(r.list_id),
      listName: r.list_name === null ? null : String(r.list_name),
      options: parseOptionsJson(r.options_json),
      placeholder: String(r.placeholder ?? ""),
      helpText: String(r.help_text ?? ""),
      sortOrder: Number(r.sort_order),
    })),
  };
}

export async function createForm(input: {
  title: string;
  description?: string;
  successMessage?: string;
}): Promise<FormDef> {
  const db = requireDb();
  await ensureSchema();
  const title = input.title.trim();
  if (!title) throw new Error("Form title is required.");
  const slug = slugify(title);
  if (!slug) throw new Error("Form title must contain letters or numbers.");
  const res = await db.execute({
    sql: "INSERT INTO forms (title, slug, description, success_message) VALUES (?, ?, ?, ?) ON CONFLICT(slug) DO NOTHING RETURNING id",
    args: [title, slug, input.description?.trim() ?? "", input.successMessage?.trim() || "Thank you — your response has been recorded."],
  });
  if (res.rows.length === 0) throw new Error(`A form titled “${title}” already exists.`);
  const created = await getForm(Number(res.rows[0].id));
  if (!created) throw new Error("Form was created but could not be read back.");
  return created;
}

export async function updateForm(
  id: number,
  input: { title?: string; description?: string; successMessage?: string; active?: boolean }
): Promise<void> {
  const db = requireDb();
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new Error("Form title is required.");
    await db.execute({
      sql: "UPDATE forms SET title = ?, slug = ? WHERE id = ?",
      args: [title, slugify(title), id],
    });
  }
  if (input.description !== undefined) {
    await db.execute({ sql: "UPDATE forms SET description = ? WHERE id = ?", args: [input.description, id] });
  }
  if (input.successMessage !== undefined) {
    await db.execute({ sql: "UPDATE forms SET success_message = ? WHERE id = ?", args: [input.successMessage, id] });
  }
  if (input.active !== undefined) {
    await db.execute({ sql: "UPDATE forms SET active = ? WHERE id = ?", args: [input.active ? 1 : 0, id] });
  }
}

export async function deleteForm(id: number): Promise<void> {
  const db = requireDb();
  await db.execute({ sql: "DELETE FROM submissions WHERE form_id = ?", args: [id] });
  await db.execute({ sql: "DELETE FROM form_fields WHERE form_id = ?", args: [id] });
  await db.execute({ sql: "DELETE FROM forms WHERE id = ?", args: [id] });
}

export async function addFormField(
  formId: number,
  input: {
    label: string;
    type: FieldType;
    required?: boolean;
    listId?: number | null;
    options?: string[];
    placeholder?: string;
    helpText?: string;
  }
): Promise<FormField> {
  const db = requireDb();
  const label = input.label.trim();
  if (!label) throw new Error("Field label is required.");
  const maxRes = await db.execute({
    sql: "SELECT COALESCE(MAX(sort_order), -1) AS m FROM form_fields WHERE form_id = ?",
    args: [formId],
  });
  const order = Number(maxRes.rows[0]?.m ?? -1) + 1;
  const res = await db.execute({
    sql: `INSERT INTO form_fields (form_id, label, type, required, list_id, options_json, placeholder, help_text, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      formId,
      label,
      input.type,
      input.required ? 1 : 0,
      input.listId ?? null,
      JSON.stringify((input.options ?? []).map((s) => s.trim()).filter(Boolean)),
      input.placeholder?.trim() ?? "",
      input.helpText?.trim() ?? "",
      order,
    ],
  });
  const created = await db.execute({
    sql: `SELECT ff.id, ff.form_id, ff.label, ff.type, ff.required, ff.list_id,
                 ff.options_json, ff.placeholder, ff.help_text, ff.sort_order,
                 ol.name AS list_name
          FROM form_fields ff LEFT JOIN option_lists ol ON ol.id = ff.list_id WHERE ff.id = ?`,
    args: [Number(res.rows[0].id)],
  });
  const r = created.rows[0];
  return {
    id: Number(r.id),
    formId: Number(r.form_id),
    label: String(r.label),
    type: String(r.type) as FieldType,
    required: Number(r.required) === 1,
    listId: r.list_id === null ? null : Number(r.list_id),
    listName: r.list_name === null ? null : String(r.list_name),
    options: parseOptionsJson(r.options_json),
    placeholder: String(r.placeholder ?? ""),
    helpText: String(r.help_text ?? ""),
    sortOrder: Number(r.sort_order),
  };
}

export async function updateFormField(
  id: number,
  input: {
    label?: string;
    type?: FieldType;
    required?: boolean;
    listId?: number | null;
    options?: string[];
    placeholder?: string;
    helpText?: string;
  }
): Promise<void> {
  const db = requireDb();
  if (input.label !== undefined) {
    const label = input.label.trim();
    if (!label) throw new Error("Field label is required.");
    await db.execute({ sql: "UPDATE form_fields SET label = ? WHERE id = ?", args: [label, id] });
  }
  if (input.type !== undefined) {
    await db.execute({ sql: "UPDATE form_fields SET type = ? WHERE id = ?", args: [input.type, id] });
  }
  if (input.required !== undefined) {
    await db.execute({ sql: "UPDATE form_fields SET required = ? WHERE id = ?", args: [input.required ? 1 : 0, id] });
  }
  if (input.listId !== undefined) {
    await db.execute({ sql: "UPDATE form_fields SET list_id = ? WHERE id = ?", args: [input.listId, id] });
  }
  if (input.options !== undefined) {
    await db.execute({
      sql: "UPDATE form_fields SET options_json = ? WHERE id = ?",
      args: [JSON.stringify(input.options.map((s) => s.trim()).filter(Boolean)), id],
    });
  }
  if (input.placeholder !== undefined) {
    await db.execute({ sql: "UPDATE form_fields SET placeholder = ? WHERE id = ?", args: [input.placeholder, id] });
  }
  if (input.helpText !== undefined) {
    await db.execute({ sql: "UPDATE form_fields SET help_text = ? WHERE id = ?", args: [input.helpText, id] });
  }
}

export async function deleteFormField(id: number): Promise<void> {
  const db = requireDb();
  await db.execute({ sql: "DELETE FROM form_fields WHERE id = ?", args: [id] });
}

export async function moveFormField(id: number, direction: -1 | 1): Promise<void> {
  const db = requireDb();
  const cur = await db.execute({
    sql: "SELECT form_id, sort_order FROM form_fields WHERE id = ?",
    args: [id],
  });
  if (cur.rows.length === 0) return;
  const formId = Number(cur.rows[0].form_id);
  const order = Number(cur.rows[0].sort_order);
  const neighbor = await db.execute({
    sql:
      direction === -1
        ? "SELECT id, sort_order FROM form_fields WHERE form_id = ? AND sort_order < ? ORDER BY sort_order DESC LIMIT 1"
        : "SELECT id, sort_order FROM form_fields WHERE form_id = ? AND sort_order > ? ORDER BY sort_order ASC LIMIT 1",
    args: [formId, order],
  });
  if (neighbor.rows.length === 0) return;
  const nid = Number(neighbor.rows[0].id);
  const norder = Number(neighbor.rows[0].sort_order);
  await db.execute({ sql: "UPDATE form_fields SET sort_order = ? WHERE id = ?", args: [norder, id] });
  await db.execute({ sql: "UPDATE form_fields SET sort_order = ? WHERE id = ?", args: [order, nid] });
}

// ---------------------------------------------------------------- submissions

export async function listSubmissions(
  formId: number,
  limit = 200
): Promise<{ submissions: Submission[]; form: FormDef | null }> {
  const db = requireDb();
  await ensureSchema();
  const form = await getForm(formId);
  const res = await db.execute({
    sql: "SELECT id, form_id, data_json, created_at FROM submissions WHERE form_id = ? ORDER BY id DESC LIMIT ?",
    args: [formId, limit],
  });
  return {
    form,
    submissions: res.rows.map((r) => ({
      id: Number(r.id),
      formId: Number(r.form_id),
      data: JSON.parse(String(r.data_json ?? "{}")) as Record<string, string>,
      createdAt: String(r.created_at),
    })),
  };
}

export async function deleteSubmission(id: number): Promise<void> {
  const db = requireDb();
  await db.execute({ sql: "DELETE FROM submissions WHERE id = ?", args: [id] });
}
