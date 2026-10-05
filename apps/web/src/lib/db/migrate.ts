/** Applies the committed SQL migrations in `migrationsFolder` with Drizzle's migrator (one transaction per run). */
export async function migrateUrl(url: string, migrationsFolder: string): Promise<void> {
  const [{ drizzle }, { migrate }, { default: postgres }] = await Promise.all([
    import("drizzle-orm/postgres-js"),
    import("drizzle-orm/postgres-js/migrator"),
    import("postgres"),
  ]);
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}
