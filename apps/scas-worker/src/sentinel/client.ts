import { SentinelError } from "../errors";
import type { StatsRequest } from "./request";

export const CDSE_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
export const CDSE_STATS_URL = "https://sh.dataspace.copernicus.eu/statistics/v1";

const TOKEN_MARGIN_S = 60;
const MAX_RETRY_AFTER_MS = 30_000;

export interface StatsSource {
  fetchStats(request: StatsRequest): Promise<unknown>;
}

export interface SentinelClientOptions {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  maxAttempts?: number;
  baseDelayMs?: number;
}

export class SentinelClient implements StatsSource {
  private token: { value: string; expiresAt: number } | null = null;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;

  constructor(private readonly opts: SentinelClientOptions) {
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = opts.now ?? Date.now;
    this.maxAttempts = opts.maxAttempts ?? 4;
    this.baseDelayMs = opts.baseDelayMs ?? 500;
  }

  async fetchStats(request: StatsRequest): Promise<unknown> {
    return this.withRetry(async () => {
      const token = await this.getToken();
      const res = await this.call(CDSE_STATS_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(request),
      });
      if (res.status === 401) {
        this.token = null;
        throw new SentinelError("Statistical API rejected the access token", { retryable: true, status: 401 });
      }
      await this.throwIfFailed(res, "Statistical API");
      return (await res.json()) as unknown;
    });
  }

  private async getToken(): Promise<string> {
    if (this.token && this.now() < this.token.expiresAt) return this.token.value;
    const res = await this.call(CDSE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.opts.clientId,
        client_secret: this.opts.clientSecret,
      }).toString(),
    });
    await this.throwIfFailed(res, "CDSE token endpoint");
    const body = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof body.access_token !== "string") {
      throw new SentinelError("CDSE token response has no access_token", { retryable: false });
    }
    const ttlSeconds = typeof body.expires_in === "number" ? body.expires_in : 300;
    this.token = {
      value: body.access_token,
      expiresAt: this.now() + Math.max(ttlSeconds - TOKEN_MARGIN_S, 10) * 1000,
    };
    return this.token.value;
  }

  private async call(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetchImpl(url, init);
    } catch (cause) {
      throw new SentinelError(`network error calling ${new URL(url).host}`, { retryable: true, cause });
    }
  }

  private async throwIfFailed(res: Response, what: string): Promise<void> {
    if (res.ok) return;
    const text = (await res.text().catch(() => "")).slice(0, 300);
    const retryAfterS = Number(res.headers.get("retry-after"));
    throw new SentinelError(`${what} returned ${res.status}: ${text}`, {
      retryable: res.status === 429 || res.status >= 500,
      status: res.status,
      retryAfterMs:
        Number.isFinite(retryAfterS) && retryAfterS > 0 ? Math.min(retryAfterS * 1000, MAX_RETRY_AFTER_MS) : undefined,
    });
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        if (!(err instanceof SentinelError) || !err.retryable || attempt >= this.maxAttempts) {
          throw err instanceof SentinelError ? err : new SentinelError(String(err), { retryable: false, cause: err });
        }
        await this.sleep(err.retryAfterMs ?? this.baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }
}
