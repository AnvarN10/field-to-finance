use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{
    constants::*,
    error::F2fError,
    events::MintFeeCharged,
    fees::{checked_treasury, load_fee_config, pay_fee},
    state::{Config, FarmProject},
};

#[derive(Accounts)]
#[instruction(project_id: u64)]
pub struct RegisterProject<'info> {
    pub producer: Signer<'info>,
    /// Pays rent for the project account: the platform gas sponsor, or the producer themself.
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = payer,
        space = 8 + FarmProject::INIT_SPACE,
        seeds = [PROJECT_SEED, producer.key().as_ref(), &project_id.to_le_bytes()],
        bump
    )]
    pub project: Account<'info, FarmProject>,
    /// CHECK: FeeConfig PDA. The mint fee is charged only if it is initialized.
    #[account(seeds = [FEES_SEED], bump)]
    pub fee_config: UncheckedAccount<'info>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: Option<InterfaceAccount<'info, Mint>>,
    /// Producer's USDC account that pays the mint fee; the producer signs the transfer.
    #[account(mut)]
    pub producer_usdc: Option<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub treasury_usdc: Option<InterfaceAccount<'info, TokenAccount>>,
    pub usdc_token_program: Option<Interface<'info, TokenInterface>>,
    pub system_program: Program<'info, System>,
}

pub fn handle_register_project(
    ctx: Context<RegisterProject>,
    project_id: u64,
    crop: String,
    season: u16,
    expected_kg: u64,
    requested_amount: u64,
) -> Result<()> {
    require!(crop.len() <= MAX_CROP_LEN, F2fError::StringTooLong);
    require!(expected_kg > 0 && requested_amount > 0, F2fError::ZeroAmount);
    let tokenized_kg = (expected_kg as u128)
        .checked_mul(TOKENIZED_SHARE_BPS as u128)
        .ok_or(F2fError::MathOverflow)?
        / BPS as u128;
    let project = &mut ctx.accounts.project;
    project.producer = ctx.accounts.producer.key();
    project.project_id = project_id;
    project.pool = None;
    project.crop = crop;
    project.season = season;
    project.expected_kg = expected_kg;
    project.tokenized_kg = tokenized_kg as u64;
    project.requested_amount = requested_amount;
    project.field_count = 0;
    project.verified_field_count = 0;
    project.harvest_attested = false;
    project.disbursed = false;
    project.settlement = None;
    project.bump = ctx.bumps.project;
    charge_mint_fee(&ctx)
}

fn charge_mint_fee(ctx: &Context<RegisterProject>) -> Result<()> {
    let Some(fees) = load_fee_config(&ctx.accounts.fee_config)? else { return Ok(()) };
    if fees.mint_fee == 0 {
        return Ok(());
    }
    let a = &ctx.accounts;
    let mint = a.usdc_mint.as_ref().ok_or(F2fError::MissingFeeAccount)?;
    let from = a.producer_usdc.as_ref().ok_or(F2fError::MissingFeeAccount)?;
    let token_program = a.usdc_token_program.as_ref().ok_or(F2fError::MissingFeeAccount)?;
    let treasury = checked_treasury(&a.treasury_usdc, &fees, &mint.key(), &token_program.key())?;
    pay_fee(
        token_program.to_account_info(),
        from.to_account_info(),
        mint,
        treasury.to_account_info(),
        a.producer.to_account_info(),
        fees.mint_fee,
    )?;
    emit!(MintFeeCharged { project: a.project.key(), producer: a.producer.key(), fee: fees.mint_fee });
    Ok(())
}
