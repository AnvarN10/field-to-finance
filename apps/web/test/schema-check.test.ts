import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { assertSchemaCurrent, EXPECTED_MIGRATION, SchemaBehindError } from "../src/lib/db/schema-check";
import { testDb } from "./helpers/db";

describe("assertSchemaCurrent (fail closed when the schema is behind)", () => {
  it("passes on a database with every committed migration", async () => {
    await expect(assertSchemaCurrent(await testDb())).resolves.toBeUndefined();
  });

  it("refuses a database that is missing the newest migration, naming the command", async () => {
    const db = await testDb();
    await db.execute(sql`delete from drizzle.__drizzle_migrations where created_at = (select max(created_at) from drizzle.__drizzle_migrations)`);
    const err = await assertSchemaCurrent(db).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SchemaBehindError);
    expect((err as Error).message).toContain(EXPECTED_MIGRATION.tag);
    expect((err as Error).message).toContain("migrate.mjs");
  });

  it("refuses a database that was never migrated", async () => {
    const db = await testDb();
    await db.execute(sql`drop schema drizzle cascade`);
    await expect(assertSchemaCurrent(db)).rejects.toThrow(/no migrations applied/);
  });
});
