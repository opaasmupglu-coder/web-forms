import type { Metadata } from "next";
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
    "Official registration and custom forms of the Provincial Government of La Union. Searchable dropdowns, no sign-in needed.",
};

// Fonts are self-hosted via Fontsource (bundled woff2, no runtime fetch),
// so the build works with no network access to Google Fonts.
//
// The root layout is intentionally bare — no header, nav, or footer.
// Pages that belong to the site (homepage, login, admin) render the
// shared SiteHeader/SiteFooter themselves. The public form pages
// (/f/[slug]) render nothing but the form, so a registrant opening a
// form link sees only the form.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
