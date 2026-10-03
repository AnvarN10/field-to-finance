mod common;
use common::*;
use solana_signer::Signer;

#[test]
fn disburse_pays_requested_amount_once() {
    let mut env = setup_configured();
    let (pool, project) = seed_funded_pool(&mut env);
    let issuer = env.issuer.insecure_clone();
    env.send(&[disburse_ix(&env, 1, project)], &issuer, &[]).unwrap();
    let producer_usdc = ata(&env.producer.pubkey(), &env.usdc_mint.pubkey(), &SPL_TOKEN);
    assert_eq!(token_balance(&env.svm, &producer_usdc), 100_000 * USDC);
    assert_eq!(fetch::<f2f::Pool>(&env.svm, &pool).disbursed_count, 1);
    let err = env.send_err(&[disburse_ix(&env, 1, project)], &issuer, &[]);
    assert!(err.contains("AlreadyDisbursed"), "{err}");
}

#[test]
fn disburse_before_funded_is_rejected() {
    let mut env = setup_configured();
    let (_, project) = seed_open_pool(&mut env);
    let issuer = env.issuer.insecure_clone();
    let err = env.send_err(&[disburse_ix(&env, 1, project)], &issuer, &[]);
    assert!(err.contains("PoolNotFunded"), "{err}");
}

#[test]
fn refund_returns_usdc_and_burns_instrument() {
    let mut env = setup_configured();
    let (pool, _) = seed_open_pool(&mut env);
    let investor = env.investor.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    let usdc = fund_usdc(&mut env, &investor.pubkey(), 40_000 * USDC);
    env.send(&[approve_ix(&env, 1, investor.pubkey())], &compliance, &[]).unwrap();
    env.send(&[subscribe_ix(&env, 1, investor.pubkey(), 40_000 * USDC)], &investor, &[]).unwrap();
    let close_ts = fetch::<f2f::Pool>(&env.svm, &pool).subscription_close_ts;
    warp_to(&mut env.svm, close_ts);
    env.send(&[close_ix(&env, 1, investor.pubkey())], &investor, &[]).unwrap();
    env.send(&[refund_ix(&env, 1, investor.pubkey(), 40_000 * USDC)], &investor, &[]).unwrap();
    assert_eq!(token_balance(&env.svm, &usdc), 40_000 * USDC);
    assert_eq!(token_balance(&env.svm, &ata(&investor.pubkey(), &pda_mint(&pool), &TOKEN_2022)), 0);
    assert_eq!(fetch::<f2f::Pool>(&env.svm, &pool).raised_amount, 0);
}

#[test]
fn refund_in_funded_pool_is_rejected() {
    let mut env = setup_configured();
    seed_funded_pool(&mut env);
    let investor = env.investor.insecure_clone();
    let err = env.send_err(&[refund_ix(&env, 1, investor.pubkey(), 1)], &investor, &[]);
    assert!(err.contains("PoolNotRefunding"), "{err}");
}
