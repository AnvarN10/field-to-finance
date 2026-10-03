use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{constants::*, error::F2fError, math::with_yield, state::{Config, Pool, PoolStatus}};

#[derive(Accounts)]
pub struct FundRedemption<'info> {
    #[account(address = config.issuer @ F2fError::Unauthorized)]
    pub issuer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = usdc_mint, token::authority = issuer, token::token_program = usdc_token_program)]
    pub issuer_usdc: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, address = pool.vault)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
}

pub fn handle_fund_redemption(ctx: Context<FundRedemption>, amount: u64) -> Result<()> {
    require!(ctx.accounts.pool.status == PoolStatus::Funded, F2fError::PoolNotFunded);
    if amount > 0 {
        // Deposits before every project is paid would be swept into disbursements.
        require!(
            ctx.accounts.pool.disbursed_count == ctx.accounts.pool.project_count,
            F2fError::NotAllDisbursed
        );
        transfer_checked(
            CpiContext::new(
                ctx.accounts.usdc_token_program.key(),
                TransferChecked {
                    from: ctx.accounts.issuer_usdc.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.issuer.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.usdc_mint.decimals,
        )?;
        ctx.accounts.vault.reload()?;
    }
    let pool = &mut ctx.accounts.pool;
    let due = with_yield(pool.raised_amount, pool.yield_bps)?;
    let ready = ctx.accounts.vault.amount >= due
        && pool.disbursed_count == pool.project_count
        && pool.settled_count == pool.project_count
        && Clock::get()?.unix_timestamp >= pool.maturity_ts;
    if ready {
        pool.status = PoolStatus::Redeeming;
    }
    Ok(())
}
