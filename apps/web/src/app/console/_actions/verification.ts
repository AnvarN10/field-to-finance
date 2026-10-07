"use server";

import { RequestError } from "@/lib/errors";
import { arrangerChain } from "@/lib/server/chain-port";
import { consoleAction, storeUpload } from "@/lib/server/console-action";
import { verifyApplicationFields } from "@/lib/workflow/arranger";
import { SEASON_KINDS, type SeasonKind } from "@/lib/workflow/ports";
import { recordSeasonAttestation } from "@/lib/workflow/scas";

export const verifyFieldsAction = async (applicationId: string) =>
  consoleAction("verification.attest", "Fields verified", (u, db) => verifyApplicationFields(db, u, applicationId, arrangerChain()));

/** Season attestation from the SCAS cabinet: optional evidence file first (bucket), then one attestation per field. */
export const attestAction = async (poolId: string, form: FormData) =>
  consoleAction("verification.attest", "Attestation recorded for every field", async (u, db) => {
    const kind = String(form.get("kind") ?? "");
    if (!(SEASON_KINDS as readonly string[]).includes(kind)) throw new RequestError("Choose the season stage", 400);
    const rawYield = String(form.get("yield") ?? "").trim().replace(",", ".");
    const yieldEstimate = rawYield ? Number(rawYield) : null;
    if (yieldEstimate !== null && !Number.isFinite(yieldEstimate)) throw new RequestError("Enter the yield estimate as a number of tonnes per hectare", 400);
    const note = String(form.get("note") ?? "").trim() || null;
    const documentSha256 = await storeUpload(db, u.id, form, "file", false);
    return recordSeasonAttestation(db, u, { poolId, kind: kind as SeasonKind, note, documentSha256, yieldEstimateTPerHa: yieldEstimate }, arrangerChain());
  });
