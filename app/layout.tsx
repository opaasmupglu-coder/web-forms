import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "PGLU Forms — Registration & Custom Forms",
  description:
    "Custom registration and feedback forms for the Provincial Government of La Union. Searchable dropdowns, maintained office and name lists, responses in one place.",
};

// Fonts are self-hosted via Fontsource (bundled woff2, no runtime fetch),
// so the build works with no network access to Google Fonts.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <p className="kicker">Provincial Government of La Union</p>
            <h1>PGLU Forms</h1>
            <p className="site-sub">
              Registration and custom forms — searchable dropdowns, maintained
              lists, responses in one place.
            </p>
            <nav className="main-nav" aria-label="Main">
              <Link href="/">Forms</Link>
              <Link href="/admin">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="footer">
          <div className="container">
            Responses are stored in the app&apos;s database — the admin can
            view them and export them to CSV.
          </div>
        </footer>
      </body>
    </html>
  );
}
