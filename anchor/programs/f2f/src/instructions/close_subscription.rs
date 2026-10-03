use anchor_lang::prelude::*;

use crate::{constants::*, error::F2fError, state::{Pool, PoolStatus}};

#[derive(Accounts)]
pub struct CloseSubscription<'info> {
    pub caller: Signer<'info>,
    #[account(mut, seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
}

pub fn handle_close_subscription(ctx: Context<CloseSubscription>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    require!(pool.status == PoolStatus::Open, F2fError::PoolNotOpen);
    let full = pool.raised_amount == pool.target_amount;
    let ended = Clock::get()?.unix_timestamp >= pool.subscription_close_ts;
    require!(full || ended, F2fError::SubscriptionStillOpen);
    pool.status = if full { PoolStatus::Funded } else { PoolStatus::Refunding };
    Ok(())
}
