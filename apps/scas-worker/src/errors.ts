/** A problem with the caller's request. Never retried, never reported as a crash. */
export class RequestError extends Error {
  override name = "RequestError";
  readonly status: 400 | 404 | 409 | 422;

  constructor(message: string, status: 400 | 404 | 409 | 422 = 400) {
    super(message);
    this.status = status;
  }
}

export interface SentinelErrorOptions {
  retryable: boolean;
  status?: number;
  retryAfterMs?: number;
  cause?: unknown;
}

/** The Statistical API or the CDSE token endpoint failed. No Attestation may be signed. */
export class SentinelError extends Error {
  override name = "SentinelError";
  readonly retryable: boolean;
  readonly status: number | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(message: string, opts: SentinelErrorOptions) {
    super(message, { cause: opts.cause });
    this.retryable = opts.retryable;
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
  }
}
