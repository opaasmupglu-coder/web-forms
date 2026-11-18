"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorState, LoadingState, PageHead, SectionHead } from "@/components/ui";
import type { FieldType, FormDef, FormField, FormSummary, OptionList, Submission } from "@/lib/types";
import { FIELD_TYPES } from "@/lib/types";

type Tab = "forms" | "lists" | "responses";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data as T;
}

function copyText(text: string) {
  if (navigator.clipboard) void navigator.clipboard.writeText(text);
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("forms");
  const [lists, setLists] = useState<OptionList[]>([]);
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Form editor state
  const [editingForm, setEditingForm] = useState<FormDef | null>(null);
  const [newForm, setNewForm] = useState({ title: "", description: "", successMessage: "" });

  // Field editor state
  const [fieldDraft, setFieldDraft] = useState<{
    id: number | null;
    label: string;
    type: FieldType;
    required: boolean;
    listId: number | null;
    optionsText: string;
    placeholder: string;
    helpText: string;
  } | null>(null);

  // Lists state
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newOptionsText, setNewOptionsText] = useState("");
  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
  const [editingOptionLabel, setEditingOptionLabel] = useState("");

  // Responses state
  const [responsesFormId, setResponsesFormId] = useState<number | null>(null);
  const [responsesForm, setResponsesForm] = useState<FormDef | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [l, f] = await Promise.all([
        api<{ lists: OptionList[] }>("/api/admin/lists"),
        api<{ forms: FormSummary[] }>("/api/admin/forms"),
      ]);
      setLists(l.lists);
      setForms(f.forms);
      if (selectedListId === null && l.lists.length > 0) setSelectedListId(l.lists[0].id);
      if (responsesFormId === null && f.forms.length > 0) setResponsesFormId(f.forms[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the admin data.");
    } finally {
      setLoading(false);
    }
  }, [selectedListId, responsesFormId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (responsesFormId === null) return;
    api<{ form: FormDef; submissions: Submission[] }>(
      `/api/admin/submissions?formId=${responsesFormId}`
    )
      .then((d) => {
        setResponsesForm(d.form);
        setSubmissions(d.submissions);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load responses."));
  }, [responsesFormId, tab]);

  const selectedList = useMemo(
    () => lists.find((l) => l.id === selectedListId) ?? null,
    [lists, selectedListId]
  );

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4000);
  }

  async function createForm(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { form } = await api<{ form: FormDef }>("/api/admin/forms", {
        method: "POST",
        body: JSON.stringify(newForm),
      });
      setNewForm({ title: "", description: "", successMessage: "" });
      setForms((f) => [
        ...f,
        { id: form.id, title: form.title, slug: form.slug, description: form.description, active: true, fieldCount: 0, submissionCount: 0 },
      ]);
      setEditingForm(form);
      flash(`Form “${form.title}” created — now add its fields below.`);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not create the form.");
    }
  }

  async function openEditor(id: number) {
    try {
      const { form } = await api<{ form: FormDef }>(`/api/admin/forms/${id}`);
      setEditingForm(form);
      setFieldDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the form.");
    }
  }

  async function saveFormMeta() {
    if (!editingForm) return;
    try {
      await api(`/api/admin/forms/${editingForm.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editingForm.title,
          description: editingForm.description,
          successMessage: editingForm.successMessage,
          active: editingForm.active,
        }),
      });
      setForms((f) =>
        f.map((x) =>
          x.id === editingForm.id
            ? { ...x, title: editingForm.title, slug: x.slug, description: editingForm.description, active: editingForm.active }
            : x
        )
      );
      flash("Form saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the form.");
    }
  }

  async function deleteFormRow(id: number, title: string) {
    if (!window.confirm(`Delete “${title}” and all its fields and responses? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/forms/${id}`, { method: "DELETE" });
      setForms((f) => f.filter((x) => x.id !== id));
      if (editingForm?.id === id) setEditingForm(null);
      flash(`Form “${title}” deleted.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the form.");
    }
  }

  async function toggleFormActive(id: number, active: boolean) {
    try {
      await api(`/api/admin/forms/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      });
      setForms((f) => f.map((x) => (x.id === id ? { ...x, active } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the form.");
    }
  }

  async function saveField() {
    if (!editingForm || !fieldDraft) return;
    const payload = {
      label: fieldDraft.label,
      type: fieldDraft.type,
      required: fieldDraft.required,
      listId: fieldDraft.type === "dropdown" ? fieldDraft.listId : null,
      options:
        fieldDraft.type === "dropdown" && fieldDraft.listId === null
          ? fieldDraft.optionsText.split("\n").map((s) => s.trim()).filter(Boolean)
          : [],
      placeholder: fieldDraft.placeholder,
      helpText: fieldDraft.helpText,
    };
    try {
      if (fieldDraft.id === null) {
        const { field } = await api<{ field: FormField }>(
          `/api/admin/forms/${editingForm.id}/fields`,
          { method: "POST", body: JSON.stringify(payload) }
        );
        setEditingForm({ ...editingForm, fields: [...editingForm.fields, field] });
        setForms((f) => f.map((x) => (x.id === editingForm.id ? { ...x, fieldCount: x.fieldCount + 1 } : x)));
      } else {
        await api(`/api/admin/forms/${editingForm.id}/fields/${fieldDraft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        const { form } = await api<{ form: FormDef }>(`/api/admin/forms/${editingForm.id}`);
        setEditingForm(form);
      }
      setFieldDraft(null);
      flash("Field saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the field.");
    }
  }

  async function deleteField(fieldId: number, label: string) {
    if (!editingForm) return;
    if (!window.confirm(`Remove the “${label}” field?`)) return;
    try {
      await api(`/api/admin/forms/${editingForm.id}/fields/${fieldId}`, { method: "DELETE" });
      setEditingForm({ ...editingForm, fields: editingForm.fields.filter((f) => f.id !== fieldId) });
      setForms((f) => f.map((x) => (x.id === editingForm.id ? { ...x, fieldCount: x.fieldCount - 1 } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the field.");
    }
  }

  async function moveField(fieldId: number, direction: -1 | 1) {
    if (!editingForm) return;
    try {
      await api(`/api/admin/forms/${editingForm.id}/fields/${fieldId}`, {
        method: "PATCH",
        body: JSON.stringify({ direction }),
      });
      const { form } = await api<{ form: FormDef }>(`/api/admin/forms/${editingForm.id}`);
      setEditingForm(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not move the field.");
    }
  }

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { list } = await api<{ list: OptionList }>("/api/admin/lists", {
        method: "POST",
        body: JSON.stringify({ name: newListName }),
      });
      setLists((l) => [...l, list]);
      setSelectedListId(list.id);
      setNewListName("");
      flash(`List “${list.name}” created — add its options below.`);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not create the list.");
    }
  }

  async function deleteList(id: number, name: string) {
    if (!window.confirm(`Delete the “${name}” list and all its options? Fields using it will fall back to their own options.`)) return;
    try {
      await api(`/api/admin/lists/${id}`, { method: "DELETE" });
      setLists((l) => l.filter((x) => x.id !== id));
      if (selectedListId === id) setSelectedListId(null);
      flash(`List “${name}” deleted.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the list.");
    }
  }

  async function addOptions(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedList) return;
    const labels = newOptionsText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (labels.length === 0) return;
    try {
      await api(`/api/admin/lists/${selectedList.id}/options`, {
        method: "POST",
        body: JSON.stringify({ labels }),
      });
      setNewOptionsText("");
      const { lists: fresh } = await api<{ lists: OptionList[] }>("/api/admin/lists");
      setLists(fresh);
      flash(`${labels.length} option${labels.length === 1 ? "" : "s"} added to “${selectedList.name}”.`);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not add options.");
    }
  }

  async function saveOptionLabel(optionId: number) {
    if (!selectedList) return;
    try {
      await api(`/api/admin/lists/${selectedList.id}/options/${optionId}`, {
        method: "PATCH",
        body: JSON.stringify({ label: editingOptionLabel }),
      });
      setEditingOptionId(null);
      const { lists: fresh } = await api<{ lists: OptionList[] }>("/api/admin/lists");
      setLists(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename the option.");
    }
  }

  async function moveOption(optionId: number, direction: -1 | 1) {
    if (!selectedList) return;
    try {
      await api(`/api/admin/lists/${selectedList.id}/options/${optionId}`, {
        method: "PATCH",
        body: JSON.stringify({ direction }),
      });
      const { lists: fresh } = await api<{ lists: OptionList[] }>("/api/admin/lists");
      setLists(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not move the option.");
    }
  }

  async function deleteOption(optionId: number, label: string) {
    if (!selectedList) return;
    if (!window.confirm(`Remove “${label}” from this list?`)) return;
    try {
      await api(`/api/admin/lists/${selectedList.id}/options/${optionId}`, { method: "DELETE" });
      const { lists: fresh } = await api<{ lists: OptionList[] }>("/api/admin/lists");
      setLists(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the option.");
    }
  }

  async function deleteSubmissionRow(id: number) {
    if (!window.confirm("Delete this response?")) return;
    try {
      await api(`/api/admin/submissions?id=${id}`, { method: "DELETE" });
      setSubmissions((s) => s.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the response.");
    }
  }

  if (loading) return <LoadingState what="Loading the admin" />;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <>
      <PageHead
        kicker="PGLU Forms · Admin"
        title="Admin"
        description="Maintain the option lists, build forms, and review responses. Changes here update every form immediately."
      />
      {error && <ErrorState error={error} />}
      {notice && (
        <div className="notice ok" role="status">
          <span className="notice-kicker">Saved</span>
          <p>{notice}</p>
        </div>
      )}

      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        {(["forms", "lists", "responses"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t === "forms" ? "Forms" : t === "lists" ? "Lists (Offices, Names…)" : "Responses"}
          </button>
        ))}
      </div>

      {tab === "forms" && (
        <>
          {!editingForm ? (
            <>
              <section className="section">
                <SectionHead num="01" title="Create a form" />
                <div className="section-body">
                  <form onSubmit={createForm}>
                    <div className="field-row">
                      <div>
                        <label htmlFor="new-form-title">Title</label>
                        <input
                          id="new-form-title"
                          type="text"
                          value={newForm.title}
                          onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
                          placeholder="e.g. Training Registration"
                        />
                      </div>
                      <div>
                        <label htmlFor="new-form-desc">Description (optional)</label>
                        <input
                          id="new-form-desc"
                          type="text"
                          value={newForm.description}
                          onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                          placeholder="One line shown under the title"
                        />
                      </div>
                    </div>
                    <button className="btn" type="submit" disabled={!newForm.title.trim()}>
                      Create form
                    </button>
                  </form>
                </div>
              </section>

              <section className="section">
                <SectionHead num="02" title="Your forms" right={`${forms.length} form${forms.length === 1 ? "" : "s"}`} />
                <div className="section-body">
                  {forms.length === 0 ? (
                    <p className="muted">No forms yet — create your first one above.</p>
                  ) : (
                    <ol className="steps">
                      {forms.map((f, i) => (
                        <li key={f.id}>
                          <span className="step-num" aria-hidden="true">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="step-body">
                            <b>{f.title}</b>
                            <p>
                              {f.fieldCount} field{f.fieldCount === 1 ? "" : "s"} · {f.submissionCount} response
                              {f.submissionCount === 1 ? "" : "s"} ·{" "}
                              {f.active ? "Open" : "Closed"}
                            </p>
                            <p>
                              <code>/f/{f.slug}</code>{" "}
                              <button
                                type="button"
                                className="link-btn"
                                onClick={() => {
                                  copyText(`${origin}/f/${f.slug}`);
                                  flash("Form link copied.");
                                }}
                              >
                                Copy link
                              </button>
                            </p>
                          </span>
                          <span className="step-state">
                            <button type="button" className="btn small" onClick={() => openEditor(f.id)}>
                              Edit
                            </button>{" "}
                            <button
                              type="button"
                              className="btn small secondary"
                              onClick={() => toggleFormActive(f.id, !f.active)}
                            >
                              {f.active ? "Close" : "Open"}
                            </button>{" "}
                            <button
                              type="button"
                              className="btn small secondary"
                              onClick={() => deleteFormRow(f.id, f.title)}
                            >
                              Delete
                            </button>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </section>
            </>
          ) : (
            <>
              <p>
                <button type="button" className="link-btn" onClick={() => setEditingForm(null)}>
                  ← All forms
                </button>
              </p>
              <section className="section">
                <SectionHead num="01" title={`Edit form — ${editingForm.title}`} />
                <div className="section-body">
                  <div className="field-row">
                    <div>
                      <label htmlFor="edit-title">Title</label>
                      <input
                        id="edit-title"
                        type="text"
                        value={editingForm.title}
                        onChange={(e) => setEditingForm({ ...editingForm, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-desc">Description</label>
                      <input
                        id="edit-desc"
                        type="text"
                        value={editingForm.description}
                        onChange={(e) => setEditingForm({ ...editingForm, description: e.target.value })}
                      />
                    </div>
                  </div>
                  <label htmlFor="edit-success">Success message (shown after submitting)</label>
                  <input
                    id="edit-success"
                    type="text"
                    value={editingForm.successMessage}
                    onChange={(e) => setEditingForm({ ...editingForm, successMessage: e.target.value })}
                  />
                  <label className="check-row" style={{ marginTop: 12 }}>
                    <input
                      type="checkbox"
                      checked={editingForm.active}
                      onChange={(e) => setEditingForm({ ...editingForm, active: e.target.checked })}
                    />
                    <span>Open for responses</span>
                  </label>
                  <p>
                    <code>/f/{editingForm.slug}</code>{" "}
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        copyText(`${origin}/f/${editingForm.slug}`);
                        flash("Form link copied.");
                      }}
                    >
                      Copy public link
                    </button>
                  </p>
                  <button className="btn" type="button" onClick={saveFormMeta}>
                    Save form details
                  </button>
                </div>
              </section>

              <section className="section">
                <SectionHead num="02" title="Fields" right={`${editingForm.fields.length} field${editingForm.fields.length === 1 ? "" : "s"}`} />
                <div className="section-body">
                  {editingForm.fields.length === 0 && (
                    <p className="muted">No fields yet — add the first one below.</p>
                  )}
                  <ol className="steps">
                    {editingForm.fields.map((f) => (
                      <li key={f.id}>
                        <span className="step-num" aria-hidden="true">
                          {String(f.sortOrder + 1).padStart(2, "0")}
                        </span>
                        <span className="step-body">
                          <b>
                            {f.label}
                            {f.required && <span className="required-mark"> *</span>}
                          </b>
                          <p>
                            {FIELD_TYPES.find((t) => t.value === f.type)?.label ?? f.type}
                            {f.type === "dropdown" &&
                              (f.listId !== null
                                ? ` · from list “${f.listName ?? ""}”`
                                : f.options.length > 0
                                  ? ` · ${f.options.length} custom option${f.options.length === 1 ? "" : "s"}`
                                  : " · no options yet")}
                            {f.helpText && ` · ${f.helpText}`}
                          </p>
                        </span>
                        <span className="step-state">
                          <button type="button" className="btn small secondary" onClick={() => moveField(f.id, -1)} aria-label="Move up">
                            ↑
                          </button>{" "}
                          <button type="button" className="btn small secondary" onClick={() => moveField(f.id, 1)} aria-label="Move down">
                            ↓
                          </button>{" "}
                          <button
                            type="button"
                            className="btn small"
                            onClick={() =>
                              setFieldDraft({
                                id: f.id,
                                label: f.label,
                                type: f.type,
                                required: f.required,
                                listId: f.listId,
                                optionsText: f.options.join("\n"),
                                placeholder: f.placeholder,
                                helpText: f.helpText,
                              })
                            }
                          >
                            Edit
                          </button>{" "}
                          <button type="button" className="btn small secondary" onClick={() => deleteField(f.id, f.label)}>
                            Delete
                          </button>
                        </span>
                      </li>
                    ))}
                  </ol>

                  {fieldDraft ? (
                    <div className="field-editor">
                      <h3>{fieldDraft.id === null ? "Add a field" : "Edit field"}</h3>
                      <div className="field-row">
                        <div>
                          <label htmlFor="fd-label">Label</label>
                          <input
                            id="fd-label"
                            type="text"
                            value={fieldDraft.label}
                            onChange={(e) => setFieldDraft({ ...fieldDraft, label: e.target.value })}
                            placeholder="e.g. Office"
                          />
                        </div>
                        <div>
                          <label htmlFor="fd-type">Type</label>
                          <select
                            id="fd-type"
                            value={fieldDraft.type}
                            onChange={(e) => setFieldDraft({ ...fieldDraft, type: e.target.value as FieldType })}
                          >
                            {FIELD_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={fieldDraft.required}
                          onChange={(e) => setFieldDraft({ ...fieldDraft, required: e.target.checked })}
                        />
                        <span>Required</span>
                      </label>
                      {fieldDraft.type === "dropdown" && (
                        <>
                          <label htmlFor="fd-list">Options come from</label>
                          <select
                            id="fd-list"
                            value={fieldDraft.listId === null ? "" : String(fieldDraft.listId)}
                            onChange={(e) =>
                              setFieldDraft({ ...fieldDraft, listId: e.target.value === "" ? null : Number(e.target.value) })
                            }
                          >
                            <option value="">Custom options (type them below)</option>
                            {lists.map((l) => (
                              <option key={l.id} value={l.id}>
                                List: {l.name} ({l.options.length} options)
                              </option>
                            ))}
                          </select>
                          {fieldDraft.listId === null && (
                            <>
                              <label htmlFor="fd-options">Custom options (one per line)</label>
                              <textarea
                                id="fd-options"
                                rows={4}
                                value={fieldDraft.optionsText}
                                onChange={(e) => setFieldDraft({ ...fieldDraft, optionsText: e.target.value })}
                                placeholder={"Option one\nOption two"}
                              />
                            </>
                          )}
                          <p className="muted">
                            Lists are maintained under the Lists tab — change a list once and
                            every form using it updates.
                          </p>
                        </>
                      )}
                      <div className="field-row">
                        <div>
                          <label htmlFor="fd-placeholder">Placeholder (optional)</label>
                          <input
                            id="fd-placeholder"
                            type="text"
                            value={fieldDraft.placeholder}
                            onChange={(e) => setFieldDraft({ ...fieldDraft, placeholder: e.target.value })}
                            placeholder="Shown inside the field"
                          />
                        </div>
                        <div>
                          <label htmlFor="fd-help">Help text (optional)</label>
                          <input
                            id="fd-help"
                            type="text"
                            value={fieldDraft.helpText}
                            onChange={(e) => setFieldDraft({ ...fieldDraft, helpText: e.target.value })}
                            placeholder="Shown under the label"
                          />
                        </div>
                      </div>
                      <button className="btn" type="button" onClick={saveField} disabled={!fieldDraft.label.trim()}>
                        {fieldDraft.id === null ? "Add field" : "Save field"}
                      </button>{" "}
                      <button className="btn secondary" type="button" onClick={() => setFieldDraft(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() =>
                        setFieldDraft({
                          id: null,
                          label: "",
                          type: "text",
                          required: false,
                          listId: null,
                          optionsText: "",
                          placeholder: "",
                          helpText: "",
                        })
                      }
                    >
                      + Add a field
                    </button>
                  )}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {tab === "lists" && (
        <>
          <section className="section">
            <SectionHead num="01" title="Option lists" right={`${lists.length} list${lists.length === 1 ? "" : "s"}`} />
            <div className="section-body">
              <p className="muted">
                Lists feed the searchable dropdowns. Edit a list once — every
                form that uses it picks up the change.
              </p>
              <form onSubmit={createList}>
                <div className="field-row">
                  <div>
                    <label htmlFor="new-list-name">New list name</label>
                    <input
                      id="new-list-name"
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="e.g. Venues, Committees…"
                    />
                  </div>
                </div>
                <button className="btn" type="submit" disabled={!newListName.trim()}>
                  Create list
                </button>
              </form>
              {lists.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <label htmlFor="list-picker">Manage list</label>
                  <select
                    id="list-picker"
                    value={selectedListId === null ? "" : String(selectedListId)}
                    onChange={(e) => setSelectedListId(e.target.value === "" ? null : Number(e.target.value))}
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.options.length})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>

          {selectedList && (
            <section className="section">
              <SectionHead
                num="02"
                title={`“${selectedList.name}”`}
                right={`${selectedList.options.length} option${selectedList.options.length === 1 ? "" : "s"}`}
              />
              <div className="section-body">
                <form onSubmit={addOptions}>
                  <label htmlFor="new-options">Add options (one per line — paste a whole list at once)</label>
                  <textarea
                    id="new-options"
                    rows={5}
                    value={newOptionsText}
                    onChange={(e) => setNewOptionsText(e.target.value)}
                    placeholder={"Office one\nOffice two"}
                  />
                  <button className="btn" type="submit" disabled={!newOptionsText.trim()}>
                    Add options
                  </button>{" "}
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => deleteList(selectedList.id, selectedList.name)}
                  >
                    Delete this list
                  </button>
                </form>

                {selectedList.options.length === 0 ? (
                  <p className="muted" style={{ marginTop: 16 }}>
                    No options yet — add the first ones above.
                  </p>
                ) : (
                  <div className="table-wrap" style={{ marginTop: 16 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Option</th>
                          <th>Order</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedList.options.map((o) => (
                          <tr key={o.id}>
                            <td>
                              {editingOptionId === o.id ? (
                                <input
                                  type="text"
                                  value={editingOptionLabel}
                                  onChange={(e) => setEditingOptionLabel(e.target.value)}
                                  onBlur={() => saveOptionLabel(o.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveOptionLabel(o.id);
                                    if (e.key === "Escape") setEditingOptionId(null);
                                  }}
                                  autoFocus
                                />
                              ) : (
                                <button
                                  type="button"
                                  className="link-btn"
                                  onClick={() => {
                                    setEditingOptionId(o.id);
                                    setEditingOptionLabel(o.label);
                                  }}
                                  title="Click to rename"
                                >
                                  {o.label}
                                </button>
                              )}
                            </td>
                            <td className="num">{o.sortOrder + 1}</td>
                            <td>
                              <button type="button" className="btn small secondary" onClick={() => moveOption(o.id, -1)} aria-label="Move up">
                                ↑
                              </button>{" "}
                              <button type="button" className="btn small secondary" onClick={() => moveOption(o.id, 1)} aria-label="Move down">
                                ↓
                              </button>{" "}
                              <button type="button" className="btn small secondary" onClick={() => deleteOption(o.id, o.label)}>
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {tab === "responses" && (
        <section className="section">
          <SectionHead num="01" title="Responses" />
          <div className="section-body">
            <label htmlFor="resp-form">Form</label>
            <select
              id="resp-form"
              value={responsesFormId === null ? "" : String(responsesFormId)}
              onChange={(e) => setResponsesFormId(e.target.value === "" ? null : Number(e.target.value))}
            >
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
            {responsesForm && (
              <>
                <p style={{ marginTop: 12 }}>
                  <a href={`/api/admin/submissions/export?formId=${responsesForm.id}`}>
                    Download CSV
                  </a>{" "}
                  · {submissions.length} response{submissions.length === 1 ? "" : "s"}
                </p>
                {submissions.length === 0 ? (
                  <p className="muted">No responses yet for this form.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Submitted</th>
                          {responsesForm.fields.map((f) => (
                            <th key={f.id}>{f.label}</th>
                          ))}
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.map((s) => (
                          <tr key={s.id}>
                            <td>{new Date(s.createdAt + "Z").toLocaleString()}</td>
                            {responsesForm.fields.map((f) => (
                              <td key={f.id}>{s.data[`field_${f.id}`] ?? ""}</td>
                            ))}
                            <td>
                              <button type="button" className="btn small secondary" onClick={() => deleteSubmissionRow(s.id)}>
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </>
  );
}
