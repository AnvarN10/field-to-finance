mod common;
use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::instruction::Instruction;
use common::*;
use solana_keypair::Keypair;
use solana_signer::Signer;

fn replace_account(mut ix: Instruction, old: Pubkey, new: Pubkey) -> Instruction {
    let mut hit = false;
    for m in ix.accounts.iter_mut() {
        if m.pubkey == old {
            m.pubkey = new;
            hit = true;
        }
    }
    assert!(hit, "account {old} not in instruction");
    ix
}

fn lamports(env: &Env, key: &Pubkey) -> u64 {
    env.svm.get_account(key).map(|a| a.lamports).unwrap_or(0)
}

/// Pool 1 with one verified two-field project (requests 100,000 USDC), arrangement fee set while Draft, opened.
fn seed_open_pool_with_fee(env: &mut Env, bps: u16) -> (Pubkey, Pubkey) {
    let project = seed_project(env, 1, 2);
    verify_all_fields(env, project, 2);
    let issuer = env.issuer.insecure_clone();
    let args = default_pool_args(env);
    env.send(&[create_pool_ix(env, 1, args)], &issuer, &[]).unwrap();
    env.send(&[set_arrangement_fee_ix(env, issuer.pubkey(), 1, bps)], &issuer, &[]).unwrap();
    env.send(&[add_project_ix(env, 1, project), open_pool_ix(env, 1)], &issuer, &[]).unwrap();
    (pda_pool(1), project)
}

/// Fully subscribes the open pool 1 (paying the network fee when fees are configured) and closes it.
fn fund_and_close(env: &mut Env, with_fees: bool) {
    let investor = env.investor.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    fund_usdc(env, &investor.pubkey(), 100_000 * USDC + NETWORK_FEE);
    env.send(&[approve_ix(env, investor.pubkey())], &compliance, &[]).unwrap();
    let treasury = with_fees.then(|| treasury_usdc(env));
    let sub = subscribe_full_ix(env, 1, investor.pubkey(), 100_000 * USDC, investor.pubkey(), treasury);
    env.send(&[sub, close_ix(env, 1, investor.pubkey())], &investor, &[]).unwrap();
}

// ---------- FeeConfig ----------

#[test]
fn admin_initializes_fee_config_and_treasury_usdc_account() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    let fc: f2f::FeeConfig = fetch(&env.svm, &pda_fees());
    assert_eq!(fc.treasury, env.treasury.pubkey());
    assert_eq!(fc.network_fee, NETWORK_FEE);
    assert_eq!(fc.mint_fee, MINT_FEE);
    assert_eq!(fc.max_arrangement_bps, 1_000);
    assert_eq!(token_balance(&env.svm, &treasury_usdc(&env)), 0);
}

#[test]
fn stranger_cannot_initialize_fee_config() {
    let mut env = setup_configured();
    let stranger = env.issuer.insecure_clone();
    let i = init_fee_config_ix(&env, stranger.pubkey(), stranger.pubkey(), default_fee_args());
    let err = env.send_err(&[i], &stranger, &[]);
    assert!(err.contains("Unauthorized"), "{err}");
}

#[test]
fn stranger_cannot_update_fee_config() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    let stranger = env.issuer.insecure_clone();
    let i = update_fee_config_ix(&env, stranger.pubkey(), stranger.pubkey(), FeeArgs { network_fee: 0, mint_fee: 0, max_arrangement_bps: 1_000 });
    let err = env.send_err(&[i], &stranger, &[]);
    assert!(err.contains("Unauthorized"), "{err}");
}

#[test]
fn fee_config_rejects_arrangement_cap_above_program_limit() {
    let mut env = setup_configured();
    let admin = env.admin.insecure_clone();
    let i = init_fee_config_ix(&env, admin.pubkey(), env.treasury.pubkey(), FeeArgs { network_fee: NETWORK_FEE, mint_fee: MINT_FEE, max_arrangement_bps: 1_001 });
    let err = env.send_err(&[i], &admin, &[]);
    assert!(err.contains("FeeTooHigh"), "{err}");
    setup_fees(&mut env);
    let i = update_fee_config_ix(&env, admin.pubkey(), env.treasury.pubkey(), FeeArgs { network_fee: NETWORK_FEE, mint_fee: MINT_FEE, max_arrangement_bps: 1_001 });
    let err = env.send_err(&[i], &admin, &[]);
    assert!(err.contains("FeeTooHigh"), "{err}");
}

#[test]
fn fee_config_rejects_flat_fees_above_program_limits() {
    let mut env = setup_configured();
    let admin = env.admin.insecure_clone();
    let i = init_fee_config_ix(&env, admin.pubkey(), env.treasury.pubkey(), FeeArgs { network_fee: f2f::MAX_NETWORK_FEE + 1, mint_fee: MINT_FEE, max_arrangement_bps: 1_000 });
    assert!(env.send_err(&[i], &admin, &[]).contains("FeeTooHigh"));
    let i = init_fee_config_ix(&env, admin.pubkey(), env.treasury.pubkey(), FeeArgs { network_fee: NETWORK_FEE, mint_fee: f2f::MAX_MINT_FEE + 1, max_arrangement_bps: 1_000 });
    assert!(env.send_err(&[i], &admin, &[]).contains("FeeTooHigh"));
}

#[test]
fn admin_updates_fees_and_moves_the_treasury() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    let admin = env.admin.insecure_clone();
    let new_treasury = Keypair::new();
    let i = update_fee_config_ix(&env, admin.pubkey(), new_treasury.pubkey(), FeeArgs { network_fee: 250_000, mint_fee: 2 * USDC, max_arrangement_bps: 300 });
    env.send(&[i], &admin, &[]).unwrap();
    let fc: f2f::FeeConfig = fetch(&env.svm, &pda_fees());
    assert_eq!(fc.treasury, new_treasury.pubkey());
    assert_eq!((fc.network_fee, fc.mint_fee, fc.max_arrangement_bps), (250_000, 2 * USDC, 300));
    assert_eq!(token_balance(&env.svm, &ata(&new_treasury.pubkey(), &env.usdc_mint.pubkey(), &SPL_TOKEN)), 0);
}

// ---------- set_arrangement_fee ----------

#[test]
fn issuer_sets_arrangement_fee_while_draft() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    let issuer = env.issuer.insecure_clone();
    let args = default_pool_args(&env);
    env.send(&[create_pool_ix(&env, 1, args)], &issuer, &[]).unwrap();
    env.send(&[set_arrangement_fee_ix(&env, issuer.pubkey(), 1, 200)], &issuer, &[]).unwrap();
    assert_eq!(fetch::<f2f::PoolTerms>(&env.svm, &pda_terms(&pda_pool(1))).arrangement_fee_bps, 200);
    env.send(&[set_arrangement_fee_ix(&env, issuer.pubkey(), 1, 150)], &issuer, &[]).unwrap();
    assert_eq!(fetch::<f2f::PoolTerms>(&env.svm, &pda_terms(&pda_pool(1))).arrangement_fee_bps, 150);
}

#[test]
fn arrangement_fee_above_fee_config_cap_is_rejected() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    let issuer = env.issuer.insecure_clone();
    let admin = env.admin.insecure_clone();
    let args = default_pool_args(&env);
    env.send(&[create_pool_ix(&env, 1, args)], &issuer, &[]).unwrap();
    let err = env.send_err(&[set_arrangement_fee_ix(&env, issuer.pubkey(), 1, 1_001)], &issuer, &[]);
    assert!(err.contains("FeeTooHigh"), "{err}");
    let i = update_fee_config_ix(&env, admin.pubkey(), env.treasury.pubkey(), FeeArgs { network_fee: NETWORK_FEE, mint_fee: MINT_FEE, max_arrangement_bps: 300 });
    env.send(&[i], &admin, &[]).unwrap();
    let err = env.send_err(&[set_arrangement_fee_ix(&env, issuer.pubkey(), 1, 301)], &issuer, &[]);
    assert!(err.contains("FeeTooHigh"), "{err}");
    env.send(&[set_arrangement_fee_ix(&env, issuer.pubkey(), 1, 300)], &issuer, &[]).unwrap();
}

#[test]
fn only_issuer_sets_arrangement_fee() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    let issuer = env.issuer.insecure_clone();
    let stranger = env.producer.insecure_clone();
    let args = default_pool_args(&env);
    env.send(&[create_pool_ix(&env, 1, args)], &issuer, &[]).unwrap();
    let err = env.send_err(&[set_arrangement_fee_ix(&env, stranger.pubkey(), 1, 0)], &stranger, &[]);
    assert!(err.contains("Unauthorized"), "{err}");
}

#[test]
fn arrangement_fee_cannot_change_after_the_pool_opens() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    seed_open_pool_with_fee(&mut env, 200);
    let issuer = env.issuer.insecure_clone();
    let err = env.send_err(&[set_arrangement_fee_ix(&env, issuer.pubkey(), 1, 0)], &issuer, &[]);
    assert!(err.contains("PoolNotDraft"), "{err}");
}

// ---------- disburse ----------

#[test]
fn disburse_withholds_arrangement_fee_for_the_treasury() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    let (pool, project) = seed_open_pool_with_fee(&mut env, 200);
    fund_and_close(&mut env, true);
    let issuer = env.issuer.insecure_clone();
    let treasury_before = token_balance(&env.svm, &treasury_usdc(&env));
    env.send(&[disburse_full_ix(&env, 1, project, Some(treasury_usdc(&env)))], &issuer, &[]).unwrap();
    let producer_usdc = ata(&env.producer.pubkey(), &env.usdc_mint.pubkey(), &SPL_TOKEN);
    assert_eq!(token_balance(&env.svm, &producer_usdc), 98_000 * USDC);
    assert_eq!(token_balance(&env.svm, &treasury_usdc(&env)) - treasury_before, 2_000 * USDC);
    assert_eq!(token_balance(&env.svm, &ata(&pool, &env.usdc_mint.pubkey(), &SPL_TOKEN)), 0);
    assert!(fetch::<f2f::FarmProject>(&env.svm, &project).disbursed);
}

#[test]
fn old_pool_without_pool_terms_pays_no_arrangement_fee() {
    let mut env = setup_configured();
    let (_, project) = seed_open_pool(&mut env);
    fund_and_close(&mut env, false);
    // Fees configured after the pool was set up: it has no PoolTerms.
    setup_fees(&mut env);
    let issuer = env.issuer.insecure_clone();
    env.send(&[disburse_full_ix(&env, 1, project, None)], &issuer, &[]).unwrap();
    let producer_usdc = ata(&env.producer.pubkey(), &env.usdc_mint.pubkey(), &SPL_TOKEN);
    assert_eq!(token_balance(&env.svm, &producer_usdc), 100_000 * USDC);
    assert_eq!(token_balance(&env.svm, &treasury_usdc(&env)), 0);
}

#[test]
fn disburse_rejects_a_substituted_treasury_account() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    let (_, project) = seed_open_pool_with_fee(&mut env, 200);
    fund_and_close(&mut env, true);
    let issuer = env.issuer.insecure_clone();
    let issuer_usdc = fund_usdc(&mut env, &issuer.pubkey(), 0);
    let err = env.send_err(&[disburse_full_ix(&env, 1, project, Some(issuer_usdc))], &issuer, &[]);
    assert!(err.contains("InvalidTreasury"), "{err}");
}

#[test]
fn disburse_with_a_fee_due_requires_the_treasury_account() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    let (_, project) = seed_open_pool_with_fee(&mut env, 200);
    fund_and_close(&mut env, true);
    let issuer = env.issuer.insecure_clone();
    let err = env.send_err(&[disburse_full_ix(&env, 1, project, None)], &issuer, &[]);
    assert!(err.contains("MissingFeeAccount"), "{err}");
}

#[test]
fn disburse_rejects_pool_terms_of_another_pool() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    let (pool, project) = seed_open_pool_with_fee(&mut env, 200);
    fund_and_close(&mut env, true);
    let issuer = env.issuer.insecure_clone();
    let i = replace_account(disburse_full_ix(&env, 1, project, Some(treasury_usdc(&env))), pda_terms(&pool), pda_terms(&pda_pool(2)));
    let err = env.send_err(&[i], &issuer, &[]);
    assert!(err.contains("ConstraintSeeds"), "{err}");
}

// ---------- subscribe ----------

#[test]
fn subscribe_charges_the_network_fee_to_the_treasury() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    let (pool, _) = seed_open_pool(&mut env);
    let investor = env.investor.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    let usdc = fund_usdc(&mut env, &investor.pubkey(), 1_000 * USDC);
    env.send(&[approve_ix(&env, investor.pubkey())], &compliance, &[]).unwrap();
    let treasury_before = token_balance(&env.svm, &treasury_usdc(&env));
    let i = subscribe_full_ix(&env, 1, investor.pubkey(), 500 * USDC, investor.pubkey(), Some(treasury_usdc(&env)));
    env.send(&[i], &investor, &[]).unwrap();
    assert_eq!(token_balance(&env.svm, &usdc), 1_000 * USDC - 500 * USDC - NETWORK_FEE);
    assert_eq!(token_balance(&env.svm, &treasury_usdc(&env)) - treasury_before, NETWORK_FEE);
    assert_eq!(token_balance(&env.svm, &ata(&pool, &env.usdc_mint.pubkey(), &SPL_TOKEN)), 500 * USDC);
    assert_eq!(fetch::<f2f::Pool>(&env.svm, &pool).raised_amount, 500 * USDC);
    assert_eq!(token_balance(&env.svm, &ata(&investor.pubkey(), &pda_mint(&pool), &TOKEN_2022)), 500 * USDC);
}

#[test]
fn sponsor_pays_gas_and_rent_for_an_investor_with_no_sol() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    let (pool, _) = seed_open_pool(&mut env);
    let investor = Keypair::new();
    let sponsor = env.sponsor.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    fund_usdc(&mut env, &investor.pubkey(), 100 * USDC + NETWORK_FEE);
    env.send(&[approve_ix(&env, investor.pubkey())], &compliance, &[]).unwrap();
    assert_eq!(lamports(&env, &investor.pubkey()), 0);
    let sponsor_before = lamports(&env, &sponsor.pubkey());
    let treasury_before = token_balance(&env.svm, &treasury_usdc(&env));
    let i = subscribe_full_ix(&env, 1, investor.pubkey(), 100 * USDC, sponsor.pubkey(), Some(treasury_usdc(&env)));
    env.send(&[i], &sponsor, &[&investor]).unwrap();
    assert_eq!(lamports(&env, &investor.pubkey()), 0);
    assert!(lamports(&env, &sponsor.pubkey()) < sponsor_before);
    assert_eq!(token_balance(&env.svm, &ata(&investor.pubkey(), &pda_mint(&pool), &TOKEN_2022)), 100 * USDC);
    assert_eq!(token_balance(&env.svm, &treasury_usdc(&env)) - treasury_before, NETWORK_FEE);
}

#[test]
fn subscribe_without_fee_config_charges_no_fee() {
    let mut env = setup_configured();
    let (pool, _) = seed_open_pool(&mut env);
    let investor = Keypair::new();
    let sponsor = env.sponsor.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    let usdc = fund_usdc(&mut env, &investor.pubkey(), 100 * USDC);
    env.send(&[approve_ix(&env, investor.pubkey())], &compliance, &[]).unwrap();
    let i = subscribe_full_ix(&env, 1, investor.pubkey(), 100 * USDC, sponsor.pubkey(), None);
    env.send(&[i], &sponsor, &[&investor]).unwrap();
    assert_eq!(token_balance(&env.svm, &usdc), 0);
    assert_eq!(token_balance(&env.svm, &ata(&pool, &env.usdc_mint.pubkey(), &SPL_TOKEN)), 100 * USDC);
}

#[test]
fn subscribe_cannot_skip_the_network_fee() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    seed_open_pool(&mut env);
    let investor = env.investor.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    fund_usdc(&mut env, &investor.pubkey(), 1_000 * USDC);
    env.send(&[approve_ix(&env, investor.pubkey())], &compliance, &[]).unwrap();
    let err = env.send_err(&[subscribe_full_ix(&env, 1, investor.pubkey(), 500 * USDC, investor.pubkey(), None)], &investor, &[]);
    assert!(err.contains("MissingFeeAccount"), "{err}");
    let fake = replace_account(
        subscribe_full_ix(&env, 1, investor.pubkey(), 500 * USDC, investor.pubkey(), None),
        pda_fees(),
        Keypair::new().pubkey(),
    );
    let err = env.send_err(&[fake], &investor, &[]);
    assert!(err.contains("ConstraintSeeds"), "{err}");
}

#[test]
fn subscribe_rejects_a_substituted_treasury_account() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    seed_open_pool(&mut env);
    let investor = env.investor.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    fund_usdc(&mut env, &investor.pubkey(), 1_000 * USDC);
    let stranger = Keypair::new();
    let stranger_usdc = fund_usdc(&mut env, &stranger.pubkey(), 0);
    env.send(&[approve_ix(&env, investor.pubkey())], &compliance, &[]).unwrap();
    let err = env.send_err(&[subscribe_full_ix(&env, 1, investor.pubkey(), 500 * USDC, investor.pubkey(), Some(stranger_usdc))], &investor, &[]);
    assert!(err.contains("InvalidTreasury"), "{err}");
}

// ---------- register_project / register_field ----------

#[test]
fn register_project_charges_the_mint_fee_with_a_sponsor_paying_rent() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    env.producer = Keypair::new();
    let producer = env.producer.insecure_clone();
    let sponsor = env.sponsor.insecure_clone();
    let usdc = fund_usdc(&mut env, &producer.pubkey(), 10 * USDC);
    let rp = register_project_full_ix(&env, 7, "wheat", 2027, 4_000_000, 100_000 * USDC, sponsor.pubkey(), Some(treasury_usdc(&env)), true);
    env.send(&[rp], &sponsor, &[&producer]).unwrap();
    let project = pda_project(&producer.pubkey(), 7);
    let rf = register_field_full_ix(&env, project, 0, [1; 32], 100_000, sponsor.pubkey());
    env.send(&[rf], &sponsor, &[&producer]).unwrap();
    assert_eq!(token_balance(&env.svm, &usdc), 7 * USDC);
    assert_eq!(token_balance(&env.svm, &treasury_usdc(&env)), MINT_FEE);
    assert_eq!(lamports(&env, &producer.pubkey()), 0);
    let p: f2f::FarmProject = fetch(&env.svm, &project);
    assert_eq!((p.producer, p.field_count), (producer.pubkey(), 1));
}

#[test]
fn register_project_without_fee_config_charges_nothing() {
    let mut env = setup_configured();
    env.producer = Keypair::new();
    let producer = env.producer.insecure_clone();
    let sponsor = env.sponsor.insecure_clone();
    let rp = register_project_full_ix(&env, 7, "wheat", 2027, 4_000_000, 100_000 * USDC, sponsor.pubkey(), None, false);
    env.send(&[rp], &sponsor, &[&producer]).unwrap();
    assert_eq!(fetch::<f2f::FarmProject>(&env.svm, &pda_project(&producer.pubkey(), 7)).project_id, 7);
}

#[test]
fn register_project_cannot_skip_the_mint_fee() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    let producer = env.producer.insecure_clone();
    fund_usdc(&mut env, &producer.pubkey(), 10 * USDC);
    let rp = register_project_full_ix(&env, 7, "wheat", 2027, 4_000_000, 100_000 * USDC, producer.pubkey(), None, false);
    let err = env.send_err(&[rp], &producer, &[]);
    assert!(err.contains("MissingFeeAccount"), "{err}");
}

#[test]
fn register_project_rejects_a_substituted_treasury_account() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    let producer = env.producer.insecure_clone();
    fund_usdc(&mut env, &producer.pubkey(), 10 * USDC);
    let stranger = Keypair::new();
    let stranger_usdc = fund_usdc(&mut env, &stranger.pubkey(), 0);
    let rp = register_project_full_ix(&env, 7, "wheat", 2027, 4_000_000, 100_000 * USDC, producer.pubkey(), Some(stranger_usdc), true);
    let err = env.send_err(&[rp], &producer, &[]);
    assert!(err.contains("InvalidTreasury"), "{err}");
}

#[test]
fn register_project_rejects_a_fee_paid_in_another_mint() {
    let mut env = setup_configured();
    setup_fees(&mut env);
    let producer = env.producer.insecure_clone();
    let admin = env.admin.insecure_clone();
    fund_usdc(&mut env, &producer.pubkey(), 10 * USDC);
    let fake_mint = Keypair::new();
    create_usdc_mint(&mut env.svm, &admin, &fake_mint);
    let rp = register_project_full_ix(&env, 7, "wheat", 2027, 4_000_000, 100_000 * USDC, producer.pubkey(), Some(treasury_usdc(&env)), true);
    let rp = replace_account(rp, env.usdc_mint.pubkey(), fake_mint.pubkey());
    let err = env.send_err(&[rp], &producer, &[]);
    assert!(err.contains("ConstraintAddress"), "{err}");
}
