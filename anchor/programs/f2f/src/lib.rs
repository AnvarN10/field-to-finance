pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm");

#[program]
pub mod f2f {
    use super::*;

    pub fn init_config(ctx: Context<InitConfig>, issuer: Pubkey, scas: Pubkey, compliance: Pubkey) -> Result<()> {
        instructions::init_config::handle_init_config(ctx, issuer, scas, compliance)
    }

    pub fn register_project(
        ctx: Context<RegisterProject>,
        project_id: u64,
        crop: String,
        season: u16,
        expected_kg: u64,
        requested_amount: u64,
    ) -> Result<()> {
        instructions::register_project::handle_register_project(ctx, project_id, crop, season, expected_kg, requested_amount)
    }

    pub fn register_field(ctx: Context<RegisterField>, polygon_hash: [u8; 32], area_ha_x100: u32) -> Result<()> {
        instructions::register_field::handle_register_field(ctx, polygon_hash, area_ha_x100)
    }
}
