import {
  addProjectAction,
  attestStageAction,
  closeSubscriptionAction,
  disburseAllAction,
  fundRedemptionAction,
  openPoolAction,
  sweepAction,
} from "../../app/admin/actions";
import { SETTLEMENT_LABELS } from "../../lib/chain/enums";
import type { PoolDetail, ProjectWithFields } from "../../lib/chain/views";
import { formatDateUtc, formatUsd, formatYield, relativeTime, shortKey } from "../../lib/format";
import { closeSubscriptionBlocker, disburseBlocker, fundRedemptionBlocker, seasonAttestationBlocker } from "../../lib/pool-math";
import { ExplorerLink } from "../explorer-link";
import { PoolStatusBadge } from "../status-badge";
import { ActionButton } from "./action-button";
import { SettlementForm } from "./settlement-form";
import { TermSheetConsole } from "./term-sheet-console";
import { settlementStatus } from "../../lib/instrument-terms";
import { WalletActionForm } from "./wallet-action-form";

export function PoolConsole({ detail, unpooled, now }: { detail: PoolDetail; unpooled: ProjectWithFields[]; now: number }) {
  const { pool, projects } = detail;
  const id = pool.poolId;
  const s = pool.status;
  const full = BigInt(pool.raisedAmount) >= BigInt(pool.targetAmount) && BigInt(pool.targetAmount) > 0n;
  const closeReady = s === "Open" && (full || now >= pool.subscriptionCloseTs);
  const eligible = unpooled.filter((p) => p.crop === pool.crop && p.season === pool.season && p.fieldCount > 0 && p.verifiedFieldCount === p.fieldCount);
  const allDisbursed = projects.length > 0 && projects.every((p) => p.disbursed);
  const supply = BigInt(pool.instrument?.supply ?? "1");
  const seasonBlocker = seasonAttestationBlocker(s, projects.length);
  const closeBlocker = closeSubscriptionBlocker(s, closeReady);
  const disburseReason = disburseBlocker(s, allDisbursed);
  const terms = detail.terms ?? null;
  const deliveryApplies = terms ? settlementStatus(pool, terms, now).election === "Delivery" : false;
  const fundReason = deliveryApplies ? "Grain delivery applies: holders claim grain, not cash" : fundRedemptionBlocker(s);

  return (
    <section className="flex flex-col gap-6 rounded-lg border border-border bg-card p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{`${pool.instrument?.symbol ?? "Pool"} · #${id}`}</h2>
        <div className="flex items-center gap-3">
          <PoolStatusBadge status={s} />
          <ExplorerLink kind="address" value={pool.address} />
        </div>
      </header>
      <p className="tabular text-sm text-muted-foreground">
        {`${terms ? `Term sheet: farmer issuer, ${BigInt(pool.targetAmount) / BigInt(terms.unitNominal)} tokens of ${formatUsd(terms.unitNominal)}, coupon ${formatYield(terms.couponBpsAnnual)} Act/360. ` : ""}${formatUsd(pool.raisedAmount)} of ${formatUsd(pool.targetAmount)}. Closes ${formatDateUtc(pool.subscriptionCloseTs)} (${relativeTime(pool.subscriptionCloseTs, now * 1000)}). Matures ${formatDateUtc(pool.maturityTs)} (${relativeTime(pool.maturityTs, now * 1000)}). Arrangement fee ${formatYield(detail.arrangementFeeBps)}.`}
      </p>

      {/* min-w-0 lets long select options and inputs shrink instead of widening the page at 390px. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 [&>*]:min-w-0">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">1. Build the pool</h3>
          {eligible.length === 0 ? <p className="text-xs text-muted-foreground">No verified project with this crop and season is waiting.</p> : null}
          {eligible.map((p) => (
            <div key={p.address} className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                Project <ExplorerLink kind="address" value={p.address} />
              </span>
              <ActionButton
                label={`Add project ${shortKey(p.address)} (${formatUsd(p.requestedAmount)})`}
                role="Issuer"
                action={addProjectAction.bind(null, id, p.address)}
                disabled={s !== "Draft"}
                disabledReason={s !== "Draft" ? "Only a Draft pool accepts projects" : undefined}
              />
            </div>
          ))}
          <ActionButton label="Open pool" role="Issuer" action={openPoolAction.bind(null, id)} disabled={s !== "Draft" || pool.projectCount === 0} disabledReason={s !== "Draft" ? "Already opened" : pool.projectCount === 0 ? "Add a project first" : undefined} />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">2. Investors</h3>
          <WalletActionForm poolId={id} mode="approve" />
          <ActionButton label="Close subscription" role="Anyone" action={closeSubscriptionAction.bind(null, id)} disabled={closeBlocker !== undefined} disabledReason={closeBlocker} />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">3. Pay farmers and attest the season</h3>
          <ActionButton label="Disburse to every project" role="Issuer" action={disburseAllAction.bind(null, id)} disabled={disburseReason !== undefined} disabledReason={disburseReason} />
          {(["Sowing", "Vegetation", "Harvest"] as const).map((k) => (
            <ActionButton key={k} label={`Attest ${k.toLowerCase()} for all fields`} role="SCAS stub" action={attestStageAction.bind(null, id, k)} disabled={seasonBlocker !== undefined} disabledReason={seasonBlocker} />
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">4. Settle and redeem</h3>
          {projects.map((p) => (
            <div key={p.address} className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                Project <ExplorerLink kind="address" value={p.address} />
                {p.settlement ? `Settled: ${SETTLEMENT_LABELS[p.settlement]}` : null}
              </span>
              <SettlementForm
                poolId={id}
                project={p.address}
                disabledReason={p.settlement ? "Already settled" : !p.disbursed ? "Disburse first" : !p.harvestAttested && now < pool.maturityTs ? "Attest harvest first" : undefined}
              />
            </div>
          ))}
          <ActionButton label="Fund redemption" role="Issuer" action={fundRedemptionAction.bind(null, id)} disabled={fundReason !== undefined} disabledReason={fundReason} />
          <ActionButton label="Sweep vault remainder" role="Issuer" action={sweepAction.bind(null, id)} confirmText="Return the vault remainder to the Issuer?" disabled={s !== "Redeeming" || supply !== 0n} disabledReason={s !== "Redeeming" ? "Needs a Redeeming pool" : supply !== 0n ? "Investors still hold the Instrument" : undefined} />
          <WalletActionForm poolId={id} mode="revoke" />
        </div>

        {terms ? <TermSheetConsole pool={pool} terms={terms} now={now} /> : null}
      </div>
    </section>
  );
}
