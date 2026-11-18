"use client";
import { useEffect, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";
import { ErrorState, LoadingState } from "@/components/ui";
import type { PublicForm } from "@/lib/types";

// The page a registrant opens: /f/[slug]. Single column, large touch
// targets, 16px inputs (no iOS auto-zoom), searchable dropdowns, inline
// errors, and a proper success screen.
export default function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/forms/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load the form.");
        setForm(data.form as PublicForm);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the form."))
      .finally(() => setLoading(false));
  }, [slug]);

  function setValue(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setFieldErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    // Client-side required check, so the error shows next to the field.
    const errs: Record<string, string> = {};
    for (const f of form.fields) {
      const v = (values[`field_${f.id}`] ?? "").trim();
      if (f.required && v === "") errs[`field_${f.id}`] = "This is required.";
      if (f.type === "email" && v !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        errs[`field_${f.id}`] = "That doesn't look like an email address.";
      }
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      const first = document.querySelector<HTMLElement>(".field-error");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId: form.id, values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save your response.");
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your response.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState what="Loading the form" />;
  // The public form link shows only the form — no site chrome, no nav,
  // no link back to the form list. A bad link just says so.
  if (error || !form) {
    return <ErrorState error={error || "Form not found."} />;
  }

  if (submitted) {
    return (
      <div className="form-shell">
        <div className="notice ok" role="status">
          <span className="notice-kicker">Submitted</span>
          <p style={{ fontSize: 18 }}>{form.successMessage}</p>
        </div>
        <p>
          <button
            className="btn secondary"
            type="button"
            onClick={() => {
              setValues({});
              setSubmitted(false);
            }}
          >
            Submit another response
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="form-shell">
      <p className="kicker">PGLU Forms</p>
      <h2 style={{ marginTop: 6 }}>{form.title}</h2>
      {form.description && <p className="lede">{form.description}</p>}

      {error && <ErrorState error={error} />}

      <form onSubmit={submit} noValidate>
        {form.fields.map((f, i) => {
          const key = `field_${f.id}`;
          const err = fieldErrors[key];
          const inputId = `input-${f.id}`;
          return (
            <div className="form-field" key={f.id}>
              <label htmlFor={f.type === "checkbox" ? undefined : inputId}>
                <span className="field-num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>{" "}
                {f.label}
                {f.required && (
                  <span className="required-mark" aria-label="required">
                    {" "}
                    *
                  </span>
                )}
              </label>
              {f.helpText && <p className="field-help">{f.helpText}</p>}
              {f.type === "textarea" ? (
                <textarea
                  id={inputId}
                  rows={4}
                  value={values[key] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => setValue(key, e.target.value)}
                  aria-invalid={!!err}
                />
              ) : f.type === "dropdown" ? (
                <SearchableSelect
                  id={inputId}
                  options={f.options}
                  value={values[key] ?? ""}
                  onChange={(v) => setValue(key, v)}
                  placeholder={f.placeholder || "Type to search…"}
                  required={f.required}
                  name={key}
                />
              ) : f.type === "checkbox" ? (
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={values[key] === "Yes"}
                    onChange={(e) => setValue(key, e.target.checked ? "Yes" : "")}
                  />
                  <span>Yes</span>
                </label>
              ) : (
                <input
                  id={inputId}
                  type={f.type === "tel" ? "tel" : f.type}
                  inputMode={f.type === "tel" ? "tel" : f.type === "number" ? "decimal" : undefined}
                  value={values[key] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => setValue(key, e.target.value)}
                  aria-invalid={!!err}
                />
              )}
              {err && (
                <p className="field-error" role="alert">
                  {err}
                </p>
              )}
            </div>
          );
        })}

        <button className="btn block" type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit"}
        </button>
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          No sign-in needed. Your response is saved to the PGLU Forms database.
        </p>
      </form>
    </div>
  );
}
