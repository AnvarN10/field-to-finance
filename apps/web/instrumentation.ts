import * as Sentry from "@sentry/nextjs";
import { SENTRY_BASE, scrubEvent } from "./src/lib/observability";

export async function register() {
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
