import { z } from "zod";

export const COUNTRIES = ["Kazakhstan", "United States", "United Kingdom", "Germany", "Singapore", "United Arab Emirates", "Other"] as const;

/** Mock KYC: validated, then discarded. No personal data is stored, logged or sent to analytics. */
export const kycFormSchema = z.object({
  wallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "connect a wallet first"),
  fullName: z.string().trim().min(2, "enter your full name").max(80),
  country: z.enum(COUNTRIES, { error: "choose a country" }),
  email: z.email({ error: "enter a valid email" }),
  eligible: z.literal(true, { error: "confirm you are an eligible investor" }),
  demoConsent: z.literal(true, { error: "confirm you understand this is a devnet demo" }),
});
export type KycForm = z.infer<typeof kycFormSchema>;
