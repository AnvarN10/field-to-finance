use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    mint_to, thaw_account, transfer_checked, Mint, MintTo, ThawAccount, Token2022, TokenAccount, TokenInterface,
    TransferChecked,
};

use crate::{constants::*, error::F2fError, state::{InvestorRecord, Pool, PoolStatus}};

#[derive(Accounts)]
pub struct Subscribe<'info> {
    #[account(mut)]
    pub investor: Signer<'info>,
    #[account(mut, seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(seeds = [INVESTOR_SEED, investor.key().as_ref()], bump = investor_record.bump)]
    pub investor_record: Account<'info, InvestorRecord>,
    #[account(mut, address = pool.mint)]
    pub mint: InterfaceAccount<'info, Mint>,
    // Created on the first subscription to this pool; the mint's Default Account State makes it
    // frozen, and the handler thaws it only for a KYC-approved wallet.
    #[account(
        init_if_needed,
        payer = investor,
        associated_token::mint = mint,
        associated_token::authority = investor,
        associated_token::token_program = token_program
    )]
    pub investor_instrument: InterfaceAccount<'info, TokenAccount>,
    #[account(address = vault.mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = usdc_mint, token::authority = investor, token::token_program = usdc_token_program)]
    pub investor_usdc: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, address = pool.vault)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, Token2022>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_subscribe(ctx: Context<Subscribe>, amount: u64) -> Result<()> {
    require!(amount > 0, F2fError::ZeroAmount);
    require!(ctx.accounts.investor_record.approved, F2fError::InvestorNotApproved);
    let pool = &ctx.accounts.pool;
    require!(pool.status == PoolStatus::Open, F2fError::PoolNotOpen);
    require!(Clock::get()?.unix_timestamp < pool.subscription_close_ts, F2fError::SubscriptionClosed);
    let new_raised = pool.raised_amount.checked_add(amount).ok_or(F2fError::MathOverflow)?;
    require!(new_raised <= pool.target_amount, F2fError::ExceedsTarget);

    transfer_checked(
        CpiContext::new(
            ctx.accounts.usdc_token_program.key(),
            TransferChecked {
                from: ctx.accounts.investor_usdc.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.investor.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.usdc_mint.decimals,
    )?;

    let pool_id_bytes = pool.pool_id.to_le_bytes();
    let seeds: &[&[u8]] = &[POOL_SEED, &pool_id_bytes, &[pool.bump]];
    if ctx.accounts.investor_instrument.is_frozen() {
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
    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.investor_instrument.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )?;

    ctx.accounts.pool.raised_amount = new_raised;
    Ok(())
}
