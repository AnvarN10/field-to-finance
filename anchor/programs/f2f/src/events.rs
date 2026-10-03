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
