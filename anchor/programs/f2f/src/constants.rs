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
