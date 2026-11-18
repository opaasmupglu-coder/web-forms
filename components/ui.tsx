import type { ReactNode } from "react";

export function PageHead({
  kicker,
  title,
  description,
  right,
}: {
  kicker: string;
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
        {description && <p className="lede">{description}</p>}
      </div>
      {right && <div className="freshness">{right}</div>}
    </div>
  );
}

export function SectionHead({
  num,
  title,
  right,
}: {
  num: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="section-head">
      <span className="sec-num" aria-hidden="true">
        {num}
      </span>
      <h3>{title}</h3>
      {right && <p>{right}</p>}
    </div>
  );
}

export function LoadingState({ what = "Loading" }: { what?: string }) {
  return (
    <div className="state-block">
      <p className="kicker">{what}…</p>
      <p className="lede">Please wait a moment.</p>
    </div>
  );
}

export function ErrorState({ error }: { error: string }) {
  return (
    <div className="notice error" role="alert">
      <span className="notice-kicker">Something went wrong</span>
      <p>{error}</p>
    </div>
  );
}

export function NotConnected({ missingEnv }: { missingEnv: string[] }) {
  return (
    <div className="notice" role="status">
      <span className="notice-kicker">Database not connected</span>
      <p>
        This app needs a Turso database. Set these environment variables in
        Vercel and redeploy:
      </p>
      <ul>
        {missingEnv.map((k) => (
          <li key={k}>
            <code>{k}</code>
          </li>
        ))}
      </ul>
      <p className="muted">
        The tables are created automatically on first use, and{" "}
        <code>npm run seed</code> adds the starter Offices list and sample
        form.
      </p>
    </div>
  );
}
