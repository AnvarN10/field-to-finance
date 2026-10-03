mod common;
use common::*;
use f2f::{AttestationKind, SettlementRule, Verdict};
use solana_signer::Signer;

/// Funded pool, disbursed, harvest attested on field 0 (sequence 1 after FieldVerified).
fn harvested(env: &mut Env) -> (anchor_lang::prelude::Pubkey, anchor_lang::prelude::Pubkey) {
    let (pool, project) = seed_funded_pool(env);
    let issuer = env.issuer.insecure_clone();
    let scas = env.scas.insecure_clone();
    env.send(&[disburse_ix(env, 1, project)], &issuer, &[]).unwrap();
    env.send(&[attest_ix(env, project, 0, 1, AttestationKind::Harvest, Verdict::Pass)], &scas, &[]).unwrap();
    (pool, project)
}

#[test]
fn with_yield_uses_checked_u128_math() {
    assert_eq!(f2f::math::with_yield(100_000 * USDC, 1_200).unwrap(), 112_000 * USDC);
    assert_eq!(f2f::math::with_yield(10_000_000_000 * USDC, 5_000).unwrap(), 15_000_000_000 * USDC);
}

#[test]
fn settlement_requires_harvest_attestation() {
    let mut env = setup_configured();
    let (_, project) = seed_funded_pool(&mut env);
    let issuer = env.issuer.insecure_clone();
    env.send(&[disburse_ix(&env, 1, project)], &issuer, &[]).unwrap();
    let err = env.send_err(&[settle_ix(&env, 1, project, SettlementRule::Delivered)], &issuer, &[]);
    assert!(err.contains("HarvestNotAttested"), "{err}");
}

#[test]
fn settlement_is_recorded_once() {
    let mut env = setup_configured();
    let (pool, project) = harvested(&mut env);
    let issuer = env.issuer.insecure_clone();
    env.send(&[settle_ix(&env, 1, project, SettlementRule::CoveredFromOtherFields)], &issuer, &[]).unwrap();
    let p: f2f::FarmProject = fetch(&env.svm, &project);
    assert_eq!(p.settlement, Some(SettlementRule::CoveredFromOtherFields));
    assert_eq!(fetch::<f2f::Pool>(&env.svm, &pool).settled_count, 1);
    let err = env.send_err(&[settle_ix(&env, 1, project, SettlementRule::Delivered)], &issuer, &[]);
    assert!(err.contains("AlreadySettled"), "{err}");
}

#[test]
fn full_lifecycle_pays_fixed_yield_in_partial_redemptions() {
    let mut env = setup_configured();
    let (pool, project) = harvested(&mut env);
    let issuer = env.issuer.insecure_clone();
    let investor = env.investor.insecure_clone();
    env.send(&[settle_ix(&env, 1, project, SettlementRule::CashRepaidWithPremium)], &issuer, &[]).unwrap();

    // Before maturity the pool stays Funded even when fully funded.
    fund_usdc(&mut env, &issuer.pubkey(), 112_000 * USDC);
    env.send(&[fund_redemption_ix(&env, 1, 112_000 * USDC)], &issuer, &[]).unwrap();
    assert_eq!(fetch::<f2f::Pool>(&env.svm, &pool).status, f2f::PoolStatus::Funded);
    let err = env.send_err(&[redeem_ix(&env, 1, investor.pubkey(), USDC)], &investor, &[]);
    assert!(err.contains("PoolNotRedeeming"), "{err}");

    let maturity = fetch::<f2f::Pool>(&env.svm, &pool).maturity_ts;
    warp_to(&mut env.svm, maturity);
    env.send(&[fund_redemption_ix(&env, 1, 0)], &issuer, &[]).unwrap();
    assert_eq!(fetch::<f2f::Pool>(&env.svm, &pool).status, f2f::PoolStatus::Redeeming);

    let usdc = ata(&investor.pubkey(), &env.usdc_mint.pubkey(), &SPL_TOKEN);
    env.send(&[redeem_ix(&env, 1, investor.pubkey(), 40_000 * USDC)], &investor, &[]).unwrap();
    assert_eq!(token_balance(&env.svm, &usdc), 44_800 * USDC);
    env.send(&[redeem_ix(&env, 1, investor.pubkey(), 60_000 * USDC)], &investor, &[]).unwrap();
    assert_eq!(token_balance(&env.svm, &usdc), 112_000 * USDC);
    assert_eq!(token_balance(&env.svm, &ata(&pool, &env.usdc_mint.pubkey(), &SPL_TOKEN)), 0);
}

#[test]
fn redemption_waits_for_every_project_to_settle() {
    let mut env = setup_configured();
    let (pool, _) = harvested(&mut env);
    let issuer = env.issuer.insecure_clone();
    fund_usdc(&mut env, &issuer.pubkey(), 112_000 * USDC);
    let maturity = fetch::<f2f::Pool>(&env.svm, &pool).maturity_ts;
    warp_to(&mut env.svm, maturity);
    env.send(&[fund_redemption_ix(&env, 1, 112_000 * USDC)], &issuer, &[]).unwrap();
    assert_eq!(fetch::<f2f::Pool>(&env.svm, &pool).status, f2f::PoolStatus::Funded);
}
