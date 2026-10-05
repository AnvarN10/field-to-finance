import "server-only";
import { createPgDb, type Db } from "../db/client";
import { serverEnv } from "./env";

let db: Promise<Db> | undefined;

/** The Postgres database (DATABASE_URL). Throws when it is not configured; callers show an error state. */
export function getDb(): Promise<Db> {
  const url = serverEnv().DATABASE_URL;
  if (!url) return Promise.reject(new Error("Postgres is not configured: set DATABASE_URL"));
  db ??= createPgDb(url).catch((e) => {
    db = undefined;
    throw e;
  });
  return db;
}
