use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{thaw_account, Mint, ThawAccount, Token2022, TokenAccount};

use crate::{constants::*, error::F2fError, state::{Config, InvestorRecord, Pool}};

#[derive(Accounts)]
pub struct ApproveInvestor<'info> {
    #[account(mut, address = config.compliance @ F2fError::Unauthorized)]
    pub compliance: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(address = pool.mint)]
    pub mint: InterfaceAccount<'info, Mint>,
    /// CHECK: any wallet; only used as the owner of the record and token account.
    pub investor: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = compliance,
        space = 8 + InvestorRecord::INIT_SPACE,
        seeds = [INVESTOR_SEED, investor.key().as_ref()],
        bump
    )]
    pub investor_record: Account<'info, InvestorRecord>,
    #[account(
        init_if_needed,
        payer = compliance,
        associated_token::mint = mint,
        associated_token::authority = investor,
        associated_token::token_program = token_program
    )]
    pub investor_instrument: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_approve_investor(ctx: Context<ApproveInvestor>) -> Result<()> {
    let record = &mut ctx.accounts.investor_record;
    record.wallet = ctx.accounts.investor.key();
    record.approved = true;
    record.approved_at = Clock::get()?.unix_timestamp;
    record.bump = ctx.bumps.investor_record;

    if ctx.accounts.investor_instrument.is_frozen() {
        let pool = &ctx.accounts.pool;
        let pool_id_bytes = pool.pool_id.to_le_bytes();
        let seeds: &[&[u8]] = &[POOL_SEED, &pool_id_bytes, &[pool.bump]];
        thaw_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            ThawAccount {
                account: ctx.accounts.investor_instrument.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            &[seeds],
        ))?;
    }
    Ok(())
}
