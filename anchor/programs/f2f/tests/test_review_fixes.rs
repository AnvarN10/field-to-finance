mod common;
use common::*;
use f2f::{AttestationKind, SettlementRule, Verdict};
use solana_signer::Signer;

fn disbursed(env: &mut Env) -> (anchor_lang::prelude::Pubkey, anchor_lang::prelude::Pubkey) {
    let (pool, project) = seed_funded_pool(env);
    let issuer = env.issuer.insecure_clone();
    env.send(&[disburse_ix(env, 1, project)], &issuer, &[]).unwrap();
    (pool, project)
}

#[test]
fn cash_repaid_settlement_skips_harvest_gate_only_after_maturity() {
    let mut env = setup_configured();
    let (pool, project) = disbursed(&mut env);
    let issuer = env.issuer.insecure_clone();
    let err = env.send_err(&[settle_ix(&env, 1, project, SettlementRule::CashRepaidWithPremium)], &issuer, &[]);
    assert!(err.contains("HarvestNotAttested"), "{err}");
    let maturity = fetch::<f2f::Pool>(&env.svm, &pool).maturity_ts;
    warp_to(&mut env.svm, maturity);
    let err = env.send_err(&[settle_ix(&env, 1, project, SettlementRule::Delivered)], &issuer, &[]);
    assert!(err.contains("HarvestNotAttested"), "{err}");
    env.send(&[settle_ix(&env, 1, project, SettlementRule::CashRepaidWithPremium)], &issuer, &[]).unwrap();
    assert_eq!(fetch::<f2f::Pool>(&env.svm, &pool).settled_count, 1);
}

#[test]
fn redemption_deposit_before_all_disbursed_is_rejected() {
    let mut env = setup_configured();
    seed_funded_pool(&mut env);
    let issuer = env.issuer.insecure_clone();
    fund_usdc(&mut env, &issuer.pubkey(), 112_000 * USDC);
    let err = env.send_err(&[fund_redemption_ix(&env, 1, 112_000 * USDC)], &issuer, &[]);
    assert!(err.contains("NotAllDisbursed"), "{err}");
}

#[test]
fn sweep_returns_surplus_after_everything_is_redeemed() {
    let mut env = setup_configured();
    let (pool, project) = disbursed(&mut env);
    let issuer = env.issuer.insecure_clone();
    let investor = env.investor.insecure_clone();
    let scas = env.scas.insecure_clone();
    env.send(&[attest_ix(&env, project, 0, 1, AttestationKind::Harvest, Verdict::Pass)], &scas, &[]).unwrap();
    env.send(&[settle_ix(&env, 1, project, SettlementRule::Delivered)], &issuer, &[]).unwrap();
    let issuer_usdc = fund_usdc(&mut env, &issuer.pubkey(), 112_500 * USDC);
    let maturity = fetch::<f2f::Pool>(&env.svm, &pool).maturity_ts;
    warp_to(&mut env.svm, maturity);
    env.send(&[fund_redemption_ix(&env, 1, 112_500 * USDC)], &issuer, &[]).unwrap();
    let err = env.send_err(&[sweep_ix(&env, 1)], &issuer, &[]);
    assert!(err.contains("InstrumentOutstanding"), "{err}");
    env.send(&[redeem_ix(&env, 1, investor.pubkey(), 100_000 * USDC)], &investor, &[]).unwrap();
    env.send(&[sweep_ix(&env, 1)], &issuer, &[]).unwrap();
    assert_eq!(token_balance(&env.svm, &issuer_usdc), 500 * USDC);
    assert_eq!(token_balance(&env.svm, &ata(&pool, &env.usdc_mint.pubkey(), &SPL_TOKEN)), 0);
}

#[test]
fn revoke_freezes_account_and_blocks_subscription() {
    let mut env = setup_configured();
    seed_open_pool(&mut env);
    let investor = env.investor.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    fund_usdc(&mut env, &investor.pubkey(), 1_000 * USDC);
    env.send(&[approve_ix(&env, 1, investor.pubkey())], &compliance, &[]).unwrap();
    env.send(&[approve_ix(&env, 1, investor.pubkey())], &compliance, &[]).unwrap();
    env.send(&[revoke_ix(&env, 1, investor.pubkey())], &compliance, &[]).unwrap();
    let rec: f2f::InvestorRecord = fetch(&env.svm, &pda_investor(&investor.pubkey()));
    assert!(!rec.approved);
    let acc = env.svm.get_account(&ata(&investor.pubkey(), &pda_mint(&pda_pool(1)), &TOKEN_2022)).unwrap();
    assert_eq!(acc.data[108], 2);
    let err = env.send_err(&[subscribe_ix(&env, 1, investor.pubkey(), 1_000 * USDC)], &investor, &[]);
    assert!(err.contains("InvestorNotApproved"), "{err}");
}

#[test]
fn strangers_cannot_call_issuer_instructions() {
    let mut env = setup_configured();
    let (_, project) = seed_funded_pool(&mut env);
    let stranger = env.investor.insecure_clone();
    let issuer_key = env.issuer.pubkey();
    fund_usdc(&mut env, &issuer_key, 0);
    let builders = vec![
        disburse_ix(&env, 1, project),
        settle_ix(&env, 1, project, SettlementRule::Delivered),
        fund_redemption_ix(&env, 1, 0),
        add_project_ix(&env, 1, project),
        open_pool_ix(&env, 1),
        sweep_ix(&env, 1),
    ];
    for mut i in builders {
        i.accounts[0].pubkey = stranger.pubkey();
        let err = env.send_err(&[i], &stranger, &[]);
        assert!(err.contains("Unauthorized"), "{err}");
    }
}

#[test]
fn another_pools_vault_cannot_be_substituted() {
    let mut env = setup_configured();
    seed_open_pool(&mut env);
    let issuer = env.issuer.insecure_clone();
    let args = default_pool_args(&env);
    env.send(&[create_pool_ix(&env, 2, args)], &issuer, &[]).unwrap();
    let investor = env.investor.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    fund_usdc(&mut env, &investor.pubkey(), 1_000 * USDC);
    env.send(&[approve_ix(&env, 1, investor.pubkey())], &compliance, &[]).unwrap();
    let mut i = subscribe_ix(&env, 1, investor.pubkey(), 1_000 * USDC);
    i.accounts[7].pubkey = ata(&pda_pool(2), &env.usdc_mint.pubkey(), &SPL_TOKEN);
    let err = env.send_err(&[i], &investor, &[]);
    assert!(err.contains("ConstraintAddress"), "{err}");
}

#[test]
fn redeeming_more_than_held_fails() {
    let mut env = setup_configured();
    let (pool, project) = disbursed(&mut env);
    let issuer = env.issuer.insecure_clone();
    let investor = env.investor.insecure_clone();
    let scas = env.scas.insecure_clone();
    env.send(&[attest_ix(&env, project, 0, 1, AttestationKind::Harvest, Verdict::Pass)], &scas, &[]).unwrap();
    env.send(&[settle_ix(&env, 1, project, SettlementRule::Delivered)], &issuer, &[]).unwrap();
    fund_usdc(&mut env, &issuer.pubkey(), 112_000 * USDC);
    let maturity = fetch::<f2f::Pool>(&env.svm, &pool).maturity_ts;
    warp_to(&mut env.svm, maturity);
    env.send(&[fund_redemption_ix(&env, 1, 112_000 * USDC)], &issuer, &[]).unwrap();
    env.send_err(&[redeem_ix(&env, 1, investor.pubkey(), 100_001 * USDC)], &investor, &[]);
}

#[test]
fn with_yield_reports_overflow() {
    assert!(f2f::math::with_yield(u64::MAX, 5_000).is_err());
}
