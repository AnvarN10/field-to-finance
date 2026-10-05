import { and, eq } from "drizzle-orm";
import { documents } from "@/lib/db/schema";
import { documentKey } from "@/lib/pilot-docs";
import { currentUser } from "@/lib/server/auth";
import { getStore } from "@/lib/server/context";
import { getDb } from "@/lib/server/db";
import { HEX64, readHashed } from "@/lib/store";

export const dynamic = "force-dynamic";

const json = (status: number, error: string) => Response.json({ error }, { status, headers: { "cache-control": "private, no-store" } });

// Farmer documents and delivery papers: any arranger, compliance for issuer KYC documents, or the user who uploaded a
// document with this hash. On top of basic auth.
export async function GET(_req: Request, ctx: { params: Promise<{ hash: string }> }) {
  let user;
  try {
    user = await currentUser();
  } catch {
    return json(503, "accounts unavailable");
  }
  if (!user) return json(401, "sign in required");
  const { hash } = await ctx.params;
  if (!HEX64.test(hash)) return json(400, "hash must be 64 lowercase hex characters");
  if (!user.roles.includes("arranger")) {
    const db = await getDb();
    const kyc = user.roles.includes("compliance") ? await db.query.documents.findFirst({ where: and(eq(documents.sha256, hash), eq(documents.kind, "kyc")) }) : undefined;
    const own = kyc ?? (await db.query.documents.findFirst({ where: and(eq(documents.sha256, hash), eq(documents.ownerUserId, user.id)) }));
    // Same answer as a missing file, so a farmer cannot probe for other farmers' documents.
    if (!own) return json(404, "not found");
  }
  const bytes = await readHashed(getStore(), documentKey(hash), hash);
  if (!bytes) return json(404, "not found");
  return new Response(bytes.slice(), {
    status: 200,
    headers: { "content-type": "application/octet-stream", "content-disposition": "attachment", "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
}
