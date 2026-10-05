import { sql } from "drizzle-orm";
import journal from "../../../drizzle/meta/_journal.json";
import type { Db } from "./client";

/** The newest migration this build ships (Drizzle records its journal `when` as `created_at`). */
export const EXPECTED_MIGRATION = journal.entries.reduce((a, e) => (e.when > a.when ? e : a));

export const MIGRATE_HINT = "Run the migrations: node apps/web/dist/migrate.mjs (Railway runs it as the pre-deploy command of web).";

/** Thrown when the database is behind this build. The message names the gap and the command that closes it. */
export class SchemaBehindError extends Error {
  override name = "SchemaBehindError";
}

const rowsOf = (r: unknown): Record<string, unknown>[] => (Array.isArray(r) ? r : ((r as { rows?: Record<string, unknown>[] }).rows ?? []));

/**
 * Fails closed when the newest applied migration is older than the newest one this build ships: running new code on
 * an old schema would write half-shaped rows or fail in confusing places.
 */
export async function assertSchemaCurrent(db: Db, expected: { when: number; tag: string } = EXPECTED_MIGRATION): Promise<void> {
  let applied = 0;
  try {
    const [row] = rowsOf(await db.execute(sql`select max(created_at) as latest from drizzle.__drizzle_migrations`));
    applied = Number(row?.latest ?? 0);
  } catch {
    throw new SchemaBehindError(`The database has no migrations applied; this build expects ${expected.tag}. ${MIGRATE_HINT}`);
  }
  if (applied < expected.when) throw new SchemaBehindError(`The database schema is behind this build: it expects ${expected.tag}. ${MIGRATE_HINT}`);
}
