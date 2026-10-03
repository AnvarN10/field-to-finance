use anchor_lang::prelude::*;

use crate::{constants::BPS, error::F2fError};

/// `amount * (1 + yield_bps / 10_000)`, computed in u128 so large pools cannot wrap.
pub fn with_yield(amount: u64, yield_bps: u16) -> Result<u64> {
    let v = (amount as u128)
        .checked_mul(BPS as u128 + yield_bps as u128)
        .ok_or(F2fError::MathOverflow)?
        / BPS as u128;
    u64::try_from(v).map_err(|_| error!(F2fError::MathOverflow))
}
