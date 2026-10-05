import type { SessionUser } from "../../src/lib/auth/session";
import type { PoolDetail, ProjectWithFields } from "../../src/lib/chain/views";
import type { Db } from "../../src/lib/db/client";
import { userRoles, users, wallets, type Role } from "../../src/lib/db/schema";
import type { ArrangerChain, StoredDocInput } from "../../src/lib/workflow/ports";

export async function makeUser(db: Db, email: string, roles: Role[], wallet?: string): Promise<SessionUser> {
  const [u] = await db.insert(users).values({ email, privyDid: `did:privy:${email}` }).returning();
  for (const role of roles) await db.insert(userRoles).values({ userId: u!.id, role });
  if (wallet) await db.insert(wallets).values({ address: wallet, userId: u!.id, kind: "privy-embedded" });
  return { id: u!.id, email, roles: [...roles].sort() };
}

export const doc = (n: number): StoredDocInput => ({ sha256: n.toString(16).padStart(64, "0"), size: 100 + n, contentType: "application/pdf" });

export const FARMER_WALLET = "FarmerWa11et1111111111111111111111111111111";
export const INVESTOR_WALLET = "9nvestor1111111111111111111111111111111111";
export const PROJECT = "Project111111111111111111111111111111111111";

export function project(over: Partial<ProjectWithFields> = {}): ProjectWithFields {
  return {
    address: PROJECT,
    producer: FARMER_WALLET,
    projectId: "1",
    pool: null,
    crop: "wheat",
    season: 2027,
    expectedKg: "1000000",
    tokenizedKg: "300000",
    requestedAmount: "200000000000",
    fieldCount: 2,
    verifiedFieldCount: 0,
    harvestAttested: false,
    disbursed: false,
    settlement: null,
    fields: [],
    ...over,
  };
}

/** Records every chain call; behaviour is tweakable per test. */
export function fakeChain(over: Partial<ArrangerChain> = {}) {
  const calls: string[] = [];
  let verified = false;
  const chain: ArrangerChain & { calls: string[] } = {
    calls,
    async approveKyc(wallet) {
      calls.push(`approveKyc:${wallet}`);
      return `sig-kyc-${wallet.slice(0, 4)}`;
    },
    async revokeKyc(wallet) {
      calls.push(`revokeKyc:${wallet}`);
      return [`sig-revoke-${wallet.slice(0, 4)}`];
    },
    async project(address) {
      calls.push(`project:${address}`);
      return project(verified ? { verifiedFieldCount: 2 } : {});
    },
    async recordDelivery(poolId, e) {
      calls.push(`recordDelivery:${poolId}:${e.kind}:${e.verdict}`);
      return { signature: `sig-${e.kind}`, evidenceHash: "ee".repeat(32) };
    },
    async attest(input) {
      calls.push(`attest:${input.poolId}:${input.kind}`);
      return [`sig-attest-${input.kind}`];
    },
    async verifyFields(p) {
      calls.push(`verifyFields:${p.address}`);
      verified = true;
      return ["sig-verify-1", "sig-verify-2"];
    },
    async createTermPool(input) {
      calls.push(`createTermPool:${input.poolId}:${input.instrument?.issuerOfRecord}`);
      return { poolId: input.poolId, poolAddress: `Pool${input.poolId}`, signature: "sig-create" };
    },
    async addProject(poolId, p) {
      calls.push(`addProject:${poolId}:${p}`);
      return "sig-add";
    },
    async openPool(poolId) {
      calls.push(`openPool:${poolId}`);
      return "sig-open";
    },
    async pool() {
      return null as PoolDetail | null;
    },
    async nextPoolId() {
      return "9";
    },
    ...over,
  };
  return chain;
}
