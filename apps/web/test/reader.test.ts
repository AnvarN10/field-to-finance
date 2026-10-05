import { investorPda, poolPda } from "@f2f/sdk";
import { ACCOUNT_SIZE, AccountLayout, AccountState, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, type AccountInfo } from "@solana/web3.js";
import BN from "bn.js";
import { describe, expect, it, vi } from "vitest";
import { createChainReader } from "../src/lib/chain/reader";
import type { PoolAccount } from "../src/lib/chain/views";
import { fieldValue, offlineConnection, offlineProgram, poolValue, projectValue, roundTrip, termsValue } from "./fixtures/accounts";

function tokenAccount(mint: PublicKey, owner: PublicKey, amount: bigint, frozen: boolean, programId: PublicKey): AccountInfo<Buffer> {
  const data = Buffer.alloc(ACCOUNT_SIZE);
  AccountLayout.encode(
    {
      mint,
      owner,
      amount,
      delegateOption: 0,
      delegate: PublicKey.default,
      state: frozen ? AccountState.Frozen : AccountState.Initialized,
      isNativeOption: 0,
      isNative: 0n,
      delegatedAmount: 0n,
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    data,
  );
  return { data, owner: programId, lamports: 2_039_280, executable: false, rentEpoch: 0 };
}

async function setup() {
  const program = offlineProgram();
  const usdcMint = Keypair.generate().publicKey;
  const poolAddr = poolPda(program.programId, 7n);
  const pool = await roundTrip<PoolAccount>(program, "pool", poolValue());
  const project = await roundTrip(program, "farmProject", projectValue({ pool: poolAddr }));
  const projectAddr = Keypair.generate().publicKey;
  const field = await roundTrip(program, "field", fieldValue({ project: projectAddr }));
  vi.spyOn(program.account.pool, "all").mockResolvedValue([{ publicKey: poolAddr, account: pool.account }] as never);
  vi.spyOn(program.account.pool, "fetchNullable").mockResolvedValue(pool.account as never);
  vi.spyOn(program.account.farmProject, "all").mockResolvedValue([{ publicKey: projectAddr, account: project.account }] as never);
  vi.spyOn(program.account.field, "all").mockResolvedValue([{ publicKey: Keypair.generate().publicKey, account: field.account }] as never);
  vi.spyOn(program.account.investorRecord, "fetchNullable").mockResolvedValue(null);
  vi.spyOn(program.account.poolTerms, "fetchNullable").mockResolvedValue(null);
  vi.spyOn(program.account.feeConfig, "fetchNullable").mockResolvedValue(null);
  vi.spyOn(program.account.instrumentTerms, "fetchNullable").mockResolvedValue(null);
  vi.spyOn(program.account.instrumentTerms, "all").mockResolvedValue([]);
  const connection = offlineConnection;
  vi.spyOn(connection, "getMultipleAccountsInfo").mockResolvedValue([null]);
  vi.spyOn(connection, "getBalance").mockResolvedValue(5_000_000);
  const reader = createChainReader({ program, connection, usdcMint });
  return { program, connection, reader, poolAddr, pool, usdcMint };
}

describe("ChainReader", () => {
  it("returns a pool with its projects and fields", async () => {
    const { reader, poolAddr } = await setup();
    const detail = await reader.getPool("7");
    expect(detail?.pool.address).toBe(poolAddr.toBase58());
    expect(detail?.projects).toHaveLength(1);
    expect(detail?.projects[0]?.fields[0]?.areaHaX100).toBe(7611);
  });

  it("returns null for a malformed pool id instead of throwing", async () => {
    const { reader } = await setup();
    expect(await reader.getPool("abc")).toBeNull();
    expect(await reader.getField("not-a-key")).toBeNull();
  });

  it("caches reads until invalidated", async () => {
    const { reader, program } = await setup();
    await reader.listPools();
    await reader.listPools();
    expect(program.account.pool.all).toHaveBeenCalledTimes(1);
    reader.invalidate();
    await reader.listPools();
    expect(program.account.pool.all).toHaveBeenCalledTimes(2);
  });

  it("reports investor positions with the frozen flag and USDC balance", async () => {
    const { reader, connection, pool, usdcMint } = await setup();
    const wallet = Keypair.generate().publicKey;
    const mint = pool.account.mint;
    vi.mocked(connection.getMultipleAccountsInfo).mockImplementation(async (keys) =>
      keys.length === 1
        ? [null] // instrument mints in listPools
        : [tokenAccount(mint, wallet, 0n, true, TOKEN_2022_PROGRAM_ID), tokenAccount(usdcMint, wallet, 1_000_000_000n, false, TOKEN_PROGRAM_ID)],
    );
    const state = await reader.investor(wallet.toBase58());
    expect(state.approved).toBe(false);
    expect(state.usdcBalance).toBe("1000000000");
    expect(state.solLamports).toBe(5_000_000);
    expect(state.positions[0]).toMatchObject({ poolId: "7", exists: true, frozen: true, balance: "0", atMaturity: "0" });
  });

  it("reports a zero arrangement fee for pools without terms", async () => {
    const { reader } = await setup();
    expect((await reader.getPool("7"))?.arrangementFeeBps).toBe(0);
  });

  it("reads the pool's arrangement fee from its terms", async () => {
    const { reader, program } = await setup();
    vi.mocked(program.account.poolTerms.fetchNullable).mockResolvedValue({ arrangementFeeBps: 200, bump: 254 } as never);
    expect((await reader.getPool("7"))?.arrangementFeeBps).toBe(200);
  });

  it("has no instrument terms for older pools", async () => {
    const { reader } = await setup();
    const detail = await reader.getPool("7");
    expect(detail?.terms).toBeNull();
    expect((await reader.listPools())[0]?.terms).toBeNull();
  });

  it("reads instrument terms and the issuer of record's KYC for pilot pools", async () => {
    const { reader, program, poolAddr, pool } = await setup();
    const terms = await roundTrip(program, "instrumentTerms", termsValue({ pool: poolAddr }));
    vi.mocked(program.account.instrumentTerms.fetchNullable).mockResolvedValue(terms.account as never);
    vi.mocked(program.account.instrumentTerms.all).mockResolvedValue([{ publicKey: Keypair.generate().publicKey, account: terms.account }] as never);
    vi.mocked(program.account.investorRecord.fetchNullable).mockImplementation(async (addr) =>
      String(addr) === investorPda(program.programId, pool.account.issuer).toBase58() ? ({ approved: true } as never) : null,
    );
    const detail = await reader.getPool("7");
    expect(detail?.terms).toMatchObject({
      unitNominal: "100000000000",
      couponBpsAnnual: 500,
      dayCount: "Act360",
      settlementMode: "Hybrid",
      volumeKg: "10000000",
      tokenizedShareBps: 3_000,
      elevator: "Ust-Kamenogorsk",
      lab: "Baltic Control",
      election: null,
      receiptHash: null,
      labPassed: false,
    });
    expect(detail?.issuerKycApproved).toBe(true);
    expect((await reader.listPools())[0]?.terms?.couponBpsAnnual).toBe(500);
  });

  it("values a term-sheet position at maturity with the Act/360 coupon", async () => {
    const { reader, program, connection, pool, usdcMint, poolAddr } = await setup();
    const maturity = pool.account.maturityTs.toNumber();
    const terms = await roundTrip(program, "instrumentTerms", termsValue({ pool: poolAddr, startTs: new BN(maturity - 300 * 86_400) }));
    vi.mocked(program.account.instrumentTerms.all).mockResolvedValue([{ publicKey: Keypair.generate().publicKey, account: terms.account }] as never);
    const wallet = Keypair.generate().publicKey;
    vi.mocked(connection.getMultipleAccountsInfo).mockImplementation(async (keys) =>
      keys.length === 1 ? [null] : [tokenAccount(pool.account.mint, wallet, 100_000_000_000n, false, TOKEN_2022_PROGRAM_ID), tokenAccount(usdcMint, wallet, 0n, false, TOKEN_PROGRAM_ID)],
    );
    const state = await reader.investor(wallet.toBase58());
    expect(state.positions[0]?.atMaturity).toBe("104166666666");
  });

  it("lists which wallets hold an approved KYC record", async () => {
    const { reader, program } = await setup();
    const a = Keypair.generate().publicKey;
    const b = Keypair.generate().publicKey;
    vi.spyOn(program.account.investorRecord, "fetchMultiple").mockResolvedValue([{ approved: true }, null] as never);
    expect(await reader.approvedWallets([a.toBase58(), b.toBase58()])).toEqual([a.toBase58()]);
    expect(await reader.approvedWallets([])).toEqual([]);
  });

  it("returns null fees while FeeConfig does not exist", async () => {
    const { reader } = await setup();
    expect(await reader.fees()).toBeNull();
  });

  it("returns the fee config and the treasury's USDC balance", async () => {
    const { reader, program, connection, usdcMint } = await setup();
    const treasury = Keypair.generate().publicKey;
    vi.mocked(program.account.feeConfig.fetchNullable).mockResolvedValue({
      treasury,
      networkFee: { toString: () => "500000" },
      mintFee: { toString: () => "3000000" },
      maxArrangementBps: 1_000,
      bump: 255,
    } as never);
    vi.mocked(connection.getMultipleAccountsInfo).mockResolvedValue([tokenAccount(usdcMint, treasury, 3_500_000n, false, TOKEN_PROGRAM_ID)]);
    expect(await reader.fees()).toEqual({
      treasury: treasury.toBase58(),
      networkFee: "500000",
      mintFee: "3000000",
      maxArrangementBps: 1_000,
      treasuryUsdc: "3500000",
    });
  });

  it("lists a mint's holders with a balance, owner wallet first, from Token-2022 accounts", async () => {
    const { reader, connection } = await setup();
    const mint = Keypair.generate().publicKey;
    const a = Keypair.generate().publicKey;
    const b = Keypair.generate().publicKey;
    const spy = vi.spyOn(connection, "getProgramAccounts").mockResolvedValue([
      { pubkey: Keypair.generate().publicKey, account: tokenAccount(mint, a, 300n, false, TOKEN_2022_PROGRAM_ID) },
      { pubkey: Keypair.generate().publicKey, account: tokenAccount(mint, b, 0n, true, TOKEN_2022_PROGRAM_ID) },
    ] as never);
    expect(await reader.holders(mint.toBase58())).toEqual({ holders: [{ wallet: a.toBase58(), balance: "300" }], complete: true });
    const [programId, opts] = spy.mock.calls[0] as unknown as [PublicKey, { filters: { memcmp: { offset: number } }[] }];
    expect(programId.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
    expect(opts.filters[0]?.memcmp.offset).toBe(0);
  });

  it("falls back to the largest token accounts when the RPC refuses Token-2022 program scans (public devnet)", async () => {
    const { reader, connection } = await setup();
    const mint = Keypair.generate().publicKey;
    const a = Keypair.generate().publicKey;
    const accA = Keypair.generate().publicKey;
    const accB = Keypair.generate().publicKey;
    vi.spyOn(connection, "getProgramAccounts").mockRejectedValue(new Error("excluded from account secondary indexes"));
    vi.spyOn(connection, "getTokenLargestAccounts").mockResolvedValue({ context: { slot: 1 }, value: [{ address: accA, amount: "500", decimals: 6, uiAmount: 0.0005, uiAmountString: "0.0005" }, { address: accB, amount: "0", decimals: 6, uiAmount: 0, uiAmountString: "0" }] } as never);
    vi.mocked(connection.getMultipleAccountsInfo).mockResolvedValue([tokenAccount(mint, a, 500n, false, TOKEN_2022_PROGRAM_ID)]);
    expect(await reader.holders(mint.toBase58())).toEqual({ holders: [{ wallet: a.toBase58(), balance: "500" }], complete: true });
  });

  it("falls back to the platform's known wallets when both scans are refused", async () => {
    const { reader, connection } = await setup();
    const mint = Keypair.generate().publicKey;
    const a = Keypair.generate().publicKey;
    const b = Keypair.generate().publicKey;
    vi.spyOn(connection, "getProgramAccounts").mockRejectedValue(new Error("excluded from account secondary indexes"));
    vi.spyOn(connection, "getTokenLargestAccounts").mockRejectedValue(new Error("429 Too Many Requests"));
    vi.mocked(connection.getMultipleAccountsInfo).mockResolvedValue([tokenAccount(mint, a, 700n, false, TOKEN_2022_PROGRAM_ID), null]);
    expect(await reader.holders(mint.toBase58(), [a.toBase58(), b.toBase58()])).toEqual({ holders: [{ wallet: a.toBase58(), balance: "700" }], complete: false });
  });

  it("after a refused scan it goes straight to the known wallets for the next mint", async () => {
    const { reader, connection } = await setup();
    const a = Keypair.generate().publicKey;
    const scan = vi.spyOn(connection, "getProgramAccounts").mockRejectedValue(new Error("excluded from account secondary indexes"));
    const largest = vi.spyOn(connection, "getTokenLargestAccounts").mockRejectedValue(new Error("429 Too Many Requests"));
    vi.mocked(connection.getMultipleAccountsInfo).mockResolvedValue([null]);
    await reader.holders(Keypair.generate().publicKey.toBase58(), [a.toBase58()]);
    await reader.holders(Keypair.generate().publicKey.toBase58(), [a.toBase58()]);
    expect(scan).toHaveBeenCalledTimes(1);
    expect(largest).toHaveBeenCalledTimes(1);
  });

  it("twenty largest accounts may not be all of them: the list is marked incomplete", async () => {
    const { reader, connection } = await setup();
    const mint = Keypair.generate().publicKey;
    vi.spyOn(connection, "getProgramAccounts").mockRejectedValue(new Error("excluded from account secondary indexes"));
    const value = Array.from({ length: 20 }, () => ({ address: Keypair.generate().publicKey, amount: "5", decimals: 6, uiAmount: 0, uiAmountString: "0" }));
    vi.spyOn(connection, "getTokenLargestAccounts").mockResolvedValue({ context: { slot: 1 }, value } as never);
    vi.mocked(connection.getMultipleAccountsInfo).mockResolvedValue(value.map(() => tokenAccount(mint, Keypair.generate().publicKey, 5n, false, TOKEN_2022_PROGRAM_ID)));
    const r = await reader.holders(mint.toBase58());
    expect(r.holders).toHaveLength(20);
    expect(r.complete).toBe(false);
  });
});
