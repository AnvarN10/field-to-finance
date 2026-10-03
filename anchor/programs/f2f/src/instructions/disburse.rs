use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{
    constants::*,
    error::F2fError,
    events::ArrangementFeeWithheld,
    fees::{checked_treasury, load_arrangement_fee_bps, load_fee_config},
    math::split_fee,
    state::{Config, FarmProject, Pool, PoolStatus},
};

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
    /// CHECK: PoolTerms PDA of this pool. Pools without it (created before fees) pay no arrangement fee.
    #[account(seeds = [TERMS_SEED, pool.key().as_ref()], bump)]
    pub pool_terms: UncheckedAccount<'info>,
    /// CHECK: FeeConfig PDA; names the treasury when a fee is due.
    #[account(seeds = [FEES_SEED], bump)]
    pub fee_config: UncheckedAccount<'info>,
    #[account(mut)]
    pub treasury_usdc: Option<InterfaceAccount<'info, TokenAccount>>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_disburse(ctx: Context<Disburse>) -> Result<()> {
    let pool = &ctx.accounts.pool;
    require!(pool.status == PoolStatus::Funded, F2fError::PoolNotFunded);
    require!(!ctx.accounts.project.disbursed, F2fError::AlreadyDisbursed);
    let requested = ctx.accounts.project.requested_amount;
    let bps = load_arrangement_fee_bps(&ctx.accounts.pool_terms)?;
    let (fee, net) = split_fee(requested, bps)?;
    let pool_id_bytes = pool.pool_id.to_le_bytes();
    let seeds: &[&[u8]] = &[POOL_SEED, &pool_id_bytes, &[pool.bump]];
    let a = &ctx.accounts;
    if fee > 0 {
        let fees = load_fee_config(&a.fee_config)?.ok_or(F2fError::MissingFeeAccount)?;
        let treasury = checked_treasury(&a.treasury_usdc, &fees, &a.usdc_mint.key(), &a.usdc_token_program.key())?;
        pay_from_vault(a, treasury.to_account_info(), fee, seeds)?;
    }
    pay_from_vault(a, a.producer_usdc.to_account_info(), net, seeds)?;
    emit!(ArrangementFeeWithheld { pool: a.pool.key(), project: a.project.key(), requested, fee, net });
    ctx.accounts.project.disbursed = true;
    ctx.accounts.pool.disbursed_count += 1;
    Ok(())
}

fn pay_from_vault<'info>(a: &Disburse<'info>, to: AccountInfo<'info>, amount: u64, seeds: &[&[u8]]) -> Result<()> {
    transfer_checked(
        CpiContext::new_with_signer(
            a.usdc_token_program.key(),
            TransferChecked {
                from: a.vault.to_account_info(),
                mint: a.usdc_mint.to_account_info(),
                to,
                authority: a.pool.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        a.usdc_mint.decimals,
    )
}
