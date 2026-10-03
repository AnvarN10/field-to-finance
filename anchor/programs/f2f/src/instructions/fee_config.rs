use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{constants::*, error::F2fError, state::{Config, FeeConfig}};

fn validate(network_fee: u64, mint_fee: u64, max_arrangement_bps: u16) -> Result<()> {
    require!(max_arrangement_bps <= MAX_ARRANGEMENT_BPS, F2fError::FeeTooHigh);
    require!(network_fee <= MAX_NETWORK_FEE, F2fError::FeeTooHigh);
    require!(mint_fee <= MAX_MINT_FEE, F2fError::FeeTooHigh);
    Ok(())
}

#[derive(Accounts)]
pub struct InitFeeConfig<'info> {
    #[account(mut, address = config.admin @ F2fError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(init, payer = admin, space = 8 + FeeConfig::INIT_SPACE, seeds = [FEES_SEED], bump)]
    pub fee_config: Account<'info, FeeConfig>,
    /// CHECK: any wallet; becomes the fee treasury.
    pub treasury: UncheckedAccount<'info>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    // Created here so fee transfers never fail on a missing treasury account.
    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = usdc_mint,
        associated_token::authority = treasury,
        associated_token::token_program = usdc_token_program
    )]
    pub treasury_usdc: InterfaceAccount<'info, TokenAccount>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_init_fee_config(ctx: Context<InitFeeConfig>, network_fee: u64, mint_fee: u64, max_arrangement_bps: u16) -> Result<()> {
    validate(network_fee, mint_fee, max_arrangement_bps)?;
    let fc = &mut ctx.accounts.fee_config;
    fc.treasury = ctx.accounts.treasury.key();
    fc.network_fee = network_fee;
    fc.mint_fee = mint_fee;
    fc.max_arrangement_bps = max_arrangement_bps;
    fc.bump = ctx.bumps.fee_config;
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateFeeConfig<'info> {
    #[account(mut, address = config.admin @ F2fError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [FEES_SEED], bump = fee_config.bump)]
    pub fee_config: Account<'info, FeeConfig>,
    /// CHECK: any wallet; becomes the fee treasury.
    pub treasury: UncheckedAccount<'info>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = usdc_mint,
        associated_token::authority = treasury,
        associated_token::token_program = usdc_token_program
    )]
    pub treasury_usdc: InterfaceAccount<'info, TokenAccount>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_update_fee_config(ctx: Context<UpdateFeeConfig>, network_fee: u64, mint_fee: u64, max_arrangement_bps: u16) -> Result<()> {
    validate(network_fee, mint_fee, max_arrangement_bps)?;
    let fc = &mut ctx.accounts.fee_config;
    fc.treasury = ctx.accounts.treasury.key();
    fc.network_fee = network_fee;
    fc.mint_fee = mint_fee;
    fc.max_arrangement_bps = max_arrangement_bps;
    Ok(())
}
