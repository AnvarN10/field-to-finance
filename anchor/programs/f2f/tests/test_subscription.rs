mod common;
use common::*;
use solana_signer::Signer;

#[test]
fn approval_thaws_investor_account() {
    let mut env = setup_configured();
    seed_open_pool(&mut env);
    let compliance = env.compliance.insecure_clone();
    let wallet = env.investor.pubkey();
    env.send(&[approve_ix(&env, 1, wallet)], &compliance, &[]).unwrap();
    let rec: f2f::InvestorRecord = fetch(&env.svm, &pda_investor(&wallet));
    assert!(rec.approved);
    let acc = env.svm.get_account(&ata(&wallet, &pda_mint(&pda_pool(1)), &TOKEN_2022)).unwrap();
    // Token account state byte sits at offset 108: 1 = Initialized, 2 = Frozen.
    assert_eq!(acc.data[108], 1);
}

#[test]
fn unapproved_investor_cannot_subscribe() {
    let mut env = setup_configured();
    seed_open_pool(&mut env);
    let investor = env.investor.insecure_clone();
    fund_usdc(&mut env, &investor.pubkey(), 1_000 * USDC);
    let err = env.send_err(&[subscribe_ix(&env, 1, investor.pubkey(), 1_000 * USDC)], &investor, &[]);
    assert!(err.contains("AccountNotInitialized") || err.contains("InvestorNotApproved"), "{err}");
}

#[test]
fn subscribe_moves_usdc_and_mints_instrument_one_to_one() {
    let mut env = setup_configured();
    let (pool, _) = seed_open_pool(&mut env);
    let investor = env.investor.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    let usdc = fund_usdc(&mut env, &investor.pubkey(), 30_000 * USDC);
    env.send(&[approve_ix(&env, 1, investor.pubkey())], &compliance, &[]).unwrap();
    env.send(&[subscribe_ix(&env, 1, investor.pubkey(), 30_000 * USDC)], &investor, &[]).unwrap();
    assert_eq!(token_balance(&env.svm, &usdc), 0);
    assert_eq!(token_balance(&env.svm, &ata(&pool, &env.usdc_mint.pubkey(), &SPL_TOKEN)), 30_000 * USDC);
    assert_eq!(token_balance(&env.svm, &ata(&investor.pubkey(), &pda_mint(&pool), &TOKEN_2022)), 30_000 * USDC);
    let p: f2f::Pool = fetch(&env.svm, &pool);
    assert_eq!(p.raised_amount, 30_000 * USDC);
}

#[test]
fn subscription_above_target_is_rejected() {
    let mut env = setup_configured();
    seed_open_pool(&mut env);
    let investor = env.investor.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    fund_usdc(&mut env, &investor.pubkey(), 200_000 * USDC);
    env.send(&[approve_ix(&env, 1, investor.pubkey())], &compliance, &[]).unwrap();
    let err = env.send_err(&[subscribe_ix(&env, 1, investor.pubkey(), 100_001 * USDC)], &investor, &[]);
    assert!(err.contains("ExceedsTarget"), "{err}");
}

#[test]
fn subscribing_exactly_to_target_allows_early_close_to_funded() {
    let mut env = setup_configured();
    let (pool, _) = seed_funded_pool(&mut env);
    let p: f2f::Pool = fetch(&env.svm, &pool);
    assert_eq!(p.status, f2f::PoolStatus::Funded);
}

#[test]
fn subscription_after_close_time_is_rejected() {
    let mut env = setup_configured();
    let (pool, _) = seed_open_pool(&mut env);
    let investor = env.investor.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    fund_usdc(&mut env, &investor.pubkey(), 1_000 * USDC);
    env.send(&[approve_ix(&env, 1, investor.pubkey())], &compliance, &[]).unwrap();
    let close_ts = fetch::<f2f::Pool>(&env.svm, &pool).subscription_close_ts;
    warp_to(&mut env.svm, close_ts);
    let err = env.send_err(&[subscribe_ix(&env, 1, investor.pubkey(), 1_000 * USDC)], &investor, &[]);
    assert!(err.contains("SubscriptionClosed"), "{err}");
}

#[test]
fn under_subscribed_pool_goes_to_refunding_after_close_time() {
    let mut env = setup_configured();
    let (pool, _) = seed_open_pool(&mut env);
    let investor = env.investor.insecure_clone();
    let err = env.send_err(&[close_ix(&env, 1, investor.pubkey())], &investor, &[]);
    assert!(err.contains("SubscriptionStillOpen"), "{err}");
    let close_ts = fetch::<f2f::Pool>(&env.svm, &pool).subscription_close_ts;
    warp_to(&mut env.svm, close_ts);
    env.send(&[close_ix(&env, 1, investor.pubkey())], &investor, &[]).unwrap();
    assert_eq!(fetch::<f2f::Pool>(&env.svm, &pool).status, f2f::PoolStatus::Refunding);
}

#[test]
fn same_key_as_issuer_and_compliance_still_works() {
    let mut env = setup();
    let shared = env.issuer.pubkey();
    let i = init_config_ix(&env, shared, env.scas.pubkey(), shared);
    let admin = env.admin.insecure_clone();
    env.send(&[i], &admin, &[]).unwrap();
    env.compliance = env.issuer.insecure_clone();
    seed_open_pool(&mut env);
    let issuer = env.issuer.insecure_clone();
    env.send(&[approve_ix(&env, 1, env.investor.pubkey())], &issuer, &[]).unwrap();
}
