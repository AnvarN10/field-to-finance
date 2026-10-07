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

/** Each status in the farmer's words: what is happening and who does it, never the platform's instruction. */
const FARMER_LINE: Record<ApplicationStatus, string> = {
  draft: "Complete the application, upload the documents and fields, then submit",
  submitted: "Submitted: F2F starts the document review",
  documents_review: "F2F is reviewing your documents",
  kyc: "Compliance is reviewing your issuer KYC",
  field_verification: "The SCAS partner is verifying your fields by satellite",
  structuring: "F2F is building the term sheet for your pool",
  ready: "Your pool is about to open to investors",
  open: "Investors are subscribing to your pool",
  funded: "Your pool is funded; the proceeds are on their way",
  disbursed: "Proceeds paid: grow the crop; season checks follow",
  in_season: "Season checks continue until harvest",
  harvest: "Harvest: F2F records the settlement",
  settlement: "Fund the buyback or deliver the grain",
  closed: "Closed: nothing left to do",
  rejected: "F2F declined this application",
  withdrawn: "You withdrew this application",
};

export const farmerStatusLine = (s: ApplicationStatus) => FARMER_LINE[s];

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
  if (latest.status === "settlement" || latest.status === "disbursed") return { title: FARMER_LINE[latest.status], owner: "you", href: latest.status === "settlement" ? "/issuer/obligations" : `/issuer/applications/${latest.id}`, label: latest.status === "settlement" ? "Open obligations" : "Open the application" };
  const owner = info.owner === "farmer" ? "you" : (OWNER[latest.status] ?? (info.owner === "arranger" ? "F2F arranger" : info.owner === null ? "Nobody" : "Investors"));
  return { title: FARMER_LINE[latest.status], owner, href: `/issuer/applications/${latest.id}`, label: "Open the application" };
}
