import * as Sentry from "@sentry/nextjs";
import { assertRoleKeys } from "./lib/keys";
import { SENTRY_BASE, scrubEvent } from "./lib/observability";

export async function register() {
  // A set but malformed role key fails the boot with the variable name (never the value), so a bad deploy
  // never reaches SUCCESS on Railway.
  if (process.env.NEXT_RUNTIME === "nodejs") assertRoleKeys(process.env);
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? "development",
    ...SENTRY_BASE,
    beforeSend: (event) => scrubEvent(event as never),
  });
}

export const onRequestError = Sentry.captureRequestError;
