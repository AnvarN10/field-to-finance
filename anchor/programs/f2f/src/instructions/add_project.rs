use anchor_lang::prelude::*;

use crate::{constants::*, error::F2fError, state::{Config, FarmProject, Pool, PoolStatus}};

#[derive(Accounts)]
pub struct AddProject<'info> {
    #[account(address = config.issuer @ F2fError::Unauthorized)]
    pub issuer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub project: Account<'info, FarmProject>,
}

pub fn handle_add_project(ctx: Context<AddProject>) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let project = &mut ctx.accounts.project;
    require!(pool.status == PoolStatus::Draft, F2fError::PoolNotDraft);
    require!(project.pool.is_none(), F2fError::ProjectAlreadyInPool);
    require!(project.crop == pool.crop && project.season == pool.season, F2fError::CropMismatch);
    require!(project.field_count > 0, F2fError::NoFields);
    require!(project.verified_field_count == project.field_count, F2fError::FieldsNotVerified);
    pool.target_amount = pool.target_amount.checked_add(project.requested_amount).ok_or(F2fError::MathOverflow)?;
    pool.project_count += 1;
    project.pool = Some(pool.key());
    Ok(())
}
