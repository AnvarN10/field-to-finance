use anchor_lang::prelude::*;

use crate::{constants::*, error::F2fError, state::{Config, InvestorRecord}};

/// Platform-level KYC approval. One record per wallet, valid for every pool; each pool's
/// Instrument account is created and thawed on the investor's first `subscribe`.
#[derive(Accounts)]
pub struct ApproveInvestor<'info> {
    #[account(mut, address = config.compliance @ F2fError::Unauthorized)]
    pub compliance: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    /// CHECK: any wallet; only used as the owner of the record.
    pub investor: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = compliance,
        space = 8 + InvestorRecord::INIT_SPACE,
        seeds = [INVESTOR_SEED, investor.key().as_ref()],
        bump
    )]
    pub investor_record: Account<'info, InvestorRecord>,
    pub system_program: Program<'info, System>,
}

pub fn handle_approve_investor(ctx: Context<ApproveInvestor>) -> Result<()> {
    let record = &mut ctx.accounts.investor_record;
    record.wallet = ctx.accounts.investor.key();
    record.approved = true;
    record.approved_at = Clock::get()?.unix_timestamp;
    record.bump = ctx.bumps.investor_record;
    Ok(())
}
