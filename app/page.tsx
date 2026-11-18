import Link from "next/link";
import { listActiveForms } from "@/lib/db";
import { missingEnv } from "@/lib/turso";
import { NotConnected, PageHead, SectionHead } from "@/components/ui";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

// The homepage must always show the CURRENT active forms — the admin
// creates forms at any time, and a prerendered copy would go stale until
// the next deploy. So this page renders fresh on every request.
export const dynamic = "force-dynamic";

// Public landing for the domain: what PGLU Forms is, and every open form
// with its description. No admin links anywhere on this page — the admin
// is reached only at /form-admin.
export default async function HomePage() {
  const missing = missingEnv();
  if (missing.length > 0) {
    return (
      <>
        <SiteHeader />
        <main className="container">
          <PageHead
            kicker="PGLU Forms"
            title="Forms"
            description="Official registration and custom forms of the Provincial Government of La Union."
          />
          <NotConnected missingEnv={missing} />
        </main>
        <SiteFooter />
      </>
    );
  }

  const forms = await listActiveForms();
  return (
    <>
      <SiteHeader />
      <main className="container">
        <PageHead
          kicker="PGLU Forms"
          title="Forms"
          description="Official registration and custom forms of the Provincial Government of La Union. Pick a form below to fill it in — office and name fields are searchable, just start typing. No sign-in needed."
        />

        {forms.length === 0 ? (
          <div className="state-block">
            <p className="kicker">No forms yet</p>
            <p className="lede">
              There are no open forms right now. Please check back later.
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
      </main>
      <SiteFooter />
    </>
  );
}
