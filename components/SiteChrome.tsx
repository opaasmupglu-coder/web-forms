// Shared site chrome for the pages that are part of the PGLU Forms site
// (homepage, login, admin). Deliberately NO navigation and NO admin link:
// the public form pages (/f/[slug]) render no chrome at all — just the
// form — and the admin is reached only by going to /form-admin directly.
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <p className="kicker">Provincial Government of La Union</p>
        <h1>PGLU Forms</h1>
        <p className="site-sub">
          Registration and custom forms for PGLU offices and events.
        </p>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container">
        Provincial Government of La Union · PGLU Forms
      </div>
    </footer>
  );
}
