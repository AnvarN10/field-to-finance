import { STATUS_INFO, type ApplicationStatus } from "./application-status";
import type { KycStatus } from "./db/schema";

export type NextAction = { title: string; owner: string; href: string; label: string };

/** Who acts at each application status, in the farmer's words (the status machine says "arranger" for platform steps). */
const OWNER: Partial<Record<ApplicationStatus, string>> = {
  kyc: "Compliance",
  field_verification: "SCAS partner",
  open: "Investors",
  in_season: "Season checks",
};

/**
 * The one next step on the issuer overview (spec §8): company profile, then issuer KYC, then the first application,
 * then whatever the newest application waits for. Steps the farmer owns link to where they are done.
 */
export function nextAction(profileComplete: boolean, kyc: KycStatus, latest: { id: string; status: ApplicationStatus } | null): NextAction {
  if (!profileComplete) return { title: "Tell us about your company", owner: "you", href: "/issuer/company", label: "Complete the company profile" };
  if (kyc === "not_started" || kyc === "rejected")
    return { title: kyc === "rejected" ? "Issuer KYC was rejected: see the note and submit again" : "Your company becomes the issuer of record of its pool", owner: "you", href: "/issuer/company", label: "Submit issuer KYC" };
  if (!latest) return { title: "Apply for financing against next season's harvest", owner: "you", href: "/issuer/applications/new", label: "Start an application" };
  const info = STATUS_INFO[latest.status];
  if (latest.status === "settlement" || latest.status === "disbursed") return { title: info.next, owner: "you", href: latest.status === "settlement" ? "/issuer/obligations" : `/issuer/applications/${latest.id}`, label: latest.status === "settlement" ? "Open obligations" : "Open the application" };
  const owner = info.owner === "farmer" ? "you" : (OWNER[latest.status] ?? (info.owner === "arranger" ? "F2F arranger" : info.owner === null ? "Nobody" : "Investors"));
  return { title: info.next, owner, href: `/issuer/applications/${latest.id}`, label: "Open the application" };
}
