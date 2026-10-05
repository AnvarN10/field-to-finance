import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/** Any Drizzle Postgres database over this schema: postgres-js in the app and scripts, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export { schema };

export async function createPgDb(url: string): Promise<Db> {
  const [{ drizzle }, { default: postgres }] = await Promise.all([import("drizzle-orm/postgres-js"), import("postgres")]);
  const client = postgres(url, { max: 5, idle_timeout: 30, prepare: false });
  return drizzle(client, { schema }) as unknown as Db;
}
