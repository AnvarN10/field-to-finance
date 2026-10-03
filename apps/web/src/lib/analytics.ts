import posthog from "posthog-js";

export type AnalyticsEvent = "tx_succeeded" | "tx_failed" | "kyc_approved" | "faucet_used" | "fields_uploaded" | "farmer_login";

/** Product events only: never wallet addresses, emails, names or amounts tied to a person. */
export function track(event: AnalyticsEvent, props: Record<string, string | number | boolean> = {}): void {
  if (typeof window === "undefined" || !posthog.__loaded) return;
  posthog.capture(event, props);
}
