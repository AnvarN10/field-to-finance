use anchor_lang::prelude::*;

use crate::{constants::*, error::F2fError, state::{Config, FeeConfig, Pool, PoolStatus, PoolTerms}};

#[derive(Accounts)]
pub struct SetArrangementFee<'info> {
    #[account(mut, address = config.issuer @ F2fError::Unauthorized)]
    pub issuer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(seeds = [FEES_SEED], bump = fee_config.bump)]
    pub fee_config: Account<'info, FeeConfig>,
    #[account(
        init_if_needed,
        payer = issuer,
        space = 8 + PoolTerms::INIT_SPACE,
        seeds = [TERMS_SEED, pool.key().as_ref()],
        bump
    )]
    pub pool_terms: Account<'info, PoolTerms>,
    pub system_program: Program<'info, System>,
}

pub fn handle_set_arrangement_fee(ctx: Context<SetArrangementFee>, bps: u16) -> Result<()> {
    require!(ctx.accounts.pool.status == PoolStatus::Draft, F2fError::PoolNotDraft);
    require!(bps <= MAX_ARRANGEMENT_BPS && bps <= ctx.accounts.fee_config.max_arrangement_bps, F2fError::FeeTooHigh);
    let terms = &mut ctx.accounts.pool_terms;
    terms.arrangement_fee_bps = bps;
    terms.bump = ctx.bumps.pool_terms;
    Ok(())
}
