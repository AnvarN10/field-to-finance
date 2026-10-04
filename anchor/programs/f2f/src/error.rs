use anchor_lang::prelude::*;

#[error_code]
pub enum F2fError {
    #[msg("Signer does not hold the required role")]
    Unauthorized,
    #[msg("Premium must be between 500 and 600 bps")]
    InvalidPremium,
    #[msg("Yield is out of range")]
    InvalidYield,
    #[msg("Subscription close must be in the future and before maturity")]
    InvalidSchedule,
    #[msg("String is too long")]
    StringTooLong,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Pool is not in Draft")]
    PoolNotDraft,
    #[msg("Pool is not Open")]
    PoolNotOpen,
    #[msg("Pool is not Funded")]
    PoolNotFunded,
    #[msg("Pool is not Refunding")]
    PoolNotRefunding,
    #[msg("Pool is not Redeeming")]
    PoolNotRedeeming,
    #[msg("Pool has no projects")]
    NoProjects,
    #[msg("Project is already in a pool")]
    ProjectAlreadyInPool,
    #[msg("Project is not in this pool")]
    ProjectNotInPool,
    #[msg("Project crop or season does not match the pool")]
    CropMismatch,
    #[msg("Project has no fields")]
    NoFields,
    #[msg("Too many fields")]
    TooManyFields,
    #[msg("Every field must be verified")]
    FieldsNotVerified,
    #[msg("Fields cannot change after the project joins a pool")]
    ProjectLocked,
    #[msg("Field does not belong to this project")]
    FieldMismatch,
    #[msg("NDVI must be between -1 and 1")]
    InvalidNdvi,
    #[msg("Subscription period has ended")]
    SubscriptionClosed,
    #[msg("Subscription is still open")]
    SubscriptionStillOpen,
    #[msg("Subscription exceeds the pool target")]
    ExceedsTarget,
    #[msg("Investor is not approved")]
    InvestorNotApproved,
    #[msg("Project was already disbursed")]
    AlreadyDisbursed,
    #[msg("Project was not disbursed")]
    NotDisbursed,
    #[msg("Harvest has not been attested")]
    HarvestNotAttested,
    #[msg("Project is already settled")]
    AlreadySettled,
    #[msg("Every project must be disbursed before redemption funding")]
    NotAllDisbursed,
    #[msg("Instrument is still outstanding")]
    InstrumentOutstanding,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Fee is above the allowed cap")]
    FeeTooHigh,
    #[msg("Treasury account is not the fee treasury's USDC account")]
    InvalidTreasury,
    #[msg("A fee is due but its accounts were not provided")]
    MissingFeeAccount,
    // Appended for instrument terms (ADR 0014); existing codes keep their numbers.
    #[msg("Issuer of record has no approved KYC record")]
    IssuerNotApproved,
    #[msg("Project or terms do not match the pool's issuer of record")]
    IssuerMismatch,
    #[msg("Instrument terms are invalid")]
    InvalidTerms,
    #[msg("Coupon is above the allowed cap")]
    InvalidCoupon,
    #[msg("Day count is not supported")]
    UnsupportedDayCount,
    #[msg("Amount must be a whole number of tokens")]
    NotWholeTokens,
    #[msg("Pool target must be a whole number of tokens")]
    TargetNotWholeTokens,
    #[msg("Settlement election applies only to Hybrid instruments")]
    NotHybrid,
    #[msg("Settlement was already elected")]
    AlreadyElected,
    #[msg("Settlement election closed at maturity")]
    ElectionClosed,
    #[msg("Grain delivery is not the settlement for this pool")]
    DeliveryNotElected,
    #[msg("Grain delivery was elected; cash redemption is closed")]
    DeliveryElected,
    #[msg("Elevator receipt and a passing lab certificate are required")]
    DeliveryNotAttested,
    #[msg("Attestation kind is not allowed here")]
    InvalidAttestationKind,
    #[msg("Maturity has not been reached")]
    NotMatured,
}
