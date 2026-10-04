use anchor_lang::prelude::*;

use crate::{constants::{ACT360_YEAR_DAYS, BPS, SECONDS_PER_DAY}, error::F2fError};

/// `amount * (1 + yield_bps / 10_000)`, computed in u128 so large pools cannot wrap.
pub fn with_yield(amount: u64, yield_bps: u16) -> Result<u64> {
    let v = (amount as u128)
        .checked_mul(BPS as u128 + yield_bps as u128)
        .ok_or(F2fError::MathOverflow)?
        / BPS as u128;
    u64::try_from(v).map_err(|_| error!(F2fError::MathOverflow))
}

/// `amount * bps / 10_000`, rounded down (in the payer's favour), computed in u128.
/// Rejects `bps` above 100% so the fee can never exceed the amount.
pub fn bps_fee(amount: u64, bps: u16) -> Result<u64> {
    require!(bps as u64 <= BPS, F2fError::FeeTooHigh);
    let v = (amount as u128).checked_mul(bps as u128).ok_or(F2fError::MathOverflow)? / BPS as u128;
    u64::try_from(v).map_err(|_| error!(F2fError::MathOverflow))
}

/// Splits `amount` into `(fee, net)` where `fee = bps_fee(amount, bps)` and `fee + net == amount`.
pub fn split_fee(amount: u64, bps: u16) -> Result<(u64, u64)> {
    let fee = bps_fee(amount, bps)?;
    let net = amount.checked_sub(fee).ok_or(F2fError::MathOverflow)?;
    Ok((fee, net))
}

/// Whole days from `start_ts` to `maturity_ts` (Act: actual elapsed days, partial days dropped).
pub fn actual_days(start_ts: i64, maturity_ts: i64) -> Result<u64> {
    require!(maturity_ts >= start_ts, F2fError::InvalidSchedule);
    let secs = maturity_ts.checked_sub(start_ts).ok_or(F2fError::MathOverflow)?;
    Ok((secs / SECONDS_PER_DAY) as u64)
}

/// `amount × (1 + coupon_bps / 10_000 × days / 360)`, Act/360, in u128, rounded down.
pub fn with_coupon(amount: u64, coupon_bps: u16, days: u64) -> Result<u64> {
    // amount × (10_000 × 360 + coupon × days) / (10_000 × 360): one division, so one floor.
    let denom = BPS as u128 * ACT360_YEAR_DAYS as u128;
    let factor = (coupon_bps as u128).checked_mul(days as u128).and_then(|i| i.checked_add(denom)).ok_or(F2fError::MathOverflow)?;
    let v = (amount as u128).checked_mul(factor).ok_or(F2fError::MathOverflow)? / denom;
    u64::try_from(v).map_err(|_| error!(F2fError::MathOverflow))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bps_fee_rounds_down_in_the_payers_favour() {
        assert_eq!(bps_fee(100_000_000_000, 200).unwrap(), 2_000_000_000);
        // 101 * 200 / 10_000 = 2.02 -> 2
        assert_eq!(bps_fee(101, 200).unwrap(), 2);
        // 49 * 200 / 10_000 = 0.98 -> 0
        assert_eq!(bps_fee(49, 200).unwrap(), 0);
        assert_eq!(bps_fee(1_000, 0).unwrap(), 0);
    }

    #[test]
    fn bps_fee_cannot_overflow_on_the_largest_amount() {
        assert_eq!(bps_fee(u64::MAX, 10_000).unwrap(), u64::MAX);
        assert_eq!(bps_fee(u64::MAX, 1_000).unwrap(), u64::MAX / 10);
    }

    #[test]
    fn bps_fee_rejects_more_than_one_hundred_percent() {
        assert!(bps_fee(1_000, 10_001).is_err());
    }

    #[test]
    fn split_fee_returns_fee_and_net_that_add_up() {
        let (fee, net) = split_fee(100_000_000_000, 200).unwrap();
        assert_eq!(fee, 2_000_000_000);
        assert_eq!(net, 98_000_000_000);
        let (fee, net) = split_fee(101, 200).unwrap();
        assert_eq!(fee + net, 101);
    }
}
