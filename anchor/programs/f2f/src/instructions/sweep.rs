use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{constants::*, error::F2fError, state::{Config, Pool, PoolStatus}};

/// Returns surplus and rounding dust to the Issuer once no Instrument is outstanding.
#[derive(Accounts)]
pub struct Sweep<'info> {
    #[account(address = config.issuer @ F2fError::Unauthorized)]
    pub issuer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(address = pool.mint)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, address = pool.vault)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = usdc_mint, token::authority = issuer, token::token_program = usdc_token_program)]
    pub issuer_usdc: InterfaceAccount<'info, TokenAccount>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
}

pub fn handle_sweep(ctx: Context<Sweep>) -> Result<()> {
    let pool = &ctx.accounts.pool;
    require!(pool.status == PoolStatus::Redeeming, F2fError::PoolNotRedeeming);
    require!(ctx.accounts.mint.supply == 0, F2fError::InstrumentOutstanding);
    let amount = ctx.accounts.vault.amount;
    if amount == 0 {
        return Ok(());
    }
    let pool_id_bytes = pool.pool_id.to_le_bytes();
    let seeds: &[&[u8]] = &[POOL_SEED, &pool_id_bytes, &[pool.bump]];
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.usdc_token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.issuer_usdc.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        ctx.accounts.usdc_mint.decimals,
    )
}
