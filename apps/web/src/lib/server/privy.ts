import "server-only";
import { createPrivyPort } from "../auth/privy-port";
import type { PrivyPort } from "../auth/session";
import { serverEnv } from "./env";

let port: PrivyPort | undefined;

export function getPrivy(): PrivyPort {
  const e = serverEnv();
  port ??= createPrivyPort({ appId: e.NEXT_PUBLIC_PRIVY_APP_ID, appSecret: e.PRIVY_APP_SECRET, devAuth: e.F2F_DEV_AUTH, nodeEnv: process.env.NODE_ENV });
  return port;
}
