import "server-only";
import { roleMismatches } from "../chain/admin-ops";
import { shortKey } from "../format";
import { roleKeyProblem } from "../keys";
import { vaultBalance } from "./cabinet-data";
import { getConnection, getReader, roleKeypair, sponsorPublicKey } from "./context";
import { serverEnv } from "./env";

const ROLE_VAR = { issuer: "F2F_ISSUER_KEYPAIR", compliance: "F2F_COMPLIANCE_KEYPAIR", scas: "SCAS_SECRET_KEY" } as const;
const ALL_KEY_VARS = [...Object.values(ROLE_VAR), "F2F_SPONSOR_KEYPAIR"] as const;

function safeKey(role: keyof typeof ROLE_VAR): string | undefined {
  try {
    return roleKeypair(role).publicKey.toBase58();
  } catch {
    return undefined;
  }
}

function keyChecks(config: Awaited<ReturnType<ReturnType<typeof getReader>["config"]>>) {
  const keys = { issuer: safeKey("issuer"), compliance: safeKey("compliance"), scas: safeKey("scas") };
  const env = serverEnv();
  return {
    mismatches: roleMismatches(config, keys),
    // Names a missing or malformed key by variable only, never its value.
    keyProblems: ALL_KEY_VARS.map((name) => roleKeyProblem(name, env[name])).filter((m): m is string => m !== null),
  };
}

async function sponsorState() {
  let sponsorKey;
  try {
    sponsorKey = sponsorPublicKey();
  } catch {
    return null; // malformed key: reported in the key problems
  }
  return sponsorKey ? { address: sponsorKey.toBase58(), lamports: await getConnection().getBalance(sponsorKey, "confirmed") } : null;
}

/** Fees, treasury and server keys only: a few RPC calls, no program-account scans. */
export async function treasuryData() {
  const reader = getReader();
  const [config, fees, sponsor] = await Promise.all([reader.config(), reader.fees(), sponsorState()]);
  return { config, fees, sponsor, ...keyChecks(config) };
}

/** Devnet state behind the live pools panel (moved from the old demo console). */
export async function consoleData() {
  const reader = getReader();
  // Sequential: the public devnet RPC rate-limits bursts of program-account scans.
  const config = await reader.config();
  const pools = await reader.listPools();
  const unpooled = await reader.unpooledProjects();
  const fees = await reader.fees();
  const details = [];
  const vaults = new Map<string, bigint>();
  for (const p of pools) {
    const d = await reader.getPool(p.poolId);
    if (d) details.push(d);
    if (p.status !== "Draft") vaults.set(p.poolId, await vaultBalance(p.vault));
  }
  const sponsor = await sponsorState();
  const producers = [...new Set(unpooled.map((p) => p.producer))];
  const farmers = (await reader.approvedWallets(producers)).map((wallet) => ({ wallet, label: `Farmer ${shortKey(wallet)}` }));
  return { config, pools, unpooled, details, vaults, fees, sponsor, farmers, ...keyChecks(config) };
}
