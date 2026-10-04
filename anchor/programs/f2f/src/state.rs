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
    // Appended for the delivery settlement path (ADR 0014). Never reorder: stored as a u8 tag.
    /// Elevator grain receipt for the delivered volume; evidence hash is the receipt document.
    ElevatorReceipt,
    /// Laboratory quality certificate against the Instrument's quality spec.
    LabQuality,
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

/// Platform fee settings. Singleton PDA `["fees"]`, controlled by `Config.admin`.
/// Fees are charged only while this account exists; old deployments without it charge nothing.
#[account]
#[derive(InitSpace)]
pub struct FeeConfig {
    /// Wallet that receives every fee; fees land in its USDC associated token account.
    pub treasury: Pubkey,
    /// USDC base units added to each subscription, paid by the investor.
    pub network_fee: u64,
    /// USDC base units prepaid by the producer at `register_project`.
    pub mint_fee: u64,
    /// Upper bound for `PoolTerms.arrangement_fee_bps`, itself at most `MAX_ARRANGEMENT_BPS`.
    pub max_arrangement_bps: u16,
    pub bump: u8,
}

/// Per-pool commercial terms, PDA `["terms", pool]`. Set by the Issuer while the pool is Draft.
/// A pool without this account (every pool created before fees) has a zero arrangement fee.
#[account]
#[derive(InitSpace)]
pub struct PoolTerms {
    /// Share of each project's requested amount withheld for the treasury at disbursement.
    pub arrangement_fee_bps: u16,
    pub bump: u8,
}

/// Interest day count. Only Act/360 is supported; Act/365 is reserved for later terms.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum DayCount {
    Act360,
    Act365,
}

/// How the Instrument settles at maturity.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum SettlementMode {
    /// Cash redemption of principal plus coupon.
    CashBuyback,
    /// Grain delivery: holders burn tokens for a pro-rata Grain Claim.
    GrainDelivery,
    /// Grain delivery with the issuer's right to buy the token back for cash (pilot term sheet).
    Hybrid,
}

/// The issuer's choice for a Hybrid Instrument.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum SettlementElection {
    Buyback,
    Delivery,
}

/// Instrument terms from the term sheet, PDA `["instrument", pool]`. Set by the arranger while the pool
/// is Draft, usually in the same transaction as `create_pool`. Pools without it keep the flat-yield path.
#[account]
#[derive(InitSpace)]
pub struct InstrumentTerms {
    pub pool: Pubkey,
    /// USDC base units per whole token (pilot: 100,000 USDC). Subscriptions are whole multiples.
    pub unit_nominal: u64,
    pub coupon_bps_annual: u16,
    pub day_count: DayCount,
    /// Interest accrues from here to `Pool.maturity_ts`, counted in whole days.
    pub start_ts: i64,
    pub settlement_mode: SettlementMode,
    /// Contracted harvest volume (pilot: 10,000 t).
    pub volume_kg: u64,
    /// Share of `volume_kg` backing the tokens, at most 30%.
    pub tokenized_share_bps: u16,
    /// SHA-256 of the quality spec JSON (the 12 commodity parameters), stored off-chain like evidence.
    pub quality_spec_hash: [u8; 32],
    #[max_len(MAX_URI_LEN)]
    pub spec_uri: String,
    #[max_len(MAX_SHORT_STR_LEN)]
    pub elevator: String,
    #[max_len(MAX_SHORT_STR_LEN)]
    pub lab: String,
    /// Hybrid only: the issuer's election, made at most once and no later than maturity.
    pub election: Option<SettlementElection>,
    pub elected_at: i64,
    /// Evidence hash of the latest passing elevator receipt; zero until recorded.
    pub receipt_hash: [u8; 32],
    /// Evidence hash of the latest lab certificate and whether it passed.
    pub lab_cert_hash: [u8; 32],
    pub lab_passed: bool,
    /// Kilograms already claimed through `redeem_delivery`.
    pub delivered_kg: u64,
    pub bump: u8,
}

impl InstrumentTerms {
    /// Tokenized kilograms backing the whole issue: `volume_kg × tokenized_share_bps / 10_000`.
    pub fn tokenized_kg(&self) -> Option<u64> {
        let v = (self.volume_kg as u128).checked_mul(self.tokenized_share_bps as u128)? / BPS as u128;
        u64::try_from(v).ok()
    }

    /// The settlement that applies at `now`: fixed by the mode, or the Hybrid election, which
    /// defaults to delivery once maturity passes without one (the issuer did not exercise buyback).
    /// An elected buyback that is still unfunded `BUYBACK_GRACE_SECS` after maturity lapses into
    /// delivery too; a funded buyback has moved the pool to Redeeming by then, where this no longer matters.
    pub fn effective_election(&self, now: i64, maturity_ts: i64) -> Option<SettlementElection> {
        match self.settlement_mode {
            SettlementMode::CashBuyback => Some(SettlementElection::Buyback),
            SettlementMode::GrainDelivery => Some(SettlementElection::Delivery),
            SettlementMode::Hybrid => match self.election {
                Some(SettlementElection::Buyback) if now > maturity_ts.saturating_add(BUYBACK_GRACE_SECS) => Some(SettlementElection::Delivery),
                Some(e) => Some(e),
                None if now > maturity_ts => Some(SettlementElection::Delivery),
                None => None,
            },
        }
    }
}
