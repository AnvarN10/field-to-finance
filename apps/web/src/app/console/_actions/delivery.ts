"use server";

import { PILOT_QUALITY_SPEC, type QualitySpec } from "@f2f/sdk";
import { arrangerChain } from "@/lib/server/chain-port";
import { getStore } from "@/lib/server/context";
import { consoleAction, storeUpload } from "@/lib/server/console-action";
import { evidenceKey, readHashed } from "@/lib/store";
import { recordElevatorReceipt, recordLabProtocol } from "@/lib/workflow/delivery";

/** The pool's own quality spec from the bucket (hash-checked); the pilot spec when it cannot be read. */
async function specOf(poolId: string): Promise<QualitySpec> {
  const d = await arrangerChain().pool(poolId);
  const hash = d?.terms?.qualitySpecHash;
  if (!hash) return PILOT_QUALITY_SPEC;
  const bytes = await readHashed(getStore(), evidenceKey(hash), hash).catch(() => null);
  return bytes ? (JSON.parse(new TextDecoder().decode(bytes)) as QualitySpec) : PILOT_QUALITY_SPEC;
}

export const recordReceiptAction = async (poolId: string, form: FormData) =>
  consoleAction("delivery.receipt", "Elevator receipt recorded", async (u, db) => {
    const documentSha256 = (await storeUpload(db, u.id, form, "file", true)) as string;
    const tonnes = Number(String(form.get("tonnes") ?? "").trim());
    return recordElevatorReceipt(db, u, { poolId, tonnes, receiptNumber: String(form.get("receiptNumber") ?? ""), receivedOn: String(form.get("receivedOn") ?? ""), documentSha256 }, arrangerChain());
  });

export const recordLabAction = async (poolId: string, form: FormData) =>
  consoleAction("delivery.lab", "Lab protocol recorded", async (u, db) => {
    const documentSha256 = (await storeUpload(db, u.id, form, "file", true)) as string;
    const spec = await specOf(poolId);
    const measured = Object.fromEntries(spec.parameters.map((p) => [p.key, String(form.get(p.key) ?? "")]));
    return recordLabProtocol(db, u, { poolId, measured, documentSha256 }, arrangerChain(), spec);
  });
