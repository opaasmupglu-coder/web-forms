import Link from "next/link";
import { listActiveForms } from "@/lib/db";
import { missingEnv } from "@/lib/turso";
import { NotConnected, PageHead, SectionHead } from "@/components/ui";

// Public index: every active form with its shareable link.
export default async function HomePage() {
  const missing = missingEnv();
  if (missing.length > 0) {
    return (
      <>
        <PageHead
          kicker="PGLU Forms"
          title="Forms"
          description="Registration and custom forms for PGLU offices and events."
        />
        <NotConnected missingEnv={missing} />
      </>
    );
  }

  const forms = await listActiveForms();
  return (
    <>
      <PageHead
        kicker="PGLU Forms"
        title="Forms"
        description="Pick a form to fill in. Office and name fields are searchable — just start typing."
      />

      {forms.length === 0 ? (
        <div className="state-block">
          <p className="kicker">No forms yet</p>
          <p className="lede">
            There are no active forms right now. The admin can create one from
            the Admin page.
          </p>
          <p>
            <Link href="/admin">Go to Admin →</Link>
          </p>
        </div>
      ) : (
        <section className="section" aria-labelledby="open-forms">
          <SectionHead num="01" title="Open forms" right={`${forms.length} form${forms.length === 1 ? "" : "s"}`} />
          <div className="section-body">
            <ol className="steps">
              {forms.map((f, i) => (
                <li key={f.slug}>
                  <span className="step-num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="step-body">
                    <b>
                      <Link href={`/f/${f.slug}`}>{f.title}</Link>
                    </b>
                    {f.description && <p>{f.description}</p>}
                    <p>
                      <code>/f/{f.slug}</code>
                    </p>
                  </span>
                  <span className="step-state">
                    <Link href={`/f/${f.slug}`}>Open →</Link>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </>
  );
}
