use anchor_lang::prelude::*;

use crate::{constants::*, error::F2fError, state::{Config, Pool, PoolStatus}};

#[derive(Accounts)]
pub struct OpenPool<'info> {
    #[account(address = config.issuer @ F2fError::Unauthorized)]
    pub issuer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
}

pub fn handle_open_pool(ctx: Context<OpenPool>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    require!(pool.status == PoolStatus::Draft, F2fError::PoolNotDraft);
    require!(pool.project_count > 0, F2fError::NoProjects);
    require!(Clock::get()?.unix_timestamp < pool.subscription_close_ts, F2fError::SubscriptionClosed);
    pool.status = PoolStatus::Open;
    Ok(())
}
