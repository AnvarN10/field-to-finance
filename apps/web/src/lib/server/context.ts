import "server-only";
import { Connection, PublicKey } from "@solana/web3.js";
import { createProgram } from "../chain/program";
import { createChainReader, type ChainReader } from "../chain/reader";
import { S3Store, type BlobStore } from "../store";
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
