use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::F2fError,
    events::SettlementElected,
    state::{Config, InstrumentTerms, Pool, PoolStatus, SettlementElection, SettlementMode},
};

/// The issuer of record (or the arranger) chooses buyback or delivery for a Hybrid Instrument,
/// once, no later than maturity.
#[derive(Accounts)]
pub struct ElectSettlement<'info> {
    #[account(constraint = signer.key() == pool.issuer || signer.key() == config.issuer @ F2fError::Unauthorized)]
    pub signer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut, seeds = [INSTRUMENT_SEED, pool.key().as_ref()], bump = instrument_terms.bump)]
    pub instrument_terms: Account<'info, InstrumentTerms>,
}

pub fn handle_elect_settlement(ctx: Context<ElectSettlement>, election: SettlementElection) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let t = &mut ctx.accounts.instrument_terms;
    require!(t.settlement_mode == SettlementMode::Hybrid, F2fError::NotHybrid);
    require!(matches!(pool.status, PoolStatus::Open | PoolStatus::Funded), F2fError::PoolNotFunded);
    require!(t.election.is_none(), F2fError::AlreadyElected);
    let now = Clock::get()?.unix_timestamp;
    require!(now <= pool.maturity_ts, F2fError::ElectionClosed);
    t.election = Some(election);
    t.elected_at = now;
    emit!(SettlementElected { pool: pool.key(), signer: ctx.accounts.signer.key(), election });
    Ok(())
}
