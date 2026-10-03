use anchor_lang::prelude::*;
use anchor_spl::token_interface::{freeze_account, FreezeAccount, Mint, Token2022, TokenAccount};

use crate::{constants::*, error::F2fError, state::{Config, InvestorRecord, Pool}};

#[derive(Accounts)]
pub struct RevokeInvestor<'info> {
    #[account(address = config.compliance @ F2fError::Unauthorized)]
    pub compliance: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(address = pool.mint)]
    pub mint: InterfaceAccount<'info, Mint>,
    /// CHECK: owner of the record and token account.
    pub investor: UncheckedAccount<'info>,
    #[account(mut, seeds = [INVESTOR_SEED, investor.key().as_ref()], bump = investor_record.bump)]
    pub investor_record: Account<'info, InvestorRecord>,
    /// The investor's Instrument account in this pool, if they ever subscribed to it.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = investor,
        associated_token::token_program = token_program
    )]
    pub investor_instrument: Option<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Program<'info, Token2022>,
}

pub fn handle_revoke_investor(ctx: Context<RevokeInvestor>) -> Result<()> {
    ctx.accounts.investor_record.approved = false;
    let Some(account) = ctx.accounts.investor_instrument.as_ref() else {
        return Ok(());
    };
    if !account.is_frozen() {
        let pool = &ctx.accounts.pool;
        let pool_id_bytes = pool.pool_id.to_le_bytes();
        let seeds: &[&[u8]] = &[POOL_SEED, &pool_id_bytes, &[pool.bump]];
        freeze_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            FreezeAccount {
                account: account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            &[seeds],
        ))?;
    }
    Ok(())
}
