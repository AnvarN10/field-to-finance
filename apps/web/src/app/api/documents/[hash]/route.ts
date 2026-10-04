import { ADMIN_COOKIE, isAdminToken } from "@/lib/admin-auth";
import { documentKey } from "@/lib/pilot-docs";
import { getStore } from "@/lib/server/context";
import { serverEnv } from "@/lib/server/env";
import { HEX64, readHashed } from "@/lib/store";

export const dynamic = "force-dynamic";

function cookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}

// Farmer documents and delivery papers (ADR 0014): admin console only, on top of basic auth.
export async function GET(req: Request, ctx: { params: Promise<{ hash: string }> }) {
  if (!isAdminToken(serverEnv().ADMIN_PASSWORD, cookie(req, ADMIN_COOKIE))) return Response.json({ error: "admin session required" }, { status: 401 });
  const { hash } = await ctx.params;
  if (!HEX64.test(hash)) return Response.json({ error: "hash must be 64 lowercase hex characters" }, { status: 400 });
  const bytes = await readHashed(getStore(), documentKey(hash), hash);
  if (!bytes) return Response.json({ error: "not found" }, { status: 404 });
  return new Response(bytes.slice(), {
    status: 200,
    headers: { "content-type": "application/octet-stream", "content-disposition": "attachment", "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
}
