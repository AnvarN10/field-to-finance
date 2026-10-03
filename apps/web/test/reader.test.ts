import { poolPda } from "@f2f/sdk";
import { ACCOUNT_SIZE, AccountLayout, AccountState, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, type AccountInfo } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { createChainReader } from "../src/lib/chain/reader";
import type { PoolAccount } from "../src/lib/chain/views";
import { fieldValue, offlineConnection, offlineProgram, poolValue, projectValue, roundTrip } from "./fixtures/accounts";

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
    expect(state.positions[0]).toMatchObject({ poolId: "7", exists: true, frozen: true, balance: "0" });
  });
});
