import { BadgeCheck, Banknote, FileSignature, Landmark, Map, ShieldCheck, Sprout } from "lucide-react";

const STEPS = [
  { Icon: Map, title: "Fields registered", body: "The farmer uploads field boundaries and asks for financing." },
  { Icon: BadgeCheck, title: "Fields verified", body: "SCAS attests each field on Solana. Evidence is public and hash-linked." },
  { Icon: FileSignature, title: "Pool issued", body: "The Issuer packages verified farms into one Instrument, for example WHEAT-2027." },
  { Icon: ShieldCheck, title: "Investors approved", body: "Instrument accounts start frozen. KYC thaws them." },
  { Icon: Banknote, title: "Pool funded", body: "Investors pay USDC and receive the Instrument in the same transaction." },
  { Icon: Sprout, title: "Season attested", body: "Sowing, vegetation and harvest are attested as the season runs." },
  { Icon: Landmark, title: "Pool settled", body: "Investors redeem principal plus the fixed yield after maturity." },
];

export function DealPath() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map(({ Icon, title, body }, i) => (
        <li key={title} className="flex flex-col gap-2 bg-card p-6">
          <span className="tabular text-xs text-muted-foreground">Step {i + 1}</span>
          <Icon aria-hidden strokeWidth={1.5} className="size-5 text-primary" />
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{body}</p>
        </li>
      ))}
      {/* Eighth cell closes the 4-column grid instead of leaving a hole. */}
      <li className="hidden flex-col justify-end gap-2 bg-primary p-6 text-on-dark lg:flex">
        <span className="text-sm">Every step is a Solana transaction you can open in Explorer.</span>
      </li>
    </ol>
  );
}
