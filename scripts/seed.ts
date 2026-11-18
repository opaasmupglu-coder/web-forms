// Seed the database: `npm run seed`.
// Reads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from the environment.
// For local testing use TURSO_DATABASE_URL=file:./local.db (no token).
import { seed } from "../lib/seed";

async function main(): Promise<void> {
  const result = await seed();
  console.log(
    `Seed done: ${result.offices} office(s) added, ${result.forms} sample form(s) created.`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
