//! Pilot term sheet: farmer as issuer of record, InstrumentTerms, whole tokens, Act/360 coupon,
//! hybrid settlement election, delivery attestations and grain claims (ADR 0014).
mod common;
use anchor_lang::prelude::Pubkey;
use common::*;
use f2f::{AttestationKind as K, SettlementElection as E, SettlementMode as M, SettlementRule, Verdict};
use solana_keypair::Keypair;
use solana_signer::Signer;

const POOL_DUE_300D: u64 = 1_041_666_666_666; // $1,000,000 × (1 + 5% × 300/360), floored
const TOKEN_DUE_300D: u64 = 104_166_666_666; // $100,000 × (1 + 5% × 300/360), floored

fn maturity(env: &Env) -> i64 {
    fetch::<f2f::Pool>(&env.svm, &pda_pool(1)).maturity_ts
}

fn terms(env: &Env) -> f2f::InstrumentTerms {
    fetch(&env.svm, &pda_instrument(&pda_pool(1)))
}

/// Harvest attested on field 0 and the project settled, so only the vault balance and maturity gate redemption.
fn settle(env: &mut Env, project: Pubkey) {
    let scas = env.scas.insecure_clone();
    let issuer = env.issuer.insecure_clone();
    env.send(&[attest_ix(env, project, 0, 1, K::Harvest, Verdict::Pass)], &scas, &[]).unwrap();
    env.send(&[settle_ix(env, 1, project, SettlementRule::Delivered)], &issuer, &[]).unwrap();
}

/// Draft pool 1 with no projects; the producer is KYC-approved.
fn draft_pool(env: &mut Env) {
    let issuer = env.issuer.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    env.send(&[approve_ix(env, env.producer.pubkey())], &compliance, &[]).unwrap();
    let args = default_pool_args(env);
    env.send(&[create_pool_ix(env, 1, args)], &issuer, &[]).unwrap();
}

// ---- math ----

#[test]
fn act360_coupon_matches_the_pilot_numbers() {
    assert_eq!(f2f::math::with_coupon(1_000_000 * USDC, 500, 300).unwrap(), POOL_DUE_300D);
    assert_eq!(f2f::math::with_coupon(NOMINAL, 500, 300).unwrap(), TOKEN_DUE_300D);
    // A full 360-day year pays exactly the coupon.
    assert_eq!(f2f::math::with_coupon(1_000_000 * USDC, 500, 360).unwrap(), 1_050_000 * USDC);
    assert_eq!(f2f::math::with_coupon(1_000_000 * USDC, 500, 0).unwrap(), 1_000_000 * USDC);
}

#[test]
fn act360_coupon_rounds_down_and_cannot_wrap() {
    // 1 base unit × 5% × 300/360 = 0.0416 -> 0
    assert_eq!(f2f::math::with_coupon(1, 500, 300).unwrap(), 1);
    assert!(f2f::math::with_coupon(u64::MAX, 3_000, 1_800).is_err());
}

#[test]
fn actual_days_count_whole_days_between_start_and_maturity() {
    let start = 1_800_000_000;
    assert_eq!(f2f::math::actual_days(start, start + 300 * 86_400).unwrap(), 300);
    assert_eq!(f2f::math::actual_days(start, start + 300 * 86_400 + 86_399).unwrap(), 300);
    assert_eq!(f2f::math::actual_days(start, start).unwrap(), 0);
    assert!(f2f::math::actual_days(start, start - 1).is_err());
}

// ---- issuer of record and terms ----

#[test]
fn terms_make_the_kyc_approved_farmer_the_issuer_of_record() {
    let mut env = setup_configured();
    let (pool, _) = seed_pilot_pool(&mut env, M::Hybrid);
    let p: f2f::Pool = fetch(&env.svm, &pool);
    assert_eq!(p.issuer, env.producer.pubkey());
    let t = terms(&env);
    assert_eq!(t.pool, pool);
    assert_eq!(t.unit_nominal, NOMINAL);
    assert_eq!(t.coupon_bps_annual, 500);
    assert_eq!(t.settlement_mode, M::Hybrid);
    assert_eq!(t.volume_kg, 10_000_000);
    assert_eq!(t.tokenized_share_bps, 3_000);
    assert_eq!(t.elevator, "Ust-Kamenogorsk");
    assert_eq!(t.lab, "Baltic Control");
    assert_eq!(t.election, None);
}

#[test]
fn issuer_of_record_needs_an_approved_kyc_record() {
    let mut env = setup_configured();
    let issuer = env.issuer.insecure_clone();
    let args = default_pool_args(&env);
    env.send(&[create_pool_ix(&env, 1, args)], &issuer, &[]).unwrap();
    let t = pilot_terms_args(now(&env.svm));
    let err = env.send_err(&[set_instrument_terms_ix(&env, issuer.pubkey(), 1, env.producer.pubkey(), t)], &issuer, &[]);
    assert!(err.contains("AccountNotInitialized"), "{err}");

    let compliance = env.compliance.insecure_clone();
    let producer = env.producer.pubkey();
    env.send(&[approve_ix(&env, producer)], &compliance, &[]).unwrap();
    let pool = pda_pool(1);
    let revoke = ix(
        f2f::instruction::RevokeInvestor {},
        f2f::accounts::RevokeInvestor {
            compliance: compliance.pubkey(),
            config: pda_config(),
            pool,
            mint: pda_mint(&pool),
            investor: producer,
            investor_record: pda_investor(&producer),
            investor_instrument: None,
            token_program: TOKEN_2022,
        },
    );
    env.send(&[revoke], &compliance, &[]).unwrap();
    let t = pilot_terms_args(now(&env.svm));
    let err = env.send_err(&[set_instrument_terms_ix(&env, issuer.pubkey(), 1, producer, t)], &issuer, &[]);
    assert!(err.contains("IssuerNotApproved"), "{err}");
}

#[test]
fn only_the_arranger_sets_terms() {
    let mut env = setup_configured();
    draft_pool(&mut env);
    let producer = env.producer.insecure_clone();
    let t = pilot_terms_args(now(&env.svm));
    let err = env.send_err(&[set_instrument_terms_ix(&env, producer.pubkey(), 1, producer.pubkey(), t)], &producer, &[]);
    assert!(err.contains("Unauthorized"), "{err}");
}

#[test]
fn terms_are_validated() {
    let mut env = setup_configured();
    draft_pool(&mut env);
    let issuer = env.issuer.insecure_clone();
    let producer = env.producer.pubkey();
    let t0 = now(&env.svm);
    let m = maturity(&env);
    let cases: Vec<(Box<dyn Fn(&mut f2f::InstrumentTermsArgs)>, &str)> = vec![
        (Box::new(|a| a.unit_nominal = 0), "InvalidTerms"),
        (Box::new(|a| a.coupon_bps_annual = f2f::MAX_COUPON_BPS + 1), "InvalidCoupon"),
        (Box::new(|a| a.day_count = f2f::DayCount::Act365), "UnsupportedDayCount"),
        (Box::new(|a| a.tokenized_share_bps = 3_001), "InvalidTerms"),
        (Box::new(|a| a.tokenized_share_bps = 0), "InvalidTerms"),
        (Box::new(|a| a.volume_kg = 0), "InvalidTerms"),
        (Box::new(move |a| a.start_ts = m), "InvalidSchedule"),
        (Box::new(move |a| a.start_ts = m - (f2f::MAX_TERM_DAYS + 1) * 86_400), "InvalidSchedule"),
        (Box::new(|a| a.spec_uri = "x".repeat(129)), "StringTooLong"),
        (Box::new(|a| a.elevator = "x".repeat(33)), "StringTooLong"),
        (Box::new(|a| a.lab = "x".repeat(33)), "StringTooLong"),
    ];
    for (change, expected) in cases {
        let mut a = pilot_terms_args(t0);
        change(&mut a);
        let err = env.send_err(&[set_instrument_terms_ix(&env, issuer.pubkey(), 1, producer, a)], &issuer, &[]);
        assert!(err.contains(expected), "expected {expected}: {err}");
    }
}

#[test]
fn terms_are_fixed_once_the_pool_opens() {
    let mut env = setup_configured();
    seed_pilot_pool(&mut env, M::Hybrid);
    let issuer = env.issuer.insecure_clone();
    let t = pilot_terms_args(now(&env.svm));
    let err = env.send_err(&[set_instrument_terms_ix(&env, issuer.pubkey(), 1, env.producer.pubkey(), t)], &issuer, &[]);
    assert!(err.contains("PoolNotDraft"), "{err}");
}

#[test]
fn a_farmer_issued_pool_takes_only_that_farmers_projects() {
    let mut env = setup_configured();
    draft_pool(&mut env);
    let issuer = env.issuer.insecure_clone();
    let t = pilot_terms_args(now(&env.svm));
    env.send(&[set_instrument_terms_ix(&env, issuer.pubkey(), 1, env.producer.pubkey(), t)], &issuer, &[]).unwrap();

    // Another farmer's verified project.
    let other = Keypair::new();
    env.svm.airdrop(&other.pubkey(), 10_000_000_000).unwrap();
    let project = pda_project(&other.pubkey(), 7);
    let rp = ix(
        f2f::instruction::RegisterProject { project_id: 7, crop: "wheat".into(), season: 2027, expected_kg: 4_000_000, requested_amount: NOMINAL },
        f2f::accounts::RegisterProject {
            producer: other.pubkey(),
            payer: other.pubkey(),
            config: pda_config(),
            project,
            fee_config: pda_fees(),
            usdc_mint: None,
            producer_usdc: None,
            treasury_usdc: None,
            usdc_token_program: None,
            system_program: anchor_lang::solana_program::system_program::ID,
        },
    );
    let rf = ix(
        f2f::instruction::RegisterField { polygon_hash: [3; 32], area_ha_x100: 100_000 },
        f2f::accounts::RegisterField {
            producer: other.pubkey(),
            payer: other.pubkey(),
            project,
            field: pda_field(&project, 0),
            system_program: anchor_lang::solana_program::system_program::ID,
        },
    );
    env.send(&[rp, rf], &other, &[]).unwrap();
    verify_all_fields(&mut env, project, 1);
    let err = env.send_err(&[add_project_ix(&env, 1, project)], &issuer, &[]);
    assert!(err.contains("IssuerMismatch"), "{err}");
}

#[test]
fn issuer_of_record_cannot_change_after_projects_join() {
    let mut env = setup_configured();
    draft_pool(&mut env);
    let issuer = env.issuer.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    let producer = env.producer.pubkey();
    let project = seed_project(&mut env, 1, 1);
    verify_all_fields(&mut env, project, 1);
    let t = pilot_terms_args(now(&env.svm));
    env.send(&[set_instrument_terms_ix(&env, issuer.pubkey(), 1, producer, t), add_project_ix(&env, 1, project)], &issuer, &[]).unwrap();
    // Same issuer may still amend the terms while Draft.
    let mut t = pilot_terms_args(now(&env.svm));
    t.coupon_bps_annual = 600;
    env.send(&[set_instrument_terms_ix(&env, issuer.pubkey(), 1, producer, t)], &issuer, &[]).unwrap();
    assert_eq!(terms(&env).coupon_bps_annual, 600);
    // A different issuer may not.
    let other = Keypair::new().pubkey();
    env.send(&[approve_ix(&env, other)], &compliance, &[]).unwrap();
    let t = pilot_terms_args(now(&env.svm));
    let err = env.send_err(&[set_instrument_terms_ix(&env, issuer.pubkey(), 1, other, t)], &issuer, &[]);
    assert!(err.contains("IssuerMismatch"), "{err}");
}

#[test]
fn a_pool_target_must_be_whole_tokens_to_open() {
    let mut env = setup_configured();
    draft_pool(&mut env);
    let issuer = env.issuer.insecure_clone();
    let project = seed_project(&mut env, 1, 1); // asks 100,000 USDC
    verify_all_fields(&mut env, project, 1);
    let mut t = pilot_terms_args(now(&env.svm));
    t.unit_nominal = 30_000 * USDC;
    env.send(&[set_instrument_terms_ix(&env, issuer.pubkey(), 1, env.producer.pubkey(), t), add_project_ix(&env, 1, project)], &issuer, &[]).unwrap();
    let err = env.send_err(&[open_pool_ix(&env, 1)], &issuer, &[]);
    assert!(err.contains("TargetNotWholeTokens"), "{err}");
}

// ---- subscription in whole tokens ----

#[test]
fn subscriptions_are_whole_tokens_of_the_nominal() {
    let mut env = setup_configured();
    seed_pilot_pool(&mut env, M::Hybrid);
    let investor = env.investor.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    fund_usdc(&mut env, &investor.pubkey(), 1_000_000 * USDC);
    env.send(&[approve_ix(&env, investor.pubkey())], &compliance, &[]).unwrap();
    for bad in [50_000 * USDC, 150_000 * USDC, NOMINAL + 1] {
        let err = env.send_err(&[subscribe_ix(&env, 1, investor.pubkey(), bad)], &investor, &[]);
        assert!(err.contains("NotWholeTokens"), "{bad}: {err}");
    }
    env.send(&[subscribe_ix(&env, 1, investor.pubkey(), 2 * NOMINAL)], &investor, &[]).unwrap();
    assert_eq!(fetch::<f2f::Pool>(&env.svm, &pda_pool(1)).raised_amount, 2 * NOMINAL);
}

// ---- buyback path ----

#[test]
fn buyback_pays_the_act360_coupon_funded_by_the_farmer_issuer() {
    let mut env = setup_configured();
    let (pool, project) = seed_pilot_funded(&mut env, M::Hybrid);
    let producer = env.producer.insecure_clone();
    let investor = env.investor.insecure_clone();
    env.send(&[elect_settlement_ix(&env, producer.pubkey(), 1, E::Buyback)], &producer, &[]).unwrap();
    assert_eq!(terms(&env).election, Some(E::Buyback));
    settle(&mut env, project);
    let m = maturity(&env);
    warp_to(&mut env.svm, m);

    // One base unit short of the coupon formula keeps the pool Funded; the flat 12% yield is not used.
    fund_usdc(&mut env, &producer.pubkey(), POOL_DUE_300D);
    env.send(&[fund_redemption_by_ix(&env, producer.pubkey(), 1, POOL_DUE_300D - 1)], &producer, &[]).unwrap();
    assert_eq!(fetch::<f2f::Pool>(&env.svm, &pool).status, f2f::PoolStatus::Funded);
    env.send(&[fund_redemption_by_ix(&env, producer.pubkey(), 1, 1)], &producer, &[]).unwrap();
    assert_eq!(fetch::<f2f::Pool>(&env.svm, &pool).status, f2f::PoolStatus::Redeeming);

    let usdc = ata(&investor.pubkey(), &env.usdc_mint.pubkey(), &SPL_TOKEN);
    env.send(&[redeem_ix(&env, 1, investor.pubkey(), NOMINAL)], &investor, &[]).unwrap();
    assert_eq!(token_balance(&env.svm, &usdc), TOKEN_DUE_300D);
    env.send(&[redeem_ix(&env, 1, investor.pubkey(), 9 * NOMINAL)], &investor, &[]).unwrap();
    assert_eq!(token_balance(&env.svm, &usdc), TOKEN_DUE_300D + f2f::math::with_coupon(9 * NOMINAL, 500, 300).unwrap());
    // Floor rounding per redemption never asks for more than the vault holds.
    assert!(token_balance(&env.svm, &usdc) <= POOL_DUE_300D);
}

#[test]
fn the_arranger_can_still_fund_a_farmer_issued_buyback() {
    let mut env = setup_configured();
    let (pool, project) = seed_pilot_funded(&mut env, M::CashBuyback);
    let issuer = env.issuer.insecure_clone();
    settle(&mut env, project);
    let m = maturity(&env);
    warp_to(&mut env.svm, m);
    fund_usdc(&mut env, &issuer.pubkey(), POOL_DUE_300D);
    env.send(&[fund_redemption_ix(&env, 1, POOL_DUE_300D)], &issuer, &[]).unwrap();
    assert_eq!(fetch::<f2f::Pool>(&env.svm, &pool).status, f2f::PoolStatus::Redeeming);
}

#[test]
fn nobody_else_funds_redemption() {
    let mut env = setup_configured();
    seed_pilot_funded(&mut env, M::CashBuyback);
    let investor = env.investor.insecure_clone();
    let err = env.send_err(&[fund_redemption_by_ix(&env, investor.pubkey(), 1, 0)], &investor, &[]);
    assert!(err.contains("Unauthorized"), "{err}");
}

// ---- settlement election ----

#[test]
fn election_is_hybrid_only_once_and_before_maturity() {
    let mut env = setup_configured();
    seed_pilot_funded(&mut env, M::CashBuyback);
    let issuer = env.issuer.insecure_clone();
    let err = env.send_err(&[elect_settlement_ix(&env, issuer.pubkey(), 1, E::Delivery)], &issuer, &[]);
    assert!(err.contains("NotHybrid"), "{err}");

    let mut env = setup_configured();
    seed_pilot_funded(&mut env, M::Hybrid);
    let issuer = env.issuer.insecure_clone();
    let investor = env.investor.insecure_clone();
    let err = env.send_err(&[elect_settlement_ix(&env, investor.pubkey(), 1, E::Buyback)], &investor, &[]);
    assert!(err.contains("Unauthorized"), "{err}");
    env.send(&[elect_settlement_ix(&env, issuer.pubkey(), 1, E::Delivery)], &issuer, &[]).unwrap();
    let err = env.send_err(&[elect_settlement_ix(&env, issuer.pubkey(), 1, E::Buyback)], &issuer, &[]);
    assert!(err.contains("AlreadyElected"), "{err}");

    let mut env = setup_configured();
    seed_pilot_funded(&mut env, M::Hybrid);
    let producer = env.producer.insecure_clone();
    let m = maturity(&env);
    warp_to(&mut env.svm, m + 1);
    let err = env.send_err(&[elect_settlement_ix(&env, producer.pubkey(), 1, E::Buyback)], &producer, &[]);
    assert!(err.contains("ElectionClosed"), "{err}");
}

#[test]
fn without_an_election_a_hybrid_pool_defaults_to_delivery_after_maturity() {
    let mut env = setup_configured();
    let (_, project) = seed_pilot_funded(&mut env, M::Hybrid);
    let producer = env.producer.insecure_clone();
    settle(&mut env, project);
    let m = maturity(&env);
    warp_to(&mut env.svm, m + 1);
    let err = env.send_err(&[fund_redemption_by_ix(&env, producer.pubkey(), 1, 0)], &producer, &[]);
    assert!(err.contains("DeliveryElected"), "{err}");
}

#[test]
fn cash_is_accepted_only_once_buyback_is_elected() {
    // Review I1: a deposit before the election could be locked in the vault if delivery followed.
    let mut env = setup_configured();
    let (pool, project) = seed_pilot_funded(&mut env, M::Hybrid);
    let producer = env.producer.insecure_clone();
    settle(&mut env, project);
    fund_usdc(&mut env, &producer.pubkey(), POOL_DUE_300D);
    let err = env.send_err(&[fund_redemption_by_ix(&env, producer.pubkey(), 1, POOL_DUE_300D)], &producer, &[]);
    assert!(err.contains("ElectionPending"), "{err}");
    // A zero re-check is harmless and stays allowed.
    env.send(&[fund_redemption_by_ix(&env, producer.pubkey(), 1, 0)], &producer, &[]).unwrap();
    assert_eq!(token_balance(&env.svm, &ata(&pool, &env.usdc_mint.pubkey(), &SPL_TOKEN)), 0);
    env.send(&[elect_settlement_ix(&env, producer.pubkey(), 1, E::Buyback)], &producer, &[]).unwrap();
    env.send(&[fund_redemption_by_ix(&env, producer.pubkey(), 1, POOL_DUE_300D)], &producer, &[]).unwrap();
}

#[test]
fn an_unfunded_buyback_lapses_into_delivery_after_the_grace_period() {
    // Review I2: a farmer who elects buyback and never funds it cannot lock holders out of the grain.
    let mut env = setup_configured();
    let (_, project) = seed_pilot_funded(&mut env, M::Hybrid);
    let producer = env.producer.insecure_clone();
    let investor = env.investor.insecure_clone();
    env.send(&[elect_settlement_ix(&env, producer.pubkey(), 1, E::Buyback)], &producer, &[]).unwrap();
    let m = maturity(&env);
    warp_to(&mut env.svm, m + f2f::BUYBACK_GRACE_SECS);
    // Still inside the grace period: buyback holds, delivery is refused.
    let err = env.send_err(&[redeem_delivery_ix(&env, 1, investor.pubkey(), NOMINAL)], &investor, &[]);
    assert!(err.contains("DeliveryNotElected"), "{err}");
    warp_to(&mut env.svm, m + f2f::BUYBACK_GRACE_SECS + 1);
    let err = env.send_err(&[fund_redemption_by_ix(&env, producer.pubkey(), 1, 0)], &producer, &[]);
    assert!(err.contains("DeliveryElected"), "{err}");
    record(&mut env, project, 1, K::ElevatorReceipt, Verdict::Pass, [0xE1; 32]);
    record(&mut env, project, 2, K::LabQuality, Verdict::Pass, [0x1A; 32]);
    env.send(&[redeem_delivery_ix(&env, 1, investor.pubkey(), NOMINAL)], &investor, &[]).unwrap();
    assert_eq!(terms(&env).delivered_kg, 300_000);
}

#[test]
fn a_funded_buyback_does_not_lapse() {
    let mut env = setup_configured();
    let (pool, project) = seed_pilot_funded(&mut env, M::Hybrid);
    let producer = env.producer.insecure_clone();
    let investor = env.investor.insecure_clone();
    env.send(&[elect_settlement_ix(&env, producer.pubkey(), 1, E::Buyback)], &producer, &[]).unwrap();
    settle(&mut env, project);
    let m = maturity(&env);
    warp_to(&mut env.svm, m);
    fund_usdc(&mut env, &producer.pubkey(), POOL_DUE_300D);
    env.send(&[fund_redemption_by_ix(&env, producer.pubkey(), 1, POOL_DUE_300D)], &producer, &[]).unwrap();
    assert_eq!(fetch::<f2f::Pool>(&env.svm, &pool).status, f2f::PoolStatus::Redeeming);
    warp_to(&mut env.svm, m + f2f::BUYBACK_GRACE_SECS + 10);
    let err = env.send_err(&[redeem_delivery_ix(&env, 1, investor.pubkey(), NOMINAL)], &investor, &[]);
    assert!(err.contains("PoolNotFunded"), "{err}");
    env.send(&[redeem_ix(&env, 1, investor.pubkey(), NOMINAL)], &investor, &[]).unwrap();
}

// ---- delivery path ----

fn record(env: &mut Env, project: Pubkey, seq: u32, kind: K, verdict: Verdict, hash: [u8; 32]) {
    let scas = env.scas.insecure_clone();
    env.send(&[record_delivery_ix(env, scas.pubkey(), 1, project, 0, seq, kind, verdict, hash)], &scas, &[]).unwrap();
}

#[test]
fn delivery_burns_tokens_for_a_pro_rata_grain_claim() {
    let mut env = setup_configured();
    let (pool, project) = seed_pilot_funded(&mut env, M::Hybrid);
    let producer = env.producer.insecure_clone();
    let investor = env.investor.insecure_clone();
    env.send(&[elect_settlement_ix(&env, producer.pubkey(), 1, E::Delivery)], &producer, &[]).unwrap();

    // Cash redemption deposits are refused once delivery is elected.
    fund_usdc(&mut env, &producer.pubkey(), NOMINAL);
    let err = env.send_err(&[fund_redemption_by_ix(&env, producer.pubkey(), 1, NOMINAL)], &producer, &[]);
    assert!(err.contains("DeliveryElected"), "{err}");

    let m = maturity(&env);
    warp_to(&mut env.svm, m);
    let err = env.send_err(&[redeem_delivery_ix(&env, 1, investor.pubkey(), NOMINAL)], &investor, &[]);
    assert!(err.contains("DeliveryNotAttested"), "{err}");

    // Field 0 already has its FieldVerified attestation at sequence 0.
    record(&mut env, project, 1, K::ElevatorReceipt, Verdict::Pass, [0xE1; 32]);
    let err = env.send_err(&[redeem_delivery_ix(&env, 1, investor.pubkey(), NOMINAL)], &investor, &[]);
    assert!(err.contains("DeliveryNotAttested"), "{err}");
    record(&mut env, project, 2, K::LabQuality, Verdict::Pass, [0x1A; 32]);
    let a: f2f::Attestation = fetch(&env.svm, &pda_attestation(&pda_field(&project, 0), 2));
    assert_eq!(a.kind, K::LabQuality);
    let t = terms(&env);
    assert_eq!(t.receipt_hash, [0xE1; 32]);
    assert_eq!(t.lab_cert_hash, [0x1A; 32]);
    assert!(t.lab_passed);

    // 3 of 10 tokens claim 30% of the tokenized 3,000 t = 900 t.
    env.send(&[redeem_delivery_ix(&env, 1, investor.pubkey(), 3 * NOMINAL)], &investor, &[]).unwrap();
    assert_eq!(terms(&env).delivered_kg, 900_000);
    let mint = pda_mint(&pool);
    assert_eq!(token_balance(&env.svm, &ata(&investor.pubkey(), &mint, &TOKEN_2022)), 7 * NOMINAL);
    env.send(&[redeem_delivery_ix(&env, 1, investor.pubkey(), 7 * NOMINAL)], &investor, &[]).unwrap();
    assert_eq!(terms(&env).delivered_kg, 3_000_000);
    // Cash redemption never opens on a delivery pool.
    let err = env.send_err(&[redeem_ix(&env, 1, investor.pubkey(), 1)], &investor, &[]);
    assert!(err.contains("PoolNotRedeeming"), "{err}");
}

#[test]
fn delivery_needs_maturity_and_a_passing_lab_certificate() {
    let mut env = setup_configured();
    let (_, project) = seed_pilot_funded(&mut env, M::GrainDelivery);
    let investor = env.investor.insecure_clone();
    record(&mut env, project, 1, K::ElevatorReceipt, Verdict::Pass, [0xE1; 32]);
    record(&mut env, project, 2, K::LabQuality, Verdict::Pass, [0x1A; 32]);
    let err = env.send_err(&[redeem_delivery_ix(&env, 1, investor.pubkey(), NOMINAL)], &investor, &[]);
    assert!(err.contains("NotMatured"), "{err}");
    // A later failing certificate blocks claims again.
    record(&mut env, project, 3, K::LabQuality, Verdict::Fail, [0x1B; 32]);
    let m = maturity(&env);
    warp_to(&mut env.svm, m);
    let err = env.send_err(&[redeem_delivery_ix(&env, 1, investor.pubkey(), NOMINAL)], &investor, &[]);
    assert!(err.contains("DeliveryNotAttested"), "{err}");
}

#[test]
fn delivery_is_refused_on_a_buyback_pool() {
    let mut env = setup_configured();
    let (_, project) = seed_pilot_funded(&mut env, M::Hybrid);
    let producer = env.producer.insecure_clone();
    let scas = env.scas.insecure_clone();
    let investor = env.investor.insecure_clone();
    env.send(&[elect_settlement_ix(&env, producer.pubkey(), 1, E::Buyback)], &producer, &[]).unwrap();
    let err = env.send_err(&[record_delivery_ix(&env, scas.pubkey(), 1, project, 0, 1, K::ElevatorReceipt, Verdict::Pass, [1; 32])], &scas, &[]);
    assert!(err.contains("DeliveryNotElected"), "{err}");
    let m = maturity(&env);
    warp_to(&mut env.svm, m);
    let err = env.send_err(&[redeem_delivery_ix(&env, 1, investor.pubkey(), NOMINAL)], &investor, &[]);
    assert!(err.contains("DeliveryNotElected"), "{err}");
}

#[test]
fn delivery_attestations_come_from_scas_or_the_arranger_only() {
    let mut env = setup_configured();
    let (_, project) = seed_pilot_funded(&mut env, M::GrainDelivery);
    let producer = env.producer.insecure_clone();
    let issuer = env.issuer.insecure_clone();
    let err = env.send_err(&[record_delivery_ix(&env, producer.pubkey(), 1, project, 0, 1, K::ElevatorReceipt, Verdict::Pass, [1; 32])], &producer, &[]);
    assert!(err.contains("Unauthorized"), "{err}");
    env.send(&[record_delivery_ix(&env, issuer.pubkey(), 1, project, 0, 1, K::ElevatorReceipt, Verdict::Pass, [1; 32])], &issuer, &[]).unwrap();
    let err = env.send_err(&[record_delivery_ix(&env, issuer.pubkey(), 1, project, 0, 2, K::Harvest, Verdict::Pass, [1; 32])], &issuer, &[]);
    assert!(err.contains("InvalidAttestationKind"), "{err}");
}

#[test]
fn season_attestations_cannot_carry_delivery_kinds() {
    let mut env = setup_configured();
    let (_, project) = seed_pilot_funded(&mut env, M::GrainDelivery);
    let scas = env.scas.insecure_clone();
    let err = env.send_err(&[attest_ix(&env, project, 0, 1, K::ElevatorReceipt, Verdict::Pass)], &scas, &[]);
    assert!(err.contains("InvalidAttestationKind"), "{err}");
}

#[test]
fn new_enum_variants_are_appended() {
    use anchor_lang::AnchorSerialize;
    let tag = |k: K| {
        let mut v = Vec::new();
        k.serialize(&mut v).unwrap();
        v[0]
    };
    assert_eq!(tag(K::ElevatorReceipt), 4);
    assert_eq!(tag(K::LabQuality), 5);
}
