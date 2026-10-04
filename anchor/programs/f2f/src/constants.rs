use anchor_lang::prelude::*;

#[constant]
pub const CONFIG_SEED: &[u8] = b"config";
#[constant]
pub const POOL_SEED: &[u8] = b"pool";
#[constant]
pub const MINT_SEED: &[u8] = b"mint";
#[constant]
pub const PROJECT_SEED: &[u8] = b"project";
#[constant]
pub const FIELD_SEED: &[u8] = b"field";
#[constant]
pub const ATTESTATION_SEED: &[u8] = b"attestation";
#[constant]
pub const INVESTOR_SEED: &[u8] = b"investor";
#[constant]
pub const FEES_SEED: &[u8] = b"fees";
#[constant]
pub const TERMS_SEED: &[u8] = b"terms";
#[constant]
pub const INSTRUMENT_SEED: &[u8] = b"instrument";

pub const BPS: u64 = 10_000;
pub const TOKENIZED_SHARE_BPS: u64 = 3_000;
pub const PREMIUM_MIN_BPS: u16 = 500;
pub const PREMIUM_MAX_BPS: u16 = 600;
pub const MAX_YIELD_BPS: u16 = 5_000;
pub const INSTRUMENT_DECIMALS: u8 = 6;
pub const MAX_FIELDS: u8 = 8;
pub const MAX_CROP_LEN: usize = 16;
pub const MAX_NAME_LEN: usize = 32;
pub const MAX_SYMBOL_LEN: usize = 10;
pub const MAX_URI_LEN: usize = 128;
pub const NDVI_SCALE: i16 = 10_000;
/// Hard ceiling for any pool's arrangement fee, whatever FeeConfig says (10%).
#[constant]
pub const MAX_ARRANGEMENT_BPS: u16 = 1_000;
/// Hard ceiling for the per-subscription network fee: 10 USDC.
#[constant]
pub const MAX_NETWORK_FEE: u64 = 10_000_000;
/// Hard ceiling for the project mint fee: 50 USDC.
#[constant]
pub const MAX_MINT_FEE: u64 = 50_000_000;
/// Hard ceiling for an Instrument's annual coupon (30%).
#[constant]
pub const MAX_COUPON_BPS: u16 = 3_000;
/// Longest interest period from `InstrumentTerms.start_ts` to maturity, in days (about five years).
#[constant]
pub const MAX_TERM_DAYS: i64 = 1_830;
/// Tokenized share of the harvest may not exceed 30%.
pub const MAX_TOKENIZED_SHARE_BPS: u16 = 3_000;
pub const MAX_SHORT_STR_LEN: usize = 32;
pub const SECONDS_PER_DAY: i64 = 86_400;
/// Denominator of the Act/360 day count.
pub const ACT360_YEAR_DAYS: u64 = 360;
