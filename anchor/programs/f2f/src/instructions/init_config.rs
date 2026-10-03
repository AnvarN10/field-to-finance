use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{constants::*, state::Config};

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub system_program: Program<'info, System>,
}

pub fn handle_init_config(ctx: Context<InitConfig>, issuer: Pubkey, scas: Pubkey, compliance: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.issuer = issuer;
    config.scas = scas;
    config.compliance = compliance;
    config.usdc_mint = ctx.accounts.usdc_mint.key();
    config.bump = ctx.bumps.config;
    Ok(())
}
