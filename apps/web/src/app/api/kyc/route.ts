export const dynamic = "force-dynamic";

// Instant mock KYC is gone: investors onboard in the investor cabinet and an arranger approves them (ADR 0016).
export async function POST() {
  return Response.json(
    {
      ok: false,
      error: { code: "KycMoved", title: "KYC moved to the investor cabinet", detail: "Sign in at /investor/onboarding; an arranger approves your KYC.", action: "onboarding" },
    },
    { status: 410 },
  );
}
