import type { QualitySpec } from "@f2f/sdk";
import { CircleAlert, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { InstrumentTermsView, PoolView } from "../../lib/chain/views";
import { formatDateUtc, formatTonnes, formatUsd, formatUsdDown, formatYield, relativeTime, shortKey } from "../../lib/format";
import {
  couponLabel,
  instrumentTypeLabel,
  interestDays,
  payoutForTokens,
  settlementStatus,
  tokenCount,
  tokenizedKgOf,
} from "../../lib/instrument-terms";
import type { RequirementRow } from "../../lib/pilot-docs";
import { ExplorerLink } from "../explorer-link";

/** Term-sheet sections of the Instrument card for pools with InstrumentTerms (ADR 0014). */

function Terms({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <dl className="tabular grid grid-cols-[minmax(0,auto)_1fr] gap-x-4 gap-y-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Status({ ok, okLabel, pendingLabel }: { ok: boolean; okLabel: string; pendingLabel: string }) {
  const Icon = ok ? CircleCheck : CircleAlert;
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${ok ? "text-success" : "text-foreground"}`}>
      <Icon aria-hidden strokeWidth={1.5} className="size-4 shrink-0" />
      {ok ? okLabel : pendingLabel}
    </span>
  );
}

export function IssuerSection({ pool, kycApproved, cluster }: { pool: PoolView; kycApproved: boolean; cluster: string }) {
  return (
    <>
      <Terms
        rows={[
          ["Issuer of record", <ExplorerLink key="i" kind="address" value={pool.issuer} cluster={cluster} />],
          ["KYC", <Status key="k" ok={kycApproved} okLabel="KYC passed" pendingLabel="KYC pending" />],
        ]}
      />
      <p className="text-muted-foreground">
        The farmer issues the instrument and carries the obligation at maturity. Field-to-Finance arranges the issue and runs the platform; the offer contract is between CommodityChain and the issuer.
      </p>
    </>
  );
}

export function InstrumentSection({ pool, terms }: { pool: PoolView; terms: InstrumentTermsView }) {
  const tokens = tokenCount(pool.targetAmount, terms);
  const days = interestDays(pool, terms);
  return (
    <>
      <Terms
        rows={[
          ["Type", instrumentTypeLabel(terms.settlementMode)],
          ["Currency", "USD, settled in USDC"],
          ["Nominal per token", formatUsd(terms.unitNominal)],
          ["Number of tokens", tokens.toString()],
          ["Issue size", formatUsd(pool.targetAmount)],
          ["Coupon", couponLabel(terms)],
          ["Interest from", formatDateUtc(terms.startTs)],
          [
            "Maturity",
            <span key="m">
              {formatDateUtc(pool.maturityTs)} <span className="text-muted-foreground">({relativeTime(pool.maturityTs)})</span>
            </span>,
          ],
          ["Interest period", `${days} day${days === 1 ? "" : "s"}`],
          ["Paid at maturity", <span key="p" className="font-medium text-primary">{`${formatUsdDown(payoutForTokens(pool, terms, 1n))} per token`}</span>],
        ]}
      />
      <p className="text-muted-foreground">{`Interest is principal × ${formatYield(terms.couponBpsAnnual)} × actual days / 360, rounded down, the same for every holder.`}</p>
    </>
  );
}

export function SettlementSection({ pool, terms, nowSec }: { pool: PoolView; terms: InstrumentTermsView; nowSec: number }) {
  const s = settlementStatus(pool, terms, nowSec);
  const delivery = terms.settlementMode !== "CashBuyback";
  return (
    <>
      <p>{s.label}</p>
      {delivery ? (
        <Terms
          rows={[
            ["Elevator receipt", <Status key="r" ok={terms.receiptHash !== null} okLabel={`Recorded ${shortKey(terms.receiptHash ?? "")}`} pendingLabel="Not recorded" />],
            ["Lab certificate", <Status key="l" ok={terms.labPassed} okLabel={`Passed ${shortKey(terms.labCertHash ?? "")}`} pendingLabel={terms.labCertHash ? "Did not pass" : "Not recorded"} />],
            ["Grain claimed", formatTonnes(terms.deliveredKg)],
          ]}
        />
      ) : null}
      <p className="text-muted-foreground">
        {terms.settlementMode === "Hybrid"
          ? "Buyback: holders burn tokens for principal plus coupon in USDC. Delivery: holders burn tokens for a Grain Claim on the elevator, pro rata to the tokenized volume."
          : delivery
            ? "Holders burn tokens for a Grain Claim on the elevator, pro rata to the tokenized volume."
            : "Holders burn tokens for principal plus coupon in USDC."}
      </p>
    </>
  );
}

export function CommoditySection({ spec, terms }: { spec: QualitySpec | null; terms: InstrumentTermsView }) {
  if (!spec) {
    return <p className="text-muted-foreground">{`Quality spec ${shortKey(terms.qualitySpecHash)} could not be loaded.`}</p>;
  }
  return (
    <>
      <p>{`${spec.crop.charAt(0).toUpperCase()}${spec.crop.slice(1)}, ${spec.class}`}</p>
      <div className="overflow-x-auto" role="region" aria-label="Commodity specification table" tabIndex={0}>
        <table aria-label="Commodity specification" className="tabular w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">Parameter</th>
              <th className="py-2 font-medium">Requirement</th>
            </tr>
          </thead>
          <tbody>
            {spec.parameters.map((p) => (
              <tr key={p.key} className="border-b border-border last:border-0">
                <td className="py-2 pr-4">{p.label}</td>
                <td className="py-2">{p.requirement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground">
        {"Spec hash "}
        <span className="font-mono text-xs">{shortKey(terms.qualitySpecHash)}</span>
        {" is stored on-chain; the lab certifies delivered grain against it."}
      </p>
    </>
  );
}

export function VolumeSection({ terms }: { terms: InstrumentTermsView }) {
  return (
    <Terms
      rows={[
        ["Contracted volume", formatTonnes(terms.volumeKg)],
        ["Tokenized share", `${formatYield(terms.tokenizedShareBps)} (${formatTonnes(tokenizedKgOf(terms))})`],
        ["Delivery elevator", terms.elevator],
        ["Laboratory", terms.lab],
      ]}
    />
  );
}

export function RequirementsSection({ requirements }: { requirements: RequirementRow[] }) {
  return (
    <>
      <ul aria-label="Farmer requirements" className="flex flex-col divide-y divide-border">
        {requirements.map((r) => (
          <li key={r.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
            <span>{r.label}</span>
            <Status ok={r.status === "provided"} okLabel="Provided" pendingLabel="Pending" />
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">Documents are held off-chain by the arranger; only their hashes are recorded. No personal data is on-chain.</p>
    </>
  );
}
