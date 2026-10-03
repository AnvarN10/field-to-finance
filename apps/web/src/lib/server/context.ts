import "server-only";
import { Connection, PublicKey } from "@solana/web3.js";
import { createProgram } from "../chain/program";
import { createChainReader, type ChainReader } from "../chain/reader";
import { serverEnv } from "./env";

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
