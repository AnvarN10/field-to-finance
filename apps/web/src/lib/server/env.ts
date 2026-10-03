import "server-only";
import { parseServerEnv, type ServerEnv } from "../env";

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
