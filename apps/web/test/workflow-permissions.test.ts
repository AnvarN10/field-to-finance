import { describe, expect, it } from "vitest";
import { PILOT_QUALITY_SPEC } from "@f2f/sdk";
import type { SessionUser } from "../src/lib/auth/session";
import { advanceApplication, decideFarmerKyc, decideInvestorKyc, publishApplication, rejectApplication, reviewDocument, structureApplication, verifyApplicationFields } from "../src/lib/workflow/arranger";
import { revokeInvestor } from "../src/lib/workflow/compliance";
import { recordElevatorReceipt, recordLabProtocol } from "../src/lib/workflow/delivery";
import { recordSeasonAttestation } from "../src/lib/workflow/scas";
import { createInvitation, setMemberRoles } from "../src/lib/workflow/team";
import { saveFarmerProfile } from "../src/lib/workflow/farmer";
import { saveQuestionnaire } from "../src/lib/workflow/investor";
import { testDb } from "./helpers/db";
import { fakeChain, makeUser } from "./helpers/workflow";

const db = await testDb();
const regulator = await makeUser(db, "reg@example.com", ["regulator"]);
const scas = await makeUser(db, "scas@example.com", ["scas"]);
const id = "00000000-0000-4000-8000-000000000000";
const chain = fakeChain();

const CASES: [string, string, (u: SessionUser) => Promise<unknown>][] = [
  ["reviewDocument", "review applications", (u) => reviewDocument(db, u, id, "accepted", null)],
  ["advanceApplication", "review applications", (u) => advanceApplication(db, u, id, "documents_review", chain)],
  ["rejectApplication", "review applications", (u) => rejectApplication(db, u, id, "no")],
  ["structureApplication", "structure pools", (u) => structureApplication(db, u, id, {} as never, chain)],
  ["publishApplication", "structure pools", (u) => publishApplication(db, u, id, chain)],
  ["decideFarmerKyc", "decide KYC", (u) => decideFarmerKyc(db, u, id, "approved", null, chain)],
  ["decideInvestorKyc", "decide KYC", (u) => decideInvestorKyc(db, u, id, "approved", null, chain)],
  ["revokeInvestor", "revoke KYC", (u) => revokeInvestor(db, u, id, "fraud", chain)],
  ["verifyApplicationFields", "record verification attestations", (u) => verifyApplicationFields(db, u, id, chain)],
  ["recordSeasonAttestation", "record verification attestations", (u) => recordSeasonAttestation(db, u, { poolId: "1", kind: "Sowing", note: null, documentSha256: null, yieldEstimateTPerHa: null }, chain)],
  ["recordElevatorReceipt", "record elevator receipts", (u) => recordElevatorReceipt(db, u, { poolId: "1", tonnes: 1, receiptNumber: "1", receivedOn: "2026-10-01", documentSha256: "0".repeat(64) }, chain)],
  ["recordLabProtocol", "record lab protocols", (u) => recordLabProtocol(db, u, { poolId: "1", measured: {}, documentSha256: "0".repeat(64) }, chain, PILOT_QUALITY_SPEC)],
  ["setMemberRoles", "manage the team", (u) => setMemberRoles(db, u, id, ["scas"])],
  ["createInvitation", "manage the team", (u) => createInvitation(db, u, { email: "x@example.com", roles: ["scas"] })],
];

describe("workflows authorize by permission", () => {
  it.each(CASES)("%s refuses a regulator", async (_name, verb, fn) => {
    await expect(fn(regulator)).rejects.toMatchObject({ status: 403, message: `You do not have permission to ${verb}.` });
  });

  it("an SCAS partner may not decide KYC", async () => {
    await expect(decideInvestorKyc(db, scas, id, "approved", null, chain)).rejects.toMatchObject({ status: 403 });
  });

  it("account kinds gate the self-service workflows", async () => {
    await expect(saveFarmerProfile(db, scas, {})).rejects.toMatchObject({ status: 403, message: "This needs an issuer account." });
    await expect(saveQuestionnaire(db, scas, {})).rejects.toMatchObject({ status: 403, message: "This needs an investor account." });
  });
});
