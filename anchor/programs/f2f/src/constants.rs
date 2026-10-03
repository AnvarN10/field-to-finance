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
