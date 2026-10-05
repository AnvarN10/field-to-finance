import { effectiveElection, sha256, toHex, type QualitySpec } from "@f2f/sdk";
import { eq } from "drizzle-orm";
import type { SessionUser } from "../auth/session";
import type { PoolDetail } from "../chain/views";
import type { Db } from "../db/client";
import { applications } from "../db/schema";
import { RequestError } from "../errors";
import { evaluateLab } from "../lab-quality";
import type { DeliveryEvidence } from "../pilot-docs";
import { audited } from "./audit";
import { assertServiceRole } from "./guards";
import { notify, notifyPoolInvestors } from "./notifications";
import type { ArrangerChain } from "./ports";

type Chain = Pick<ArrangerChain, "pool" | "recordDelivery">;

/** The pool must be a Funded term-sheet pool on the delivery path (record_delivery refuses an elected buyback). */
async function deliveryPool(chain: Chain, poolId: string): Promise<PoolDetail> {
  if (!/^\d{1,20}$/.test(poolId)) throw new RequestError("Invalid pool id", 400);
  const d = await chain.pool(poolId);
  if (!d) throw new RequestError(`Pool ${poolId} does not exist`, 404);
  const t = d.terms;
  if (!t) throw new RequestError("This pool has no term sheet: delivery documents do not apply.", 409);
  if (t.settlementMode === "CashBuyback") throw new RequestError("This pool settles in cash only.", 409);
  if (d.pool.status !== "Funded") throw new RequestError("Delivery documents are recorded while the pool is Funded.", 409);
  if (effectiveElection(t, Math.floor(Date.now() / 1000), d.pool.maturityTs) === "Buyback") throw new RequestError("The issuer elected buyback: holders are paid in cash, not grain.", 409);
  return d;
}

async function record(db: Db, actor: SessionUser, actingRole: string, d: PoolDetail, evidence: DeliveryEvidence, chain: Chain, label: string): Promise<string> {
  const r = await audited(
    db,
    { actorUserId: actor.id, actingRole, action: "pool.record_delivery", targetType: "pool", targetId: d.pool.poolId, payload: { kind: evidence.kind, verdict: evidence.verdict } },
    () => chain.recordDelivery(d.pool.poolId, evidence),
    (x) => [x.signature],
  );
  const symbol = d.pool.instrument?.symbol ?? `POOL-${d.pool.poolId}`;
  const body = evidence.kind === "ElevatorReceipt" ? `${Number(BigInt(evidence.kg ?? "0") / 1000n).toLocaleString("en-US")} t received at ${d.terms?.elevator}.` : `Lab result: ${evidence.verdict === "Pass" ? "passed" : evidence.verdict === "Fail" ? "did not pass" : "insufficient data"} the quality spec.`;
  const app = await db.query.applications.findFirst({ where: eq(applications.poolId, d.pool.poolId) });
  if (app) await notify(db, app.farmerUserId, "delivery", `${label}: ${symbol}`, body, "/farmer");
  await notifyPoolInvestors(db, d.pool.address, "delivery", `${label}: ${symbol}`, body, `/pools/${d.pool.poolId}`);
  return r.signature;
}

export interface ReceiptInput {
  poolId: string;
  tonnes: number;
  receiptNumber: string;
  /** YYYY-MM-DD */
  receivedOn: string;
  documentSha256: string;
}

/** Elevator receipt (elevator role): tonnes received, the receipt number as a hash only, the date and the receipt file hash. */
export async function recordElevatorReceipt(db: Db, actor: SessionUser, input: ReceiptInput, chain: Chain): Promise<string> {
  const actingRole = assertServiceRole(actor, "elevator").role;
  if (!Number.isInteger(input.tonnes) || input.tonnes < 1 || input.tonnes > 10_000_000) throw new RequestError("Enter the tonnes received as a whole number", 400);
  const number = input.receiptNumber.trim();
  if (number.length < 1 || number.length > 64) throw new RequestError("Enter the receipt number", 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.receivedOn) || Number.isNaN(Date.parse(input.receivedOn))) throw new RequestError("Enter the receiving date", 400);
  if (!/^[0-9a-f]{64}$/.test(input.documentSha256)) throw new RequestError("Attach the receipt file", 400);
  const d = await deliveryPool(chain, input.poolId);
  return record(
    db,
    actor,
    actingRole,
    d,
    {
      kind: "ElevatorReceipt",
      verdict: "Pass",
      poolId: input.poolId,
      documentSha256: input.documentSha256,
      kg: (BigInt(input.tonnes) * 1000n).toString(),
      receiptNumberSha256: toHex(sha256(new TextEncoder().encode(number))),
      receivedOn: input.receivedOn,
    },
    chain,
    "Elevator receipt recorded",
  );
}

/** Lab protocol (lab role): the twelve measurements, pass/fail per parameter against the pool's spec, protocol file hash. */
export async function recordLabProtocol(db: Db, actor: SessionUser, input: { poolId: string; measured: Record<string, string>; documentSha256: string }, chain: Chain, spec: QualitySpec): Promise<string> {
  const actingRole = assertServiceRole(actor, "lab").role;
  if (!/^[0-9a-f]{64}$/.test(input.documentSha256)) throw new RequestError("Attach the lab protocol file", 400);
  const measured = Object.fromEntries(spec.parameters.map((p) => [p.key, String(input.measured[p.key] ?? "").trim().slice(0, 40)]));
  const { results, verdict } = evaluateLab(spec, measured);
  const d = await deliveryPool(chain, input.poolId);
  return record(db, actor, actingRole, d, { kind: "LabQuality", verdict, poolId: input.poolId, documentSha256: input.documentSha256, measurements: measured, results }, chain, "Lab protocol recorded");
}
