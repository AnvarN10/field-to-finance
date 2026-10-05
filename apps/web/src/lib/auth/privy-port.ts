import type { PrivyPort } from "./session";

export interface PrivyPortConfig {
  appId: string | undefined;
  appSecret: string | undefined;
  /** F2F_DEV_AUTH: local screenshots and scripts sign in with `dev:<email>`; never honoured in production. */
  devAuth: boolean;
  nodeEnv: string | undefined;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEV_TTL_SECONDS = 3600;

function devPort(): PrivyPort {
  return {
    async verify(token) {
      const email = token.startsWith("dev:") ? token.slice(4).trim().toLowerCase() : "";
      if (!EMAIL.test(email)) throw new Error("invalid dev token");
      return { did: `did:dev:${email}`, expiresAt: Math.floor(Date.now() / 1000) + DEV_TTL_SECONDS };
    },
    async profile(did) {
      return { email: did.startsWith("did:dev:") ? did.slice(8) : null, solanaWallets: [] };
    },
  };
}

type PrivyUser = {
  email?: { address: string } | null;
  linkedAccounts?: { type: string; chainType?: string; walletClientType?: string; address?: string }[];
};

/** @privy-io/server-auth adapter: local JWT verification of access tokens, user lookup with the app secret. */
function privyServerPort(appId: string, appSecret: string): PrivyPort {
  let client: Promise<{ verifyAuthToken(t: string): Promise<{ userId: string; expiration: number }>; getUserById(id: string): Promise<PrivyUser> }> | undefined;
  const get = () => (client ??= import("@privy-io/server-auth").then(({ PrivyClient }) => new PrivyClient(appId, appSecret) as never));
  return {
    async verify(token) {
      const claims = await (await get()).verifyAuthToken(token);
      return { did: claims.userId, expiresAt: claims.expiration };
    },
    async profile(did) {
      const user = await (await get()).getUserById(did);
      const solanaWallets = (user.linkedAccounts ?? [])
        .filter((a) => a.type === "wallet" && a.chainType === "solana" && a.walletClientType === "privy" && typeof a.address === "string")
        .map((a) => a.address as string);
      return { email: user.email?.address ?? null, solanaWallets };
    },
  };
}

function unconfigured(missing: string[]): PrivyPort {
  const fail = async (): Promise<never> => {
    throw new Error(`Privy is not configured: set ${missing.join(" and ")}`);
  };
  return { verify: fail, profile: fail };
}

export function createPrivyPort(c: PrivyPortConfig): PrivyPort {
  if (c.devAuth && c.nodeEnv !== "production") return devPort();
  const missing = [!c.appId && "NEXT_PUBLIC_PRIVY_APP_ID", !c.appSecret && "PRIVY_APP_SECRET"].filter((v): v is string => Boolean(v));
  if (missing.length) return unconfigured(missing);
  return privyServerPort(c.appId as string, c.appSecret as string);
}
