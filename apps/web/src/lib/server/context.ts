import "server-only";
import type { Program } from "@anchor-lang/core";
import type { F2f } from "@f2f/sdk";
import type { Keypair, TransactionInstruction } from "@solana/web3.js";
import { Connection, PublicKey } from "@solana/web3.js";
import { createProgram } from "../chain/program";
import { sendServerTx } from "../chain/send";
import { createChainReader, type ChainReader } from "../chain/reader";
import { parseKeypair } from "../keys";
import type { StubDeps } from "../scas-stub";
import { S3Store, type BlobStore } from "../store";
import { serverEnv } from "./env";
import { investorPda, poolPda } from "@f2f/sdk";
import type { OpsContext } from "../chain/admin-ops";
import { projectsInPool } from "../chain/filters";
import type { FaucetDeps } from "../chain/faucet";
import { createCooldown } from "../cooldown";
import { RequestError } from "../errors";

let connection: Connection | undefined;
let reader: ChainReader | undefined;

export function getConnection(): Connection {
  connection ??= new Connection(serverEnv().SOLANA_RPC_URL, "confirmed");
  return connection;
}

export const getProgramId = () => new PublicKey(serverEnv().F2F_PROGRAM_ID);
export const getUsdcMint = () => new PublicKey(serverEnv().USDC_MINT);

export function getReader(): ChainReader {
  reader ??= createChainReader({
    program: createProgram(getConnection(), getProgramId()),
    connection: getConnection(),
    usdcMint: getUsdcMint(),
  });
  return reader;
}

/** Call after any transaction this server sent or confirmed. */
export function invalidateReads(): void {
  reader?.invalidate();
}

let store: BlobStore | undefined;

export function getStore(): BlobStore {
  if (store) return store;
  const e = serverEnv();
  const missing = (["BUCKET_NAME", "BUCKET_ENDPOINT", "BUCKET_ACCESS_KEY_ID", "BUCKET_SECRET_ACCESS_KEY"] as const).filter((k) => !e[k]);
  if (missing.length) throw new Error(`Bucket is not configured: set ${missing.join(", ")}`);
  store = new S3Store({
    bucket: e.BUCKET_NAME as string,
    endpoint: e.BUCKET_ENDPOINT as string,
    region: e.BUCKET_REGION,
    accessKeyId: e.BUCKET_ACCESS_KEY_ID as string,
    secretAccessKey: e.BUCKET_SECRET_ACCESS_KEY as string,
    forcePathStyle: e.BUCKET_FORCE_PATH_STYLE,
  });
  return store;
}

export type Role = "issuer" | "compliance" | "scas" | "deployer";
const ROLE_ENV = {
  issuer: "F2F_ISSUER_KEYPAIR",
  compliance: "F2F_COMPLIANCE_KEYPAIR",
  scas: "SCAS_SECRET_KEY",
  deployer: "F2F_DEPLOYER_KEYPAIR",
} as const;
const keypairs = new Map<Role, Keypair>();

export function roleKeypair(role: Role): Keypair {
  let kp = keypairs.get(role);
  if (!kp) {
    const name = ROLE_ENV[role];
    kp = parseKeypair(name, serverEnv()[name]);
    keypairs.set(role, kp);
  }
  return kp;
}

export async function sendAs(role: Role, ixs: TransactionInstruction[]): Promise<string> {
  try {
    return await sendServerTx(getConnection(), [roleKeypair(role)], ixs);
  } finally {
    invalidateReads();
  }
}

let buildProgram: Program<F2f> | undefined;
export function getBuildProgram(): Program<F2f> {
  buildProgram ??= createProgram(getConnection(), getProgramId());
  return buildProgram;
}

export function stubDeps(): StubDeps {
  const program = getBuildProgram();
  return {
    program,
    readField: (address) => program.account.field.fetchNullable(address),
    send: (ixs) => sendAs("scas", ixs),
    store: getStore(),
    scas: roleKeypair("scas").publicKey,
    publicBaseUrl: serverEnv().PUBLIC_BASE_URL,
    cluster: serverEnv().SOLANA_CLUSTER,
  };
}

export function opsContext(): OpsContext {
  const program = getBuildProgram();
  const connection = getConnection();
  return {
    program,
    usdcMint: getUsdcMint(),
    roles: {
      get issuer() { return roleKeypair("issuer").publicKey; },
      get compliance() { return roleKeypair("compliance").publicKey; },
      get deployer() { return roleKeypair("deployer").publicKey; },
    },
    send: (role, ixs) => sendAs(role, ixs),
    loadPool: async (poolId) => {
      const a = await program.account.pool.fetchNullable(poolPda(program.programId, poolId));
      if (!a) throw new RequestError(`Pool ${poolId} does not exist`, 404);
      return a;
    },
    loadProjects: async (pool) =>
      (await program.account.farmProject.all([projectsInPool(pool)])).map((r) => ({ address: r.publicKey, account: r.account })),
    tokenBalance: async (account) => {
      try {
        return BigInt((await connection.getTokenAccountBalance(account, "confirmed")).value.amount);
      } catch {
        return 0n;
      }
    },
    accountExists: async (account) => (await connection.getAccountInfo(account, "confirmed")) !== null,
    now: () => Math.floor(Date.now() / 1000),
  };
}

const faucetCooldown = createCooldown(60_000);
export function faucetDeps(): FaucetDeps {
  return {
    connection: getConnection(),
    usdcMint: getUsdcMint(),
    deployer: roleKeypair("deployer").publicKey,
    send: (ixs) => sendAs("deployer", ixs),
    usdcAmount: BigInt(serverEnv().FAUCET_USDC) * 1_000_000n,
    cooldown: faucetCooldown,
  };
}
