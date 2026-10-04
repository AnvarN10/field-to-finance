pub mod constants;
pub mod error;
pub mod events;
pub mod fees;
pub mod instrument;
pub mod instructions;
pub mod math;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use events::*;
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

    pub fn record_attestation(
        ctx: Context<RecordAttestation>,
        kind: AttestationKind,
        verdict: Verdict,
        evidence_hash: [u8; 32],
        evidence_uri: String,
        ndvi_mean_x10k: i16,
        scene_date: i64,
    ) -> Result<()> {
        instructions::record_attestation::handle_record_attestation(ctx, kind, verdict, evidence_hash, evidence_uri, ndvi_mean_x10k, scene_date)
    }

    pub fn create_pool(ctx: Context<CreatePool>, pool_id: u64, args: CreatePoolArgs) -> Result<()> {
        instructions::create_pool::handle_create_pool(ctx, pool_id, args)
    }

    pub fn add_project(ctx: Context<AddProject>) -> Result<()> {
        instructions::add_project::handle_add_project(ctx)
    }

    pub fn open_pool(ctx: Context<OpenPool>) -> Result<()> {
        instructions::open_pool::handle_open_pool(ctx)
    }

    pub fn approve_investor(ctx: Context<ApproveInvestor>) -> Result<()> {
        instructions::approve_investor::handle_approve_investor(ctx)
    }

    pub fn subscribe(ctx: Context<Subscribe>, amount: u64) -> Result<()> {
        instructions::subscribe::handle_subscribe(ctx, amount)
    }

    pub fn close_subscription(ctx: Context<CloseSubscription>) -> Result<()> {
        instructions::close_subscription::handle_close_subscription(ctx)
    }

    pub fn disburse(ctx: Context<Disburse>) -> Result<()> {
        instructions::disburse::handle_disburse(ctx)
    }

    pub fn refund(ctx: Context<Refund>, amount: u64) -> Result<()> {
        instructions::refund::handle_refund(ctx, amount)
    }

    pub fn record_settlement(ctx: Context<RecordSettlement>, rule: SettlementRule) -> Result<()> {
        instructions::record_settlement::handle_record_settlement(ctx, rule)
    }

    pub fn fund_redemption(ctx: Context<FundRedemption>, amount: u64) -> Result<()> {
        instructions::fund_redemption::handle_fund_redemption(ctx, amount)
    }

    pub fn redeem(ctx: Context<Redeem>, amount: u64) -> Result<()> {
        instructions::redeem::handle_redeem(ctx, amount)
    }

    pub fn revoke_investor(ctx: Context<RevokeInvestor>) -> Result<()> {
        instructions::revoke_investor::handle_revoke_investor(ctx)
    }

    pub fn sweep(ctx: Context<Sweep>) -> Result<()> {
        instructions::sweep::handle_sweep(ctx)
    }

    pub fn init_fee_config(ctx: Context<InitFeeConfig>, network_fee: u64, mint_fee: u64, max_arrangement_bps: u16) -> Result<()> {
        instructions::fee_config::handle_init_fee_config(ctx, network_fee, mint_fee, max_arrangement_bps)
    }

    pub fn update_fee_config(ctx: Context<UpdateFeeConfig>, network_fee: u64, mint_fee: u64, max_arrangement_bps: u16) -> Result<()> {
        instructions::fee_config::handle_update_fee_config(ctx, network_fee, mint_fee, max_arrangement_bps)
    }

    pub fn set_arrangement_fee(ctx: Context<SetArrangementFee>, bps: u16) -> Result<()> {
        instructions::set_arrangement_fee::handle_set_arrangement_fee(ctx, bps)
    }

    pub fn set_instrument_terms(ctx: Context<SetInstrumentTerms>, args: InstrumentTermsArgs) -> Result<()> {
        instructions::set_instrument_terms::handle_set_instrument_terms(ctx, args)
    }

    pub fn elect_settlement(ctx: Context<ElectSettlement>, election: SettlementElection) -> Result<()> {
        instructions::elect_settlement::handle_elect_settlement(ctx, election)
    }

    pub fn record_delivery(
        ctx: Context<RecordDelivery>,
        kind: AttestationKind,
        verdict: Verdict,
        evidence_hash: [u8; 32],
        evidence_uri: String,
    ) -> Result<()> {
        instructions::record_delivery::handle_record_delivery(ctx, kind, verdict, evidence_hash, evidence_uri)
    }

    pub fn redeem_delivery(ctx: Context<RedeemDelivery>, amount: u64) -> Result<()> {
        instructions::redeem_delivery::handle_redeem_delivery(ctx, amount)
    }
}
