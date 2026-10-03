import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { SENTRY_BASE, posthogOptions, scrubEvent } from "./src/lib/observability";
import { publicEnv } from "./src/lib/public-env";

if (publicEnv.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: publicEnv.NEXT_PUBLIC_SENTRY_DSN,
    environment: publicEnv.NEXT_PUBLIC_APP_ENV === "prod" ? "devnet" : "development",
    ...SENTRY_BASE,
    beforeSend: (event) => scrubEvent(event as never),
  });
}

if (publicEnv.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(
    publicEnv.NEXT_PUBLIC_POSTHOG_KEY,
    posthogOptions(publicEnv.NEXT_PUBLIC_APP_ENV, publicEnv.NEXT_PUBLIC_POSTHOG_HOST) as never,
  );
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
