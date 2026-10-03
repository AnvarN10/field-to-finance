import * as Sentry from "@sentry/node";

let enabled = false;

/** GlitchTip, organization `personal`, speaks the Sentry protocol. No DSN means console only. */
export function initSentry(opts: { dsn?: string; environment: string }): void {
  if (!opts.dsn) return;
  Sentry.init({ dsn: opts.dsn, environment: opts.environment, tracesSampleRate: 0 });
  enabled = true;
}

export function reportError(err: unknown): void {
  console.error(err instanceof Error ? `${err.name}: ${err.message}` : err);
  if (enabled) Sentry.captureException(err);
}

export async function flushSentry(): Promise<void> {
  if (enabled) await Sentry.flush(2000);
}
