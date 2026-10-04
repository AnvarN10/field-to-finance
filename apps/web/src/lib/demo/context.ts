import { Connection, Keypair, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { programReads, type OpsContext } from "../chain/admin-ops";
import { projectsInPool } from "../chain/filters";
import { usdcAta } from "../chain/ix";
import { createProgram } from "../chain/program";
import { createChainReader } from "../chain/reader";
import { buildV0, bytesToBase64, confirmOrThrow, sendServerTx } from "../chain/send";
import { cosignAndSend, type SponsorPolicy } from "../chain/sponsor";
import type { TxAction } from "../chain/user-tx";
import { parseServerEnv } from "../env";
import { explorerTx } from "../format";
import { parseKeypair } from "../keys";
import { type StubDeps } from "../scas-stub";
import { S3Store, polygonKey } from "../store";
import { poolPda } from "@f2f/sdk";

/** Everything a devnet demo run needs: program, reader, bucket, role keys, ops and the sponsored send path. */
export async function createDemoContext(source: Record<string, string | undefined>) {
  const env = parseServerEnv(source);
  const missingBucket = (["BUCKET_NAME", "BUCKET_ENDPOINT", "BUCKET_ACCESS_KEY_ID", "BUCKET_SECRET_ACCESS_KEY"] as const).filter((k) => !env[k]);
  if (missingBucket.length) throw new Error(`Set ${missingBucket.join(", ")} (Railway bucket credentials) before running the demo`);
  const cluster = env.SOLANA_CLUSTER;
  const tx = (sig: string) => explorerTx(sig, cluster);
  const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
  const programId = new PublicKey(env.F2F_PROGRAM_ID);
  const usdcMint = new PublicKey(env.USDC_MINT);
  const program = createProgram(connection, programId);
  const reader = createChainReader({ program, connection, usdcMint, ttlMs: 0 });
  const store = new S3Store({
    bucket: env.BUCKET_NAME as string,
    endpoint: env.BUCKET_ENDPOINT as string,
    region: env.BUCKET_REGION,
    accessKeyId: env.BUCKET_ACCESS_KEY_ID as string,
    secretAccessKey: env.BUCKET_SECRET_ACCESS_KEY as string,
    forcePathStyle: env.BUCKET_FORCE_PATH_STYLE,
  });
  const keys = {
    deployer: parseKeypair("F2F_DEPLOYER_KEYPAIR", env.F2F_DEPLOYER_KEYPAIR),
    issuer: parseKeypair("F2F_ISSUER_KEYPAIR", env.F2F_ISSUER_KEYPAIR),
    compliance: parseKeypair("F2F_COMPLIANCE_KEYPAIR", env.F2F_COMPLIANCE_KEYPAIR),
    scas: parseKeypair("SCAS_SECRET_KEY", env.SCAS_SECRET_KEY),
    sponsor: parseKeypair("F2F_SPONSOR_KEYPAIR", env.F2F_SPONSOR_KEYPAIR),
  };
  const send = (signers: Keypair[], ixs: TransactionInstruction[]) => sendServerTx(connection, signers, ixs);
  const ops: OpsContext = {
    program,
    usdcMint,
    roles: { issuer: keys.issuer.publicKey, compliance: keys.compliance.publicKey, deployer: keys.deployer.publicKey },
    send: (role, ixs) => send([keys[role]], ixs),
    loadPool: async (id) => program.account.pool.fetch(poolPda(programId, id)),
    loadProjects: async (pool) => (await program.account.farmProject.all([projectsInPool(pool)])).map((r) => ({ address: r.publicKey, account: r.account })),
    tokenBalance: async (a) => {
      try {
        return BigInt((await connection.getTokenAccountBalance(a, "confirmed")).value.amount);
      } catch {
        return 0n;
      }
    },
    accountExists: async (a) => (await connection.getAccountInfo(a, "confirmed")) !== null,
    loadFees: () => reader.fees(),
    now: () => Math.floor(Date.now() / 1000),
    ...programReads(program),
  };
  const fees = await reader.fees();
  if (!fees) throw new Error("FeeConfig is not initialized; run scripts/devnet-init-fees.ts first");
  const treasury = new PublicKey(fees.treasury);
  const treasuryUsdc = usdcAta(usdcMint, treasury, true);
  const treasuryStart = await ops.tokenBalance(treasuryUsdc);
  const policy: SponsorPolicy = { program, sponsor: keys.sponsor.publicKey, usdcMint, treasury, mintFee: BigInt(fees.mintFee) };
  /** The production path (ADR 0013): the user signs, the sponsor validates, co-signs as fee payer and submits. */
  const sponsored = async (action: TxAction, user: Keypair, ixs: TransactionInstruction[]) => {
    const { tx: unsigned, blockhash, lastValidBlockHeight } = await buildV0(connection, keys.sponsor.publicKey, ixs);
    unsigned.sign([user]);
    const signature = await cosignAndSend(
      { policy, sponsorKey: keys.sponsor, connection, polygonExists: async (h) => (await store.get(polygonKey(h))) !== null, allowRent: () => 0 },
      action,
      bytesToBase64(unsigned.serialize()),
    );
    await confirmOrThrow(connection, signature, blockhash, lastValidBlockHeight);
    return signature;
  };
  const treasuryGain = async () => (await ops.tokenBalance(treasuryUsdc)) - treasuryStart;
  const stub: StubDeps = {
    program,
    readField: (a) => program.account.field.fetchNullable(a),
    send: (ixs) => send([keys.scas], ixs),
    store,
    scas: keys.scas.publicKey,
    publicBaseUrl: env.PUBLIC_BASE_URL,
    cluster,
  };

  return { env, cluster, tx, connection, programId, usdcMint, program, reader, store, keys, send, ops, fees, treasury, treasuryUsdc, policy, sponsored, treasuryGain, stub };
}

export type DemoContext = Awaited<ReturnType<typeof createDemoContext>>;
