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
}
