use anchor_lang::prelude::*;

use crate::{constants::*, error::F2fError, state::{FarmProject, Field}};

#[derive(Accounts)]
pub struct RegisterField<'info> {
    pub producer: Signer<'info>,
    /// Pays rent for the field account: the platform gas sponsor, or the producer themself.
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, has_one = producer @ F2fError::Unauthorized)]
    pub project: Account<'info, FarmProject>,
    #[account(
        init,
        payer = payer,
        space = 8 + Field::INIT_SPACE,
        seeds = [FIELD_SEED, project.key().as_ref(), &[project.field_count]],
        bump
    )]
    pub field: Account<'info, Field>,
    pub system_program: Program<'info, System>,
}

pub fn handle_register_field(ctx: Context<RegisterField>, polygon_hash: [u8; 32], area_ha_x100: u32) -> Result<()> {
    let project = &mut ctx.accounts.project;
    require!(project.pool.is_none(), F2fError::ProjectLocked);
    require!(project.field_count < MAX_FIELDS, F2fError::TooManyFields);
    require!(area_ha_x100 > 0, F2fError::ZeroAmount);
    let field = &mut ctx.accounts.field;
    field.project = project.key();
    field.index = project.field_count;
    field.polygon_hash = polygon_hash;
    field.area_ha_x100 = area_ha_x100;
    field.verified = false;
    field.attestation_count = 0;
    field.bump = ctx.bumps.field;
    project.field_count += 1;
    Ok(())
}
