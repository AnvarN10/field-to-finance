use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    burn, transfer_checked, Burn, Mint, Token2022, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::*,
    error::F2fError,
    instrument::{load_instrument_terms, redemption_due},
    state::{Pool, PoolStatus},
};

#[derive(Accounts)]
pub struct Redeem<'info> {
    pub investor: Signer<'info>,
    #[account(seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
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
    /// CHECK: InstrumentTerms PDA. When initialized, the payout uses the Act/360 coupon.
    #[account(seeds = [INSTRUMENT_SEED, pool.key().as_ref()], bump)]
    pub instrument_terms: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token2022>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
}

pub fn handle_redeem(ctx: Context<Redeem>, amount: u64) -> Result<()> {
    require!(amount > 0, F2fError::ZeroAmount);
    let pool = &ctx.accounts.pool;
    require!(pool.status == PoolStatus::Redeeming, F2fError::PoolNotRedeeming);
    let terms = load_instrument_terms(&ctx.accounts.instrument_terms)?;
    let payout = redemption_due(amount, pool, terms.as_ref())?;
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
        payout,
        ctx.accounts.usdc_mint.decimals,
    )?;
    Ok(())
}
