use anchor_lang::prelude::*;
use anchor_spl::token_interface::{burn, Burn, Mint, Token2022, TokenAccount};

use crate::{
    constants::*,
    error::F2fError,
    events::GrainClaim,
    state::{InstrumentTerms, Pool, PoolStatus, SettlementElection},
};

/// Delivery settlement: the investor burns Instrument for a pro-rata share of the tokenized grain.
/// Emits `GrainClaim`; the grain itself is released off-chain against the elevator receipt.
#[derive(Accounts)]
pub struct RedeemDelivery<'info> {
    pub investor: Signer<'info>,
    #[account(seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut, seeds = [INSTRUMENT_SEED, pool.key().as_ref()], bump = instrument_terms.bump)]
    pub instrument_terms: Account<'info, InstrumentTerms>,
    #[account(mut, address = pool.mint)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = investor, token::token_program = token_program)]
    pub investor_instrument: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, Token2022>,
}

pub fn handle_redeem_delivery(ctx: Context<RedeemDelivery>, amount: u64) -> Result<()> {
    require!(amount > 0, F2fError::ZeroAmount);
    let pool = &ctx.accounts.pool;
    let t = &ctx.accounts.instrument_terms;
    let now = Clock::get()?.unix_timestamp;
    require!(t.effective_election(now, pool.maturity_ts) == Some(SettlementElection::Delivery), F2fError::DeliveryNotElected);
    require!(pool.status == PoolStatus::Funded, F2fError::PoolNotFunded);
    require!(now >= pool.maturity_ts, F2fError::NotMatured);
    require!(pool.disbursed_count == pool.project_count, F2fError::NotAllDisbursed);
    require!(t.receipt_hash != [0; 32] && t.lab_passed, F2fError::DeliveryNotAttested);

    // kg = amount × tokenized_kg / raised_amount, floored. Supply equals raised_amount at issue,
    // so the claims of all holders add up to at most the tokenized volume.
    let tokenized_kg = t.tokenized_kg().ok_or(F2fError::MathOverflow)?;
    require!(pool.raised_amount > 0, F2fError::ZeroAmount);
    let kg = (amount as u128).checked_mul(tokenized_kg as u128).ok_or(F2fError::MathOverflow)? / pool.raised_amount as u128;
    let kg = u64::try_from(kg).map_err(|_| error!(F2fError::MathOverflow))?;

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

    let receipt_hash = t.receipt_hash;
    let t = &mut ctx.accounts.instrument_terms;
    t.delivered_kg = t.delivered_kg.checked_add(kg).ok_or(F2fError::MathOverflow)?;
    emit!(GrainClaim { pool: ctx.accounts.pool.key(), investor: ctx.accounts.investor.key(), amount, kg, receipt_hash });
    Ok(())
}
