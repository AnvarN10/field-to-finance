import { attestationPda, canonicalJson, fieldPda, sha256, toHex } from "@f2f/sdk";
import { Keypair, type PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import type { FieldAccount, ProjectWithFields } from "../src/lib/chain/views";
import { SCAS_STUB_NOTE, attestStub, evidenceUri, verifyAllFields, type StubDeps, type StubEvidence } from "../src/lib/scas-stub";
import { createSerialQueue } from "../src/lib/serial";
import { MemoryStore, evidenceKey, serveHashed } from "../src/lib/store";
import { fieldValue, offlineProgram, roundTrip } from "./fixtures/accounts";

const program = offlineProgram();
const NOW = new Date("2026-10-05T10:00:00.000Z");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function makeDeps(opts: { exists?: boolean } = {}) {
  const project = Keypair.generate().publicKey;
  const store = new MemoryStore();
  let count = 0;
  const sent: TransactionInstruction[][] = [];
  const { account } = await roundTrip<FieldAccount>(program, "field", fieldValue({ project, index: 0, attestationCount: 0 }));
  const deps: StubDeps = {
    program,
    readField: vi.fn(async (_a: PublicKey) => (opts.exists === false ? null : ({ ...account, attestationCount: count } as FieldAccount))),
    send: vi.fn(async (ixs: TransactionInstruction[]) => {
      sent.push(ixs);
      await sleep(5); // the chain takes time; a second read during this window must not reuse the sequence
      count += 1;
      return `sig${count}`;
    }),
    store,
    scas: Keypair.generate().publicKey,
    publicBaseUrl: "https://f2f-web.up.railway.app",
    cluster: "devnet",
    now: () => NOW,
    queue: createSerialQueue(),
  };
  return { deps, project, store, sent, account };
}

describe("createSerialQueue", () => {
  it("runs tasks one after another and survives failures", async () => {
    const q = createSerialQueue();
    const order: string[] = [];
    const a = q.run(async () => {
      await sleep(10);
      order.push("a");
    });
    const b = q.run(async () => {
      order.push("b");
      throw new Error("boom");
    });
    const c = q.run(async () => order.push("c"));
    await a;
    await expect(b).rejects.toThrow("boom");
    await c;
    expect(order).toEqual(["a", "b", "c"]);
  });
});

describe("attestStub", () => {
  it("stores honest stub evidence and signs record_attestation with verdict Pass", async () => {
    const { deps, project, store, sent, account } = await makeDeps();
    const r = await attestStub(deps, { project, fieldIndex: 0, kind: "FieldVerified" });
    const field = fieldPda(program.programId, project, 0);

    const bytes = store.objects.get(evidenceKey(r.evidenceHash));
    expect(bytes).toBeDefined();
    const doc = JSON.parse(new TextDecoder().decode(bytes)) as StubEvidence;
    expect(doc).toMatchObject({
      provider: "scas-stub",
      note: SCAS_STUB_NOTE,
      kind: "FieldVerified",
      verdict: "Pass",
      polygonHash: toHex(Uint8Array.from(account.polygonHash)),
      fieldAreaHaX100: 7611,
      recordedAt: "2026-10-05T10:00:00.000Z",
      subject: { field: field.toBase58(), fieldIndex: 0, sequence: 0, cluster: "devnet" },
    });
    expect(toHex(sha256(canonicalJson(doc)))).toBe(r.evidenceHash);
    expect(r.evidenceUri).toBe(`https://f2f-web.up.railway.app/api/evidence/${r.evidenceHash}`);

    const ix = sent[0]?.[0] as TransactionInstruction;
    expect(ix.keys.some((m) => m.pubkey.equals(attestationPda(program.programId, field, 0)))).toBe(true);
    const coder = program.coder.instruction as unknown as { decode(data: Buffer): { name: string; data: unknown } | null };
    const decoded = coder.decode(ix.data)!;
    const data = decoded.data as Record<string, unknown>;
    expect(Object.keys(data.verdict as object)[0]).toBe("pass");
    expect(Number(data.ndviMeanX10k ?? data.ndvi_mean_x10k)).toBe(0);
    expect(String(data.sceneDate ?? data.scene_date)).toBe(String(NOW.getTime() / 1000));
    expect(r).toMatchObject({ signature: "sig1", sequence: 0, verdict: "Pass" });
  });

  it("serializes concurrent attestations on the same field", async () => {
    const { deps, project } = await makeDeps();
    const [a, b] = await Promise.all([
      attestStub(deps, { project, fieldIndex: 0, kind: "FieldVerified" }),
      attestStub(deps, { project, fieldIndex: 0, kind: "Sowing" }),
    ]);
    expect([a.sequence, b.sequence]).toEqual([0, 1]);
  });

  it("refuses a missing field before storing or signing anything", async () => {
    const { deps, project, store } = await makeDeps({ exists: false });
    await expect(attestStub(deps, { project, fieldIndex: 0, kind: "FieldVerified" })).rejects.toMatchObject({ status: 404 });
    expect(store.objects.size).toBe(0);
    expect(deps.send).not.toHaveBeenCalled();
  });

  it("serves stored evidence through the hashed route helper", async () => {
    const { deps, project, store } = await makeDeps();
    const r = await attestStub(deps, { project, fieldIndex: 0, kind: "Harvest" });
    const res = await serveHashed(store, evidenceKey(r.evidenceHash), r.evidenceHash);
    expect(res.status).toBe(200);
    expect(((await res.json()) as StubEvidence).kind).toBe("Harvest");
  });
});

describe("evidenceUri", () => {
  it("refuses URIs longer than the program allows", () => {
    expect(() => evidenceUri(`https://${"a".repeat(60)}.app`, "ab".repeat(32))).toThrow(/128/);
  });
});

describe("verifyAllFields", () => {
  it("attests only unverified fields of unpooled projects and reports failures", async () => {
    const { deps, project } = await makeDeps();
    const base = { producer: "", projectId: "1", crop: "wheat", season: 2027, expectedKg: "1", tokenizedKg: "0", requestedAmount: "1", fieldCount: 2, verifiedFieldCount: 1, harvestAttested: false, disbursed: false, settlement: null };
    const f = (index: number, verified: boolean) => ({ address: Keypair.generate().publicKey.toBase58(), project: project.toBase58(), index, polygonHash: "00".repeat(32), areaHaX100: 1, verified, attestationCount: 0 });
    const projects: ProjectWithFields[] = [
      { ...base, address: project.toBase58(), pool: null, fields: [f(0, false), f(1, true)] },
      { ...base, address: Keypair.generate().publicKey.toBase58(), pool: "x", fields: [f(0, false)] },
    ];
    const out = await verifyAllFields(deps, projects);
    expect(out.results).toHaveLength(1);
    expect(out.failures).toHaveLength(0);
    vi.mocked(deps.send).mockRejectedValueOnce(new Error("rpc down"));
    const again = await verifyAllFields(deps, projects);
    expect(again.failures[0]?.error).toBe("rpc down");
  });

  it("carries the partner's note, evidence file and yield estimate in the evidence of a season attestation", async () => {
    const { deps, project, store } = await makeDeps();
    const r = await attestStub(deps, { project, fieldIndex: 0, kind: "Harvest", extra: { observation: "Grain filling, low lodging", documentSha256: "ef".repeat(32), yieldEstimateTPerHa: 3.2 } });
    const doc = JSON.parse(new TextDecoder().decode(store.objects.get(evidenceKey(r.evidenceHash)))) as StubEvidence;
    expect(doc).toMatchObject({ kind: "Harvest", note: SCAS_STUB_NOTE, observation: "Grain filling, low lodging", documentSha256: "ef".repeat(32), yieldEstimateTPerHa: 3.2 });
    const plain = await attestStub(deps, { project, fieldIndex: 0, kind: "Sowing" });
    const plainDoc = JSON.parse(new TextDecoder().decode(store.objects.get(evidenceKey(plain.evidenceHash)))) as Record<string, unknown>;
    expect(plainDoc).not.toHaveProperty("observation");
    expect(plainDoc).not.toHaveProperty("yieldEstimateTPerHa");
  });
});
