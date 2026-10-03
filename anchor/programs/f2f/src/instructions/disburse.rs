use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{constants::*, error::F2fError, state::{Config, FarmProject, Pool, PoolStatus}};

#[derive(Accounts)]
pub struct Disburse<'info> {
    #[account(mut, address = config.issuer @ F2fError::Unauthorized)]
    pub issuer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut, constraint = project.pool == Some(pool.key()) @ F2fError::ProjectNotInPool)]
    pub project: Account<'info, FarmProject>,
    /// CHECK: must be the project's producer.
    #[account(address = project.producer)]
    pub producer: UncheckedAccount<'info>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, address = pool.vault)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = issuer,
        associated_token::mint = usdc_mint,
        associated_token::authority = producer,
        associated_token::token_program = usdc_token_program
    )]
    pub producer_usdc: InterfaceAccount<'info, TokenAccount>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_disburse(ctx: Context<Disburse>) -> Result<()> {
    let pool = &ctx.accounts.pool;
    require!(pool.status == PoolStatus::Funded, F2fError::PoolNotFunded);
    require!(!ctx.accounts.project.disbursed, F2fError::AlreadyDisbursed);
    let amount = ctx.accounts.project.requested_amount;
    let pool_id_bytes = pool.pool_id.to_le_bytes();
    let seeds: &[&[u8]] = &[POOL_SEED, &pool_id_bytes, &[pool.bump]];
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.usdc_token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.producer_usdc.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        ctx.accounts.usdc_mint.decimals,
    )?;
    ctx.accounts.project.disbursed = true;
    ctx.accounts.pool.disbursed_count += 1;
    Ok(())
}
