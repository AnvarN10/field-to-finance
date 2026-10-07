export interface SentryLikeEvent {
  request?: { url?: string; cookies?: unknown; headers?: Record<string, string>; data?: unknown; query_string?: unknown };
  user?: unknown;
  [k: string]: unknown;
}

const DROP_HEADERS = new Set(["cookie", "authorization", "x-forwarded-for", "x-real-ip"]);

// Console invitation links carry their secret in the path (/invite/<token>).
const INVITE = /\/invite\/[^/?#"\s]+/g;
const hideInvite = (v: unknown) => (typeof v === "string" ? v.replace(INVITE, "/invite/[token]") : v);

/** GlitchTip must never receive the admin cookie, KYC form values or wallet-identifying query strings. */
export function scrubEvent<T extends SentryLikeEvent>(event: T): T {
  if (event.request) {
    const { url, headers } = event.request;
    event.request = {
      ...(url ? { url: hideInvite(url.split("?")[0]) as string } : {}),
      ...(headers ? { headers: Object.fromEntries(Object.entries(headers).filter(([k]) => !DROP_HEADERS.has(k.toLowerCase()))) } : {}),
    };
  }
  delete event.user;
  const e: SentryLikeEvent = event;
  if (e.transaction) e.transaction = hideInvite(e.transaction);
  const crumbs = event.breadcrumbs as { message?: unknown; data?: Record<string, unknown> }[] | undefined;
  for (const b of Array.isArray(crumbs) ? crumbs : []) {
    b.message = hideInvite(b.message);
    if (b.data) for (const k of Object.keys(b.data)) b.data[k] = hideInvite(b.data[k]);
  }
  // Driver errors (postgres-js) carry `query` and `parameters` (BIN, legal names, KYC answers); the
  // extra-error-data integration copies such properties into `extra` and mechanism data. Drop both.
  delete event.extra;
  const exc = event.exception as { values?: { mechanism?: { data?: unknown } }[] } | undefined;
  for (const v of exc?.values ?? []) if (v.mechanism) delete v.mechanism.data;
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
