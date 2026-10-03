import { BadgeCheck, Banknote, FileSignature, Landmark, Map, ShieldCheck, Sprout } from "lucide-react";

export const DEAL_STEPS = [
  { Icon: Map, title: "Fields registered", body: "The farmer uploads field boundaries and asks for financing." },
  { Icon: BadgeCheck, title: "Fields verified", body: "SCAS attests each field on Solana. Evidence is public and hash-linked." },
  { Icon: FileSignature, title: "Pool issued", body: "The Issuer packages verified farms into one Instrument, for example WHEAT-2027." },
  { Icon: ShieldCheck, title: "Investors approved", body: "Instrument accounts start frozen. KYC thaws them." },
  { Icon: Banknote, title: "Pool funded", body: "Investors pay USDC and receive the Instrument in the same transaction." },
  { Icon: Sprout, title: "Season attested", body: "Sowing, vegetation and harvest are attested as the season runs." },
  { Icon: Landmark, title: "Pool settled", body: "Investors redeem principal plus the fixed yield after maturity." },
];

const TRACK = "absolute left-[11px] top-3 bottom-3 w-px xl:inset-x-3 xl:top-[11px] xl:bottom-auto xl:h-px xl:w-auto";

/**
 * The seven-step deal path as a rail: vertical on narrow screens, horizontal from 1280px.
 * Rendered complete (rail filled, every step lit); LandingMotion scrubs the fill and lights the steps
 * with scroll when motion is allowed.
 */
export function DealPath() {
  return (
    <div data-rail className="flex flex-col gap-8">
      <ol className="relative grid gap-8 xl:grid-cols-7 xl:gap-6">
        <span aria-hidden className={`${TRACK} bg-border`} />
        <span aria-hidden data-rail-fill className={`${TRACK} origin-top bg-primary xl:origin-left`} />
        {DEAL_STEPS.map(({ Icon, title, body }, i) => (
          <li key={title} data-rail-step className="relative flex flex-col gap-2 pl-10 xl:pt-10 xl:pl-0">
            <span aria-hidden className="absolute top-0 left-0 grid size-6 place-items-center rounded-full border border-border bg-card">
              <span data-rail-dot className="size-2.5 rounded-full bg-primary" />
            </span>
            <span className="tabular text-xs text-muted-foreground">Step {i + 1}</span>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Icon aria-hidden strokeWidth={1.5} className="size-4 shrink-0 text-primary" />
              {title}
            </h3>
            <p className="text-sm text-pretty text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">Every step is a Solana transaction you can open in Explorer.</p>
    </div>
  );
}
