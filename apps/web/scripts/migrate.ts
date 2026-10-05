// Railway pre-deploy step: bundled to dist/migrate.mjs (see package.json "build:migrate").
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrateUrl } from "../src/lib/db/migrate";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
const folder = process.env.MIGRATIONS_DIR ?? [join(here, "../drizzle"), join(here, "drizzle")].find((p) => existsSync(p));
if (!folder) {
  console.error("Migrations folder not found");
  process.exit(1);
}
migrateUrl(url, folder).then(
  () => console.log("Migrations applied"),
  (e: unknown) => {
    // The driver's message never contains the URL; print it without the stack.
    console.error(`Migration failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
