export interface SentryLikeEvent {
  request?: { url?: string; cookies?: unknown; headers?: Record<string, string>; data?: unknown; query_string?: unknown };
  user?: unknown;
  [k: string]: unknown;
}

const DROP_HEADERS = new Set(["cookie", "authorization", "x-forwarded-for", "x-real-ip"]);

/** GlitchTip must never receive the admin cookie, KYC form values or wallet-identifying query strings. */
export function scrubEvent<T extends SentryLikeEvent>(event: T): T {
  if (event.request) {
    const { url, headers } = event.request;
    event.request = {
      ...(url ? { url: url.split("?")[0] } : {}),
      ...(headers ? { headers: Object.fromEntries(Object.entries(headers).filter(([k]) => !DROP_HEADERS.has(k.toLowerCase()))) } : {}),
    };
  }
  delete event.user;
  return event;
}

export const SENTRY_BASE = { tracesSampleRate: 0 } as const;

interface PostHogLike {
  register(p: Record<string, unknown>): void;
  setPersonProperties(p: Record<string, unknown>): void;
}

export function posthogOptions(appEnv: "dev" | "prod", host: string) {
  return {
    api_host: host,
    defaults: "2025-05-24" as const,
    person_profiles: "always" as const,
    disable_session_recording: true,
    loaded: (ph: PostHogLike) => {
      // Global rule: environment targeting uses the person property app_env (dev / prod).
      ph.register({ app_env: appEnv });
      ph.setPersonProperties({ app_env: appEnv });
    },
  };
}
