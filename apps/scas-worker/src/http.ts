import { createHash, timingSafeEqual } from "node:crypto";
import { parseKind, sha256, toHex } from "@f2f/sdk";
import { PublicKey } from "@solana/web3.js";
import { Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import type { AttestRequest, AttestResult } from "./attest";
import { RequestError, SentinelError } from "./errors";
import { evidenceKey } from "./evidence";
import type { PolygonUpload } from "./polygons";
import type { BlobStore } from "./store";

export interface HttpDeps {
  attest(req: AttestRequest): Promise<AttestResult>;
  putPolygon(geojson: unknown): Promise<PolygonUpload>;
  store: BlobStore;
  apiToken: string;
  scas: PublicKey;
  version: string;
  reportError?(err: unknown): void;
}

const AttestBody = z.object({
  project: z.string().min(32).max(44),
  fieldIndex: z.number().int().min(0).max(255),
  kind: z.string().min(1),
  replayDate: z.string().optional(),
  dryRun: z.boolean().optional(),
});

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Constant-time comparison of `Authorization: Bearer <token>`. */
export function tokenMatches(expected: string, header: string | undefined): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  return timingSafeEqual(digest(header.slice("Bearer ".length)), digest(expected));
}

export function createApp(deps: HttpDeps): Hono {
  const app = new Hono();

  const auth: MiddlewareHandler = async (c, next) => {
    if (!tokenMatches(deps.apiToken, c.req.header("authorization"))) return c.json({ error: "unauthorized" }, 401);
    await next();
  };

  app.get("/health", (c) => c.json({ ok: true, scas: deps.scas.toBase58(), version: deps.version }));

  app.get("/e/:hash", async (c) => {
    const hash = c.req.param("hash");
    if (!/^[0-9a-f]{64}$/.test(hash)) return c.json({ error: "evidence hash must be 64 lowercase hex characters" }, 400);
    const bytes = await deps.store.get(evidenceKey(hash));
    if (!bytes) return c.json({ error: "evidence not found" }, 404);
    if (toHex(sha256(bytes)) !== hash) {
      deps.reportError?.(new Error(`stored evidence ${hash} failed its hash check`));
      return c.json({ error: "stored evidence does not match its hash" }, 502);
    }
    return c.body(bytes.slice(), 200, {
      "content-type": "application/json",
      "cache-control": "public, max-age=31536000, immutable",
    });
  });

  app.use("/attest", auth);
  app.use("/polygons", auth);

  app.post("/attest", async (c) => {
    const body = AttestBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "invalid body", issues: body.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, 400);
    }
    let project: PublicKey;
    try {
      project = new PublicKey(body.data.project);
    } catch {
      return c.json({ error: "project is not a valid public key" }, 400);
    }
    const result = await deps.attest({
      project,
      fieldIndex: body.data.fieldIndex,
      kind: parseKind(body.data.kind),
      replayDate: body.data.replayDate,
      dryRun: body.data.dryRun,
    });
    return c.json(result);
  });

  app.post("/polygons", async (c) => c.json(await deps.putPolygon(await c.req.json().catch(() => null))));

  app.onError((err, c) => {
    if (err instanceof RequestError) return c.json({ error: err.message }, err.status);
    if (err instanceof RangeError) return c.json({ error: err.message }, 400);
    deps.reportError?.(err);
    if (err instanceof SentinelError) return c.json({ error: `satellite data unavailable: ${err.message}` }, 502);
    return c.json({ error: "internal error" }, 500);
  });

  return app;
}
