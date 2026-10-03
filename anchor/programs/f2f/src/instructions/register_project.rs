use anchor_lang::prelude::*;

use crate::{constants::*, error::F2fError, state::FarmProject};

#[derive(Accounts)]
#[instruction(project_id: u64)]
pub struct RegisterProject<'info> {
    #[account(mut)]
    pub producer: Signer<'info>,
    #[account(
        init,
        payer = producer,
        space = 8 + FarmProject::INIT_SPACE,
        seeds = [PROJECT_SEED, producer.key().as_ref(), &project_id.to_le_bytes()],
        bump
    )]
    pub project: Account<'info, FarmProject>,
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
    Ok(())
}
