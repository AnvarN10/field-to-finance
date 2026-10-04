use anchor_lang::prelude::*;

#[event]
pub struct ArrangementFeeWithheld {
    pub pool: Pubkey,
    pub project: Pubkey,
    pub requested: u64,
    pub fee: u64,
    pub net: u64,
}

#[event]
pub struct NetworkFeeCharged {
    pub pool: Pubkey,
    pub investor: Pubkey,
    pub amount: u64,
    pub fee: u64,
}

#[event]
pub struct MintFeeCharged {
    pub project: Pubkey,
    pub producer: Pubkey,
    pub fee: u64,
}

/// Settlement chosen for a Hybrid Instrument.
#[event]
pub struct SettlementElected {
    pub pool: Pubkey,
    pub signer: Pubkey,
    pub election: crate::state::SettlementElection,
}

/// An investor burned `amount` Instrument base units for `kg` of grain at the elevator.
/// Off-chain, the claim is honoured against the elevator receipt and later maps to a
/// grain-receipt token on CommodityChain.
#[event]
pub struct GrainClaim {
    pub pool: Pubkey,
    pub investor: Pubkey,
    pub amount: u64,
    pub kg: u64,
    pub receipt_hash: [u8; 32],
}
