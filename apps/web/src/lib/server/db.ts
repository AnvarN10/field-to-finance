import "server-only";
import { createPgDb, type Db } from "../db/client";
import { assertSchemaCurrent } from "../db/schema-check";
import { serverEnv } from "./env";

let client: Promise<Db> | undefined;
let checked: Promise<Db> | undefined;

/**
 * The Postgres database (DATABASE_URL). Throws when it is not configured or when its schema is behind this build
 * (fail closed: callers show their error state, and the log names the migrate command). A failed check is retried on
 * the next call, so the app recovers by itself once the migrations ran.
 */
export function getDb(): Promise<Db> {
  const url = serverEnv().DATABASE_URL;
  if (!url) return Promise.reject(new Error("Postgres is not configured: set DATABASE_URL"));
  client ??= createPgDb(url).catch((e) => {
    client = undefined;
    throw e;
  });
  checked ??= client.then(async (d) => {
    try {
      await assertSchemaCurrent(d);
      return d;
    } catch (e) {
      checked = undefined;
      console.error(e instanceof Error ? e.message : e);
      throw e;
    }
  });
  return checked;
}
