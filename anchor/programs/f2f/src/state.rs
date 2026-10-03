use anchor_lang::prelude::*;

use crate::constants::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub issuer: Pubkey,
    pub scas: Pubkey,
    pub compliance: Pubkey,
    pub usdc_mint: Pubkey,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum PoolStatus {
    Draft,
    Open,
    Funded,
    Refunding,
    Redeeming,
}

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub pool_id: u64,
    pub issuer: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    #[max_len(MAX_CROP_LEN)]
    pub crop: String,
    pub season: u16,
    pub target_amount: u64,
    pub raised_amount: u64,
    pub yield_bps: u16,
    pub premium_bps: u16,
    pub subscription_close_ts: i64,
    pub maturity_ts: i64,
    pub project_count: u16,
    pub disbursed_count: u16,
    pub settled_count: u16,
    pub status: PoolStatus,
    pub bump: u8,
    pub mint_bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum SettlementRule {
    Delivered,
    CoveredFromOtherFields,
    BoughtOnMarket,
    CashRepaidWithPremium,
}

#[account]
#[derive(InitSpace)]
pub struct FarmProject {
    pub producer: Pubkey,
    pub project_id: u64,
    pub pool: Option<Pubkey>,
    #[max_len(MAX_CROP_LEN)]
    pub crop: String,
    pub season: u16,
    pub expected_kg: u64,
    pub tokenized_kg: u64,
    pub requested_amount: u64,
    pub field_count: u8,
    pub verified_field_count: u8,
    pub harvest_attested: bool,
    pub disbursed: bool,
    pub settlement: Option<SettlementRule>,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Field {
    pub project: Pubkey,
    pub index: u8,
    pub polygon_hash: [u8; 32],
    pub area_ha_x100: u32,
    pub verified: bool,
    pub attestation_count: u32,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum AttestationKind {
    FieldVerified,
    Sowing,
    Vegetation,
    Harvest,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Verdict {
    Pass,
    Fail,
    InsufficientData,
}

#[account]
#[derive(InitSpace)]
pub struct Attestation {
    pub field: Pubkey,
    pub project: Pubkey,
    pub sequence: u32,
    pub kind: AttestationKind,
    pub verdict: Verdict,
    pub evidence_hash: [u8; 32],
    #[max_len(MAX_URI_LEN)]
    pub evidence_uri: String,
    pub ndvi_mean_x10k: i16,
    pub scene_date: i64,
    pub signer: Pubkey,
    pub recorded_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct InvestorRecord {
    pub wallet: Pubkey,
    pub approved: bool,
    pub approved_at: i64,
    pub bump: u8,
}
