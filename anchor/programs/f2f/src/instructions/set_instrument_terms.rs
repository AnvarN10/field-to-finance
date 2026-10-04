use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::F2fError,
    state::{Config, DayCount, InstrumentTerms, InvestorRecord, Pool, PoolStatus, SettlementMode},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct InstrumentTermsArgs {
    pub unit_nominal: u64,
    pub coupon_bps_annual: u16,
    pub day_count: DayCount,
    pub start_ts: i64,
    pub settlement_mode: SettlementMode,
    pub volume_kg: u64,
    pub tokenized_share_bps: u16,
    pub quality_spec_hash: [u8; 32],
    pub spec_uri: String,
    pub elevator: String,
    pub lab: String,
}

/// Sets the term-sheet terms and the issuer of record of a Draft pool (ADR 0014).
/// Signed by the arranger (Config.issuer); the issuer of record must hold an approved KYC record.
#[derive(Accounts)]
pub struct SetInstrumentTerms<'info> {
    #[account(mut, address = config.issuer @ F2fError::Unauthorized)]
    pub arranger: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    /// CHECK: the farmer's wallet; only its KYC record is read.
    pub issuer_of_record: UncheckedAccount<'info>,
    #[account(seeds = [INVESTOR_SEED, issuer_of_record.key().as_ref()], bump = issuer_record.bump)]
    pub issuer_record: Account<'info, InvestorRecord>,
    #[account(
        init_if_needed,
        payer = arranger,
        space = 8 + InstrumentTerms::INIT_SPACE,
        seeds = [INSTRUMENT_SEED, pool.key().as_ref()],
        bump
    )]
    pub instrument_terms: Account<'info, InstrumentTerms>,
    pub system_program: Program<'info, System>,
}

pub fn handle_set_instrument_terms(ctx: Context<SetInstrumentTerms>, args: InstrumentTermsArgs) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    require!(pool.status == PoolStatus::Draft, F2fError::PoolNotDraft);
    require!(ctx.accounts.issuer_record.approved, F2fError::IssuerNotApproved);
    let issuer_of_record = ctx.accounts.issuer_of_record.key();
    // Projects already in the pool were checked against the current issuer of record.
    require!(pool.project_count == 0 || pool.issuer == issuer_of_record, F2fError::IssuerMismatch);

    require!(args.unit_nominal > 0, F2fError::InvalidTerms);
    require!(args.coupon_bps_annual <= MAX_COUPON_BPS, F2fError::InvalidCoupon);
    require!(args.day_count == DayCount::Act360, F2fError::UnsupportedDayCount);
    require!(args.volume_kg > 0, F2fError::InvalidTerms);
    require!((1..=MAX_TOKENIZED_SHARE_BPS).contains(&args.tokenized_share_bps), F2fError::InvalidTerms);
    require!(args.start_ts < pool.maturity_ts, F2fError::InvalidSchedule);
    let term_days = (pool.maturity_ts - args.start_ts) / SECONDS_PER_DAY;
    require!(term_days <= MAX_TERM_DAYS, F2fError::InvalidSchedule);
    require!(args.spec_uri.len() <= MAX_URI_LEN, F2fError::StringTooLong);
    require!(args.elevator.len() <= MAX_SHORT_STR_LEN, F2fError::StringTooLong);
    require!(args.lab.len() <= MAX_SHORT_STR_LEN, F2fError::StringTooLong);

    pool.issuer = issuer_of_record;
    let t = &mut ctx.accounts.instrument_terms;
    t.pool = pool.key();
    t.unit_nominal = args.unit_nominal;
    t.coupon_bps_annual = args.coupon_bps_annual;
    t.day_count = args.day_count;
    t.start_ts = args.start_ts;
    t.settlement_mode = args.settlement_mode;
    t.volume_kg = args.volume_kg;
    t.tokenized_share_bps = args.tokenized_share_bps;
    t.quality_spec_hash = args.quality_spec_hash;
    t.spec_uri = args.spec_uri;
    t.elevator = args.elevator;
    t.lab = args.lab;
    t.election = None;
    t.elected_at = 0;
    t.receipt_hash = [0; 32];
    t.lab_cert_hash = [0; 32];
    t.lab_passed = false;
    t.delivered_kg = 0;
    t.bump = ctx.bumps.instrument_terms;
    Ok(())
}
