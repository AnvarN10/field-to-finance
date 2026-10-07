export const dynamic = "force-dynamic";

// Instant mock KYC is gone: investors onboard in the investor cabinet and an arranger approves them (ADR 0016).
export async function POST() {
  return Response.json(
    {
      ok: false,
      error: { code: "KycMoved", title: "KYC moved to the investor app", detail: "Open an investor account at /invest/signup; compliance reviews your KYC.", action: "onboarding" },
    },
    { status: 410 },
  );
}
