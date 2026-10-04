use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{
    constants::*,
    error::F2fError,
    instrument::{load_instrument_terms, redemption_due},
    state::{Config, Pool, PoolStatus, SettlementElection},
};

#[derive(Accounts)]
pub struct FundRedemption<'info> {
    /// The arranger (Config.issuer) or the pool's issuer of record (`Pool.issuer`, the farmer for
    /// pilot pools; the same platform key for older pools).
    #[account(constraint = issuer.key() == config.issuer || issuer.key() == pool.issuer @ F2fError::Unauthorized)]
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
    /// CHECK: InstrumentTerms PDA. When initialized, the coupon formula and settlement election apply.
    #[account(seeds = [INSTRUMENT_SEED, pool.key().as_ref()], bump)]
    pub instrument_terms: UncheckedAccount<'info>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
}

pub fn handle_fund_redemption(ctx: Context<FundRedemption>, amount: u64) -> Result<()> {
    require!(ctx.accounts.pool.status == PoolStatus::Funded, F2fError::PoolNotFunded);
    let now = Clock::get()?.unix_timestamp;
    let terms = load_instrument_terms(&ctx.accounts.instrument_terms)?;
    // Terms pools redeem in cash only on buyback; a delivery pool's deposits could never be swept.
    let election = terms.as_ref().map(|t| t.effective_election(now, ctx.accounts.pool.maturity_ts));
    require!(election != Some(Some(SettlementElection::Delivery)), F2fError::DeliveryElected);
    if amount > 0 {
        // Cash goes in only once the cash path is settled: a deposit made before a Hybrid election
        // could otherwise be stranded in the vault if delivery followed.
        require!(election.is_none_or(|e| e == Some(SettlementElection::Buyback)), F2fError::ElectionPending);
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
    let due = redemption_due(pool.raised_amount, pool, terms.as_ref())?;
    let ready = ctx.accounts.vault.amount >= due
        && pool.disbursed_count == pool.project_count
        && pool.settled_count == pool.project_count
        && now >= pool.maturity_ts
        && election.is_none_or(|e| e == Some(SettlementElection::Buyback));
    if ready {
        pool.status = PoolStatus::Redeeming;
    }
    Ok(())
}
