/** Postgres SQLSTATE of a driver error (postgres-js and PGlite), also when Drizzle wraps it in `cause`. */
export function pgCode(e: unknown): string | undefined {
  for (let x: unknown = e, i = 0; x && typeof x === "object" && i < 4; x = (x as { cause?: unknown }).cause, i++) {
    const code = (x as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
}

export const isUniqueViolation = (e: unknown) => pgCode(e) === "23505";
