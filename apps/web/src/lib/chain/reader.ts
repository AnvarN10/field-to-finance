import type { Program } from "@anchor-lang/core";
import { feesPda, instrumentPda, investorPda, poolPda, redemptionDue, termsPda, type F2f } from "@f2f/sdk";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getExtensionData,
  unpackAccount,
  unpackMint,
} from "@solana/spl-token";
import { PublicKey, type Connection } from "@solana/web3.js";
import { RequestError } from "../errors";
import { createTtlCache } from "../ttl-cache";
import { attestationsOfField, attestationsOfProject, fieldsOfProject, projectsByProducer, projectsInPool, projectsWithoutPool } from "./filters";
import { parseTokenMetadata } from "./token-metadata";
import {
  toAttestationView,
  toConfigView,
  toFieldView,
  toInstrumentTermsView,
  toPoolView,
  toProjectView,
  type AttestationView,
  type ConfigView,
  type FeeStatus,
  type FieldDetail,
  type InstrumentView,
  type InvestorState,
  type PoolDetail,
  type PoolView,
  type ProjectAccount,
  type ProjectWithFields,
} from "./views";

export interface ChainReader {
  config(): Promise<ConfigView>;
  listPools(): Promise<PoolView[]>;
  getPool(poolId: string): Promise<PoolDetail | null>;
  getField(address: string): Promise<FieldDetail | null>;
  projectsByProducer(producer: string): Promise<ProjectWithFields[]>;
  unpooledProjects(): Promise<ProjectWithFields[]>;
  investor(wallet: string): Promise<InvestorState>;
  /** Owners of a non-zero balance of an Instrument mint (Token-2022 accounts), largest first. */
  holders(mint: string): Promise<{ wallet: string; balance: string }[]>;
  /** Every Attestation on the pool's projects (season timeline), oldest first. */
  poolAttestations(poolId: string): Promise<AttestationView[]>;
  /** FeeConfig plus the treasury's USDC balance; null until fees are configured. */
  fees(): Promise<FeeStatus | null>;
  /** The subset of `wallets` whose InvestorRecord is approved (platform KYC). */
  approvedWallets(wallets: string[]): Promise<string[]>;
  invalidate(): void;
}

export interface ReaderDeps {
  program: Program<F2f>;
  connection: Connection;
  usdcMint: PublicKey;
  ttlMs?: number;
  /** Pool and project lists: a longer TTL, and a failed reload serves the last good list (public RPC 429s). */
  listTtlMs?: number;
}

function parseKey(s: string): PublicKey | null {
  try {
    return new PublicKey(s);
  } catch {
    return null;
  }
}

export function createChainReader({ program, connection, usdcMint, ttlMs = 5_000, listTtlMs = 15_000 }: ReaderDeps): ChainReader {
  const cache = createTtlCache(ttlMs);
  const lists = createTtlCache(listTtlMs, Date.now, { staleOnError: () => true });
  const programId = program.programId;

  async function instruments(mints: PublicKey[]): Promise<(InstrumentView | null)[]> {
    if (mints.length === 0) return [];
    const infos = await connection.getMultipleAccountsInfo(mints, "confirmed");
    return infos.map((info, i) => {
      if (!info) return null;
      const mint = unpackMint(mints[i] as PublicKey, info, TOKEN_2022_PROGRAM_ID);
      const ext = getExtensionData(ExtensionType.TokenMetadata, mint.tlvData);
      const meta = ext ? parseTokenMetadata(ext) : { name: "", symbol: "", uri: "" };
      return { ...meta, supply: mint.supply.toString(), decimals: mint.decimals };
    });
  }

  async function withFields(rows: { publicKey: PublicKey; account: ProjectAccount }[]): Promise<ProjectWithFields[]> {
    return Promise.all(
      rows.map(async ({ publicKey, account }) => {
        const fields = await program.account.field.all([fieldsOfProject(publicKey)]);
        return {
          ...toProjectView(publicKey, account),
          fields: fields.map((f) => toFieldView(f.publicKey, f.account)).sort((a, b) => a.index - b.index),
        };
      }),
    );
  }

  const listPools = () =>
    lists.get("pools", async () => {
      const [rows, termRows] = await Promise.all([program.account.pool.all(), program.account.instrumentTerms.all()]);
      const meta = await instruments(rows.map((r) => r.account.mint));
      const termsByPool = new Map(termRows.map((t) => [t.account.pool.toBase58(), toInstrumentTermsView(t.account)]));
      return rows
        .map((r, i) => ({ ...toPoolView(r.publicKey, r.account, meta[i] ?? null), terms: termsByPool.get(r.publicKey.toBase58()) ?? null }))
        .sort((a, b) => (BigInt(b.poolId) > BigInt(a.poolId) ? 1 : -1));
    });

  return {
    config: () =>
      cache.get("config", async () => {
        const [address] = PublicKey.findProgramAddressSync([new TextEncoder().encode("config")], programId);
        return toConfigView(await program.account.config.fetch(address));
      }),

    listPools,

    getPool: (poolId) =>
      cache.get(`pool:${poolId}`, async () => {
        if (!/^\d{1,20}$/.test(poolId)) return null;
        const address = poolPda(programId, BigInt(poolId));
        const account = await program.account.pool.fetchNullable(address);
        if (!account) return null;
        const [meta] = await instruments([account.mint]);
        const [projects, terms, instrumentTerms, issuerRecord] = await Promise.all([
          withFields(await program.account.farmProject.all([projectsInPool(address)])),
          program.account.poolTerms.fetchNullable(termsPda(programId, address)),
          program.account.instrumentTerms.fetchNullable(instrumentPda(programId, address)),
          program.account.investorRecord.fetchNullable(investorPda(programId, account.issuer)),
        ]);
        const instrument = instrumentTerms ? toInstrumentTermsView(instrumentTerms) : null;
        return {
          pool: { ...toPoolView(address, account, meta ?? null), terms: instrument },
          projects,
          arrangementFeeBps: terms?.arrangementFeeBps ?? 0,
          terms: instrument,
          issuerKycApproved: issuerRecord?.approved ?? false,
        };
      }),

    getField: (address) =>
      cache.get(`field:${address}`, async () => {
        const key = parseKey(address);
        if (!key) return null;
        const field = await program.account.field.fetchNullable(key);
        if (!field) return null;
        const project = await program.account.farmProject.fetch(field.project);
        let pool: PoolView | null = null;
        if (project.pool) {
          const p = await program.account.pool.fetchNullable(project.pool);
          if (p) pool = toPoolView(project.pool, p, (await instruments([p.mint]))[0] ?? null);
        }
        const attestations = (await program.account.attestation.all([attestationsOfField(key)]))
          .map((a) => toAttestationView(a.publicKey, a.account))
          .sort((a, b) => a.sequence - b.sequence);
        return { field: toFieldView(key, field), project: toProjectView(field.project, project), pool, attestations };
      }),

    projectsByProducer: (producer) =>
      cache.get(`producer:${producer}`, async () => {
        const key = parseKey(producer);
        if (!key) throw new RequestError("wallet is not a valid public key", 400);
        const rows = await withFields(await program.account.farmProject.all([projectsByProducer(key)]));
        return rows.sort((a, b) => (BigInt(b.projectId) > BigInt(a.projectId) ? 1 : -1));
      }),

    unpooledProjects: () =>
      lists.get("unpooled", async () => withFields(await program.account.farmProject.all([projectsWithoutPool()]))),

    investor: (wallet) =>
      cache.get(`investor:${wallet}`, async () => {
        const owner = parseKey(wallet);
        if (!owner) throw new RequestError("wallet is not a valid public key", 400);
        const pools = await listPools();
        const record = await program.account.investorRecord.fetchNullable(investorPda(programId, owner));
        const atas = pools.map((p) => getAssociatedTokenAddressSync(new PublicKey(p.mint), owner, false, TOKEN_2022_PROGRAM_ID));
        const usdcAta = getAssociatedTokenAddressSync(usdcMint, owner, false, TOKEN_PROGRAM_ID);
        const [infos, lamports] = await Promise.all([
          connection.getMultipleAccountsInfo([...atas, usdcAta], "confirmed"),
          connection.getBalance(owner, "confirmed"),
        ]);
        const positions = pools.map((p, i) => {
          const info = infos[i];
          const ata = atas[i] as PublicKey;
          const acc = info ? unpackAccount(ata, info, TOKEN_2022_PROGRAM_ID) : null;
          return {
            poolId: p.poolId,
            pool: p.address,
            symbol: p.instrument?.symbol ?? `POOL-${p.poolId}`,
            status: p.status,
            yieldBps: p.yieldBps,
            ata: ata.toBase58(),
            exists: acc !== null,
            frozen: acc?.isFrozen ?? true,
            balance: (acc?.amount ?? 0n).toString(),
            atMaturity: redemptionDue(acc?.amount ?? 0n, { yieldBps: p.yieldBps, maturityTs: p.maturityTs }, p.terms ?? null).toString(),
          };
        });
        const usdcInfo = infos[atas.length];
        const usdc = usdcInfo ? unpackAccount(usdcAta, usdcInfo, TOKEN_PROGRAM_ID).amount : 0n;
        return {
          wallet: owner.toBase58(),
          approved: record?.approved ?? false,
          approvedAt: record?.approved ? record.approvedAt.toNumber() : null,
          usdcBalance: usdc.toString(),
          solLamports: lamports,
          positions,
        };
      }),

    holders: (mint) =>
      lists.get(`holders:${mint}`, async () => {
        const key = parseKey(mint);
        if (!key) throw new RequestError("mint is not a valid public key", 400);
        let accounts: ReturnType<typeof unpackAccount>[];
        try {
          const rows = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, { commitment: "confirmed", filters: [{ memcmp: { offset: 0, bytes: key.toBase58() } }] });
          accounts = rows.map((r) => unpackAccount(r.pubkey, r.account, TOKEN_2022_PROGRAM_ID));
        } catch {
          // The public devnet RPC refuses Token-2022 program scans; its 20 largest accounts cover a pilot pool.
          const largest = (await connection.getTokenLargestAccounts(key, "confirmed")).value.filter((v) => v.amount !== "0");
          const infos = largest.length ? await connection.getMultipleAccountsInfo(largest.map((v) => v.address), "confirmed") : [];
          accounts = infos.flatMap((info, i) => (info ? [unpackAccount(largest[i]!.address, info, TOKEN_2022_PROGRAM_ID)] : []));
        }
        return accounts
          .filter((a) => a.amount > 0n)
          .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0))
          .map((a) => ({ wallet: a.owner.toBase58(), balance: a.amount.toString() }));
      }),

    poolAttestations: (poolId) =>
      cache.get(`attestations:${poolId}`, async () => {
        if (!/^\d{1,20}$/.test(poolId)) return [];
        const address = poolPda(programId, BigInt(poolId));
        const projects = await program.account.farmProject.all([projectsInPool(address)]);
        const perProject = await Promise.all(projects.map((p) => program.account.attestation.all([attestationsOfProject(p.publicKey)])));
        return perProject
          .flat()
          .map((a) => toAttestationView(a.publicKey, a.account))
          .sort((a, b) => a.recordedAt - b.recordedAt || a.sequence - b.sequence);
      }),

    fees: () =>
      cache.get("fees", async () => {
        const fc = await program.account.feeConfig.fetchNullable(feesPda(programId));
        if (!fc) return null;
        // The treasury may be a PDA (off-curve); the program derives its ATA either way.
        const ata = getAssociatedTokenAddressSync(usdcMint, fc.treasury, true, TOKEN_PROGRAM_ID);
        const [info] = await connection.getMultipleAccountsInfo([ata], "confirmed");
        const balance = info ? unpackAccount(ata, info, TOKEN_PROGRAM_ID).amount : 0n;
        return {
          treasury: fc.treasury.toBase58(),
          networkFee: fc.networkFee.toString(),
          mintFee: fc.mintFee.toString(),
          maxArrangementBps: fc.maxArrangementBps,
          treasuryUsdc: balance.toString(),
        };
      }),

    approvedWallets: async (wallets) => {
      if (wallets.length === 0) return [];
      const records = await program.account.investorRecord.fetchMultiple(wallets.map((w) => investorPda(programId, new PublicKey(w))));
      return wallets.filter((_, i) => records[i]?.approved === true);
    },

    invalidate: () => {
      cache.clear();
      lists.clear();
    },
  };
}
