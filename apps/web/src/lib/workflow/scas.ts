import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { SessionUser } from "../auth/session";
import type { Db } from "../db/client";
import { applications, type ApplicationRow } from "../db/schema";
import { RequestError } from "../errors";
import { seasonAttestationBlocker } from "../pool-math";
import { audited } from "./audit";
import { assertPermission } from "./guards";
import { notify, notifyPoolInvestors } from "./notifications";
import { SEASON_KINDS, type ArrangerChain, type SeasonAttestInput } from "./ports";

const SEASON_LABEL: Record<SeasonAttestInput["kind"], string> = { Sowing: "Sowing", Vegetation: "Vegetation", Harvest: "Yield estimate" };

/**
 * A season attestation by the SCAS partner (or an arranger acting as SCAS): one Attestation per field of the pool,
 * with the note, the optional evidence file hash and, for Harvest, the pre-harvest yield estimate in the evidence JSON.
 */
export async function recordSeasonAttestation(db: Db, actor: SessionUser, input: SeasonAttestInput, chain: Pick<ArrangerChain, "pool" | "attest">): Promise<string[]> {
  assertPermission(actor, "verification.attest");
  const actingRole = "scas";
  if (!/^\d{1,20}$/.test(input.poolId)) throw new RequestError("Invalid pool id", 400);
  if (!(SEASON_KINDS as readonly string[]).includes(input.kind)) throw new RequestError("Unknown season stage", 400);
  if (input.note !== null && input.note.length > 500) throw new RequestError("Keep the note under 500 characters", 400);
  if (input.documentSha256 !== null && !/^[0-9a-f]{64}$/.test(input.documentSha256)) throw new RequestError("Invalid evidence file", 400);
  if (input.kind === "Harvest") {
    const y = input.yieldEstimateTPerHa;
    if (y === null || !Number.isFinite(y) || y < 0.1 || y > 20) throw new RequestError("Enter the yield estimate in tonnes per hectare (0.1 to 20)", 400);
  } else if (input.yieldEstimateTPerHa !== null) throw new RequestError("A yield estimate goes with the Harvest stage only", 400);
  const detail = await chain.pool(input.poolId);
  if (!detail) throw new RequestError(`Pool ${input.poolId} does not exist`, 404);
  const blocked = seasonAttestationBlocker(detail.pool.status, detail.projects.length);
  if (blocked) throw new RequestError(blocked, 409);
  const signatures = await audited(
    db,
    { actorUserId: actor.id, actingRole, action: "pool.attest_stage", targetType: "pool", targetId: input.poolId, payload: { kind: input.kind, ...(input.yieldEstimateTPerHa !== null ? { yieldEstimateTPerHa: input.yieldEstimateTPerHa } : {}) } },
    () => chain.attest(input),
    (s) => s,
  );
  const symbol = detail.pool.instrument?.symbol ?? `POOL-${input.poolId}`;
  const title = `${SEASON_LABEL[input.kind]} attested: ${symbol}`;
  const body = input.kind === "Harvest" ? `The SCAS partner estimates ${input.yieldEstimateTPerHa} t/ha before harvest.` : `The SCAS partner recorded ${input.kind.toLowerCase()} for every field.`;
  const app = await db.query.applications.findFirst({ where: eq(applications.poolId, input.poolId) });
  if (app) await notify(db, app.farmerUserId, "attestation", title, body, "/issuer");
  await notifyPoolInvestors(db, detail.pool.address, "attestation", title, body, `/pools/${input.poolId}`);
  return signatures;
}

export interface ScasPoolRow {
  poolId: string;
  poolAddress: string;
  crop: string;
  season: number;
  status: ApplicationRow["status"];
}

/** Pools with an application, for the SCAS partner's season list (statuses from funded on). */
export async function scasPools(db: Db): Promise<ScasPoolRow[]> {
  // No company data: the SCAS partner sees pools and fields, not the issuer's identity.
  const rows = await db
    .select({ app: applications })
    .from(applications)
    .where(and(isNotNull(applications.poolId), inArray(applications.status, ["funded", "disbursed", "in_season", "harvest", "settlement"])));
  return rows
    .map((r) => ({ poolId: r.app.poolId as string, poolAddress: r.app.poolAddress as string, crop: r.app.crop, season: r.app.season, status: r.app.status }))
    .sort((a, b) => Number(BigInt(b.poolId) - BigInt(a.poolId)));
}

/** Applications waiting for field verification, for the SCAS partner's queue. */
export async function scasQueue(db: Db): Promise<ApplicationRow[]> {
  return db.select().from(applications).where(eq(applications.status, "field_verification"));
}
