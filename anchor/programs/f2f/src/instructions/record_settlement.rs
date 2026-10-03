use anchor_lang::prelude::*;

use crate::{constants::*, error::F2fError, state::{Config, FarmProject, Pool, PoolStatus, SettlementRule}};

#[derive(Accounts)]
pub struct RecordSettlement<'info> {
    #[account(address = config.issuer @ F2fError::Unauthorized)]
    pub issuer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut, constraint = project.pool == Some(pool.key()) @ F2fError::ProjectNotInPool)]
    pub project: Account<'info, FarmProject>,
}

pub fn handle_record_settlement(ctx: Context<RecordSettlement>, rule: SettlementRule) -> Result<()> {
    let project = &mut ctx.accounts.project;
    require!(ctx.accounts.pool.status == PoolStatus::Funded, F2fError::PoolNotFunded);
    require!(project.disbursed, F2fError::NotDisbursed);
    // Without a Harvest Attestation the only exit is a cash repayment after maturity,
    // so a missing attestation cannot lock investor money in Funded forever.
    let cash_after_maturity = rule == SettlementRule::CashRepaidWithPremium
        && Clock::get()?.unix_timestamp >= ctx.accounts.pool.maturity_ts;
    require!(project.harvest_attested || cash_after_maturity, F2fError::HarvestNotAttested);
    require!(project.settlement.is_none(), F2fError::AlreadySettled);
    project.settlement = Some(rule);
    ctx.accounts.pool.settled_count += 1;
    Ok(())
}
