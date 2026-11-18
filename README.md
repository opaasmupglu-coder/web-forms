# PGLU Forms

Customizable registration and custom forms for the Provincial Government of
La Union — built to be better than Google Forms where it matters: every
dropdown is searchable, the office and name lists are maintained in one
place, and the admin can build any form without touching code.

## What it does

- **Public form links** — every form gets a shareable link (`/f/[slug]`).
  Registrants need no sign-in. The form is mobile-first: one narrow column,
  16px fields (no iOS auto-zoom), 48px touch targets, and a full-width
  submit button.
- **Searchable dropdowns** — type to filter, tap or use the keyboard. Every
  dropdown in the app works this way, including Office and Name.
- **Maintenance (admin)** — option lists (Offices, Names, plus any custom
  list) with add / rename / reorder / delete, and paste-a-whole-list-at-once.
  Change a list once and every form using it updates.
- **Form builder (admin)** — create any form; add fields (short text, long
  text, email, phone, number, date, searchable dropdown, yes/no checkbox);
  set required, help text, and order; point a dropdown at a list or give it
  custom options; open/close the form; set its success message.
- **Responses (admin)** — view submissions per form and export to CSV.

## Tech stack

- **Next.js 15 (App Router) + React 19 + TypeScript** — deploys on Vercel.
- **Turso (libSQL / SQLite)** via `@libsql/client` — one database holds
  lists, forms, fields, and submissions. Tables are created automatically
  on first use; `npm run seed` adds starter content.
- **Admin auth** — a single app password, stored only as a scrypt hash
  (`APP_PASSWORD_HASH`). The admin area (`/admin`, `/api/admin/*`) is gated
  by middleware; public form pages are open.
- **Design** — plain CSS, Bone / Charcoal / Marigold editorial system
  (Fraunces + IBM Plex Sans, self-hosted). No heavy UI framework.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your values (see below)
npm run seed                 # creates tables + Offices list + sample form
npm run dev                  # http://localhost:3000
```

Local testing uses a file database (`TURSO_DATABASE_URL=file:./local.db`),
so no token is needed to develop.

## Environment variables (Vercel)

| Variable | Value |
| --- | --- |
| `TURSO_DATABASE_URL` | `libsql://web-form-opaasmupglu-coder.aws-ap-northeast-1.turso.io` |
| `TURSO_AUTH_TOKEN` | The Turso database token (keep it secret) |
| `APP_PASSWORD_HASH` | scrypt hash of the admin password — generate with `ADMIN_PASSWORD='…' node scripts/make-hash.mjs` |

## Deploy (Vercel)

1. Import the GitHub repo into Vercel (Next.js, defaults are fine).
2. Set the three environment variables above.
3. Deploy. Then run `npm run seed` once against the Turso database (with
   the same env vars) to add the Offices list and the sample Registration
   form.
4. **Turn deployment protection OFF for this project** — otherwise
   registrants hit a Vercel sign-in wall when they open a public form link.

## Seeded starter content

- **Offices** list — the PGLU offices (editable in Admin → Lists).
- **Names** list — starts empty; add people in Admin → Lists.
- **Registration** form (`/f/registration`) — Office, Full Name, Position,
  Contact Number, Email, Remarks. Edit or delete it in Admin → Forms.
