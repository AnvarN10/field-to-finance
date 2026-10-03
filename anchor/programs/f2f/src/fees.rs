//! Helpers shared by every instruction that charges a platform fee.
use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address_with_program_id;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TransferChecked};

use crate::{error::F2fError, state::{FeeConfig, PoolTerms}};

/// Reads an account at a PDA address the caller already verified with a `seeds` constraint.
/// Returns `None` while the account does not exist, so deployments without it keep working,
/// but a client cannot dodge a fee by omitting it: the address is fixed.
fn load_optional<T: AccountDeserialize + Owner>(info: &AccountInfo) -> Result<Option<T>> {
    if info.data_is_empty() || info.owner != &T::owner() {
        return Ok(None);
    }
    let data = info.try_borrow_data()?;
    Ok(Some(T::try_deserialize(&mut &data[..])?))
}

pub fn load_fee_config(info: &AccountInfo) -> Result<Option<FeeConfig>> {
    load_optional::<FeeConfig>(info)
}

pub fn load_arrangement_fee_bps(info: &AccountInfo) -> Result<u16> {
    Ok(load_optional::<PoolTerms>(info)?.map(|t| t.arrangement_fee_bps).unwrap_or(0))
}

/// The treasury account must be exactly the USDC ATA of `FeeConfig.treasury`.
pub fn checked_treasury<'a, 'info>(
    treasury_usdc: &'a Option<InterfaceAccount<'info, TokenAccount>>,
    fees: &FeeConfig,
    usdc_mint: &Pubkey,
    usdc_token_program: &Pubkey,
) -> Result<&'a InterfaceAccount<'info, TokenAccount>> {
    let t = treasury_usdc.as_ref().ok_or(F2fError::MissingFeeAccount)?;
    let expected = get_associated_token_address_with_program_id(&fees.treasury, usdc_mint, usdc_token_program);
    require_keys_eq!(t.key(), expected, F2fError::InvalidTreasury);
    Ok(t)
}

/// Transfers `amount` USDC signed by a wallet (investor or producer).
pub fn pay_fee<'info>(
    token_program: AccountInfo<'info>,
    from: AccountInfo<'info>,
    mint: &InterfaceAccount<'info, Mint>,
    to: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    transfer_checked(
        CpiContext::new(token_program.key(), TransferChecked { from, mint: mint.to_account_info(), to, authority }),
        amount,
        mint.decimals,
    )
}
