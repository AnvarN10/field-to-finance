import "server-only";
import { roleMismatches } from "../chain/admin-ops";
import { shortKey } from "../format";
import { roleKeyProblem } from "../keys";
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

/** Devnet state behind the live pools and treasury panels (moved from the old demo console). */
export async function consoleData() {
  const reader = getReader();
  let sponsorKey;
  try {
    sponsorKey = sponsorPublicKey();
  } catch {
    sponsorKey = null; // malformed key: reported in the key problems
  }
  const [config, pools, unpooled, fees] = await Promise.all([reader.config(), reader.listPools(), reader.unpooledProjects(), reader.fees()]);
  const details = (await Promise.all(pools.map((p) => reader.getPool(p.poolId)))).filter((d) => d !== null);
  const sponsor = sponsorKey ? { address: sponsorKey.toBase58(), lamports: await getConnection().getBalance(sponsorKey, "confirmed") } : null;
  const producers = [...new Set(unpooled.map((p) => p.producer))];
  const farmers = (await reader.approvedWallets(producers)).map((wallet) => ({ wallet, label: `Farmer ${shortKey(wallet)}` }));
  const keys = { issuer: safeKey("issuer"), compliance: safeKey("compliance"), scas: safeKey("scas") };
  const env = serverEnv();
  return {
    config,
    pools,
    unpooled,
    details,
    fees,
    sponsor,
    farmers,
    mismatches: roleMismatches(config, keys),
    // Names a missing or malformed key by variable only, never its value.
    keyProblems: ALL_KEY_VARS.map((name) => roleKeyProblem(name, env[name])).filter((m): m is string => m !== null),
  };
}
