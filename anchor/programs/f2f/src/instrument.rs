//! Helpers for pools with InstrumentTerms (ADR 0014). Pools without terms keep the flat-yield path.
use anchor_lang::prelude::*;

use crate::{
    fees::load_optional,
    math::{actual_days, with_coupon, with_yield},
    state::{InstrumentTerms, Pool},
};

/// Reads InstrumentTerms at its PDA (already checked by a `seeds` constraint); `None` if absent.
pub fn load_instrument_terms(info: &AccountInfo) -> Result<Option<InstrumentTerms>> {
    load_optional::<InstrumentTerms>(info)
}

/// What a holder of `amount` principal receives in cash: `principal × (1 + coupon × days / 360)` with
/// days from `start_ts` to maturity when terms exist, else the pool's flat `yield_bps`.
pub fn redemption_due(amount: u64, pool: &Pool, terms: Option<&InstrumentTerms>) -> Result<u64> {
    match terms {
        Some(t) => with_coupon(amount, t.coupon_bps_annual, actual_days(t.start_ts, pool.maturity_ts)?),
        None => with_yield(amount, pool.yield_bps),
    }
}
