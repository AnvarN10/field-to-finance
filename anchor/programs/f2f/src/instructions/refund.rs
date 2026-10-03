use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    burn, transfer_checked, Burn, Mint, Token2022, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{constants::*, error::F2fError, state::{Pool, PoolStatus}};

#[derive(Accounts)]
pub struct Refund<'info> {
    pub investor: Signer<'info>,
    #[account(mut, seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut, address = pool.mint)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = investor, token::token_program = token_program)]
    pub investor_instrument: InterfaceAccount<'info, TokenAccount>,
    #[account(address = vault.mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = usdc_mint, token::authority = investor, token::token_program = usdc_token_program)]
    pub investor_usdc: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, address = pool.vault)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, Token2022>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
}

pub fn handle_refund(ctx: Context<Refund>, amount: u64) -> Result<()> {
    require!(amount > 0, F2fError::ZeroAmount);
    require!(ctx.accounts.pool.status == PoolStatus::Refunding, F2fError::PoolNotRefunding);
    burn(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.investor_instrument.to_account_info(),
                authority: ctx.accounts.investor.to_account_info(),
            },
        ),
        amount,
    )?;
    let pool = &ctx.accounts.pool;
    let pool_id_bytes = pool.pool_id.to_le_bytes();
    let seeds: &[&[u8]] = &[POOL_SEED, &pool_id_bytes, &[pool.bump]];
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.usdc_token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.investor_usdc.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        ctx.accounts.usdc_mint.decimals,
    )?;
    let pool = &mut ctx.accounts.pool;
    pool.raised_amount = pool.raised_amount.checked_sub(amount).ok_or(F2fError::MathOverflow)?;
    Ok(())
}
