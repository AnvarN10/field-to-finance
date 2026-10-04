use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::F2fError,
    state::{Attestation, AttestationKind, Config, FarmProject, Field, InstrumentTerms, Pool, PoolStatus, SettlementElection, SettlementMode, Verdict},
};

/// Records an elevator receipt or a lab quality certificate for a delivery-settled pool. Writes a
/// normal Attestation on one of the pool's fields (so it shows in the timeline) and the evidence
/// hash into InstrumentTerms, which gates `redeem_delivery`. Signed by SCAS or the arranger.
#[derive(Accounts)]
pub struct RecordDelivery<'info> {
    #[account(mut, constraint = signer.key() == config.scas || signer.key() == config.issuer @ F2fError::Unauthorized)]
    pub signer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut, seeds = [INSTRUMENT_SEED, pool.key().as_ref()], bump = instrument_terms.bump)]
    pub instrument_terms: Account<'info, InstrumentTerms>,
    #[account(constraint = project.pool == Some(pool.key()) @ F2fError::ProjectNotInPool)]
    pub project: Account<'info, FarmProject>,
    #[account(mut, constraint = field.project == project.key() @ F2fError::FieldMismatch)]
    pub field: Account<'info, Field>,
    #[account(
        init,
        payer = signer,
        space = 8 + Attestation::INIT_SPACE,
        seeds = [ATTESTATION_SEED, field.key().as_ref(), &field.attestation_count.to_le_bytes()],
        bump
    )]
    pub attestation: Account<'info, Attestation>,
    pub system_program: Program<'info, System>,
}

pub fn handle_record_delivery(
    ctx: Context<RecordDelivery>,
    kind: AttestationKind,
    verdict: Verdict,
    evidence_hash: [u8; 32],
    evidence_uri: String,
) -> Result<()> {
    require!(matches!(kind, AttestationKind::ElevatorReceipt | AttestationKind::LabQuality), F2fError::InvalidAttestationKind);
    require!(evidence_uri.len() <= MAX_URI_LEN, F2fError::StringTooLong);
    let pool = &ctx.accounts.pool;
    require!(pool.status == PoolStatus::Funded, F2fError::PoolNotFunded);
    let now = Clock::get()?.unix_timestamp;
    let t = &mut ctx.accounts.instrument_terms;
    // Recording is allowed before maturity for a pending Hybrid election; only an elected (or
    // fixed) buyback refuses it.
    require!(
        t.settlement_mode != SettlementMode::CashBuyback && t.effective_election(now, pool.maturity_ts) != Some(SettlementElection::Buyback),
        F2fError::DeliveryNotElected
    );
    match kind {
        AttestationKind::ElevatorReceipt => {
            if verdict == Verdict::Pass {
                t.receipt_hash = evidence_hash;
            }
        }
        _ => {
            t.lab_cert_hash = evidence_hash;
            t.lab_passed = verdict == Verdict::Pass;
        }
    }

    let field = &mut ctx.accounts.field;
    let a = &mut ctx.accounts.attestation;
    a.field = field.key();
    a.project = ctx.accounts.project.key();
    a.sequence = field.attestation_count;
    a.kind = kind;
    a.verdict = verdict;
    a.evidence_hash = evidence_hash;
    a.evidence_uri = evidence_uri;
    a.ndvi_mean_x10k = 0;
    a.scene_date = now;
    a.signer = ctx.accounts.signer.key();
    a.recorded_at = now;
    a.bump = ctx.bumps.attestation;
    field.attestation_count += 1;
    Ok(())
}
