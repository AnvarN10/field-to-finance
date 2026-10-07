import { describe, expect, it } from "vitest";
import { farmerStatusLine, nextAction } from "../src/lib/issuer-next-action";

describe("nextAction", () => {
  it("starts with the company profile, then issuer KYC", () => {
    expect(nextAction(false, "not_started", null)).toMatchObject({ owner: "you", href: "/issuer/company", label: "Complete the company profile" });
    expect(nextAction(true, "not_started", null)).toMatchObject({ owner: "you", href: "/issuer/company", label: "Submit issuer KYC" });
    expect(nextAction(true, "rejected", null)).toMatchObject({ owner: "you", href: "/issuer/company" });
  });

  it("asks for the first application once KYC is submitted", () => {
    expect(nextAction(true, "pending", null)).toMatchObject({ owner: "you", href: "/issuer/applications/new", label: "Start an application" });
  });

  it("follows the newest application: the farmer's own steps link to it, others name the owner", () => {
    expect(nextAction(true, "approved", { id: "a1", status: "draft" })).toMatchObject({ owner: "you", href: "/issuer/applications/a1" });
    expect(nextAction(true, "approved", { id: "a1", status: "documents_review" })).toMatchObject({ owner: "F2F arranger", href: "/issuer/applications/a1" });
    expect(nextAction(true, "approved", { id: "a1", status: "field_verification" })).toMatchObject({ owner: "SCAS partner" });
    expect(nextAction(true, "approved", { id: "a1", status: "kyc" })).toMatchObject({ owner: "Compliance" });
    expect(nextAction(true, "approved", { id: "a1", status: "settlement" })).toMatchObject({ owner: "you", href: "/issuer/obligations" });
    expect(nextAction(true, "approved", { id: "a1", status: "open" })).toMatchObject({ owner: "Investors" });
  });
});

describe("farmer-voiced status lines", () => {
  it("never tells the farmer to do the platform's step", () => {
    expect(nextAction(true, "approved", { id: "a1", status: "documents_review" }).title).toBe("F2F is reviewing your documents");
    expect(farmerStatusLine("field_verification")).toBe("The SCAS partner is verifying your fields by satellite");
    expect(farmerStatusLine("draft")).toMatch(/submit/i);
    for (const s of ["submitted", "documents_review", "kyc", "field_verification", "structuring", "ready", "funded", "harvest"] as const) expect(farmerStatusLine(s)).not.toMatch(/^(Accept|Verify|Decide|Build|Publish|Disburse|Record|Start)/);
  });
});
