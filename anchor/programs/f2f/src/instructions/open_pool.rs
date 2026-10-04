use anchor_lang::prelude::*;

use crate::{constants::*, error::F2fError, instrument::load_instrument_terms, state::{Config, Pool, PoolStatus}};

#[derive(Accounts)]
pub struct OpenPool<'info> {
    #[account(address = config.issuer @ F2fError::Unauthorized)]
    pub issuer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    /// CHECK: InstrumentTerms PDA. When initialized, the target must be whole tokens.
    #[account(seeds = [INSTRUMENT_SEED, pool.key().as_ref()], bump)]
    pub instrument_terms: UncheckedAccount<'info>,
}

pub fn handle_open_pool(ctx: Context<OpenPool>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    require!(pool.status == PoolStatus::Draft, F2fError::PoolNotDraft);
    require!(pool.project_count > 0, F2fError::NoProjects);
    if let Some(terms) = load_instrument_terms(&ctx.accounts.instrument_terms)? {
        require!(pool.target_amount % terms.unit_nominal == 0, F2fError::TargetNotWholeTokens);
    }
    require!(Clock::get()?.unix_timestamp < pool.subscription_close_ts, F2fError::SubscriptionClosed);
    pool.status = PoolStatus::Open;
    Ok(())
}
