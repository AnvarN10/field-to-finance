mod common;
use anchor_spl::token_interface::spl_token_2022::{
    extension::{default_account_state::DefaultAccountState, BaseStateWithExtensions, StateWithExtensions},
    state::{AccountState, Mint},
};
use common::*;
use solana_signer::Signer;

#[test]
fn create_pool_makes_frozen_by_default_mint_with_metadata() {
    let mut env = setup_configured();
    let issuer = env.issuer.insecure_clone();
    let args = default_pool_args(&env);
    env.send(&[create_pool_ix(&env, 1, args)], &issuer, &[]).unwrap();
    let pool_key = pda_pool(1);
    let pool: f2f::Pool = fetch(&env.svm, &pool_key);
    assert_eq!(pool.status, f2f::PoolStatus::Draft);
    assert_eq!(pool.premium_bps, 550);
    assert_eq!(pool.mint, pda_mint(&pool_key));
    assert_eq!(pool.vault, ata(&pool_key, &env.usdc_mint.pubkey(), &SPL_TOKEN));
    let mint_acc = env.svm.get_account(&pool.mint).unwrap();
    assert_eq!(mint_acc.owner, TOKEN_2022);
    let mint = StateWithExtensions::<Mint>::unpack(&mint_acc.data).unwrap();
    assert_eq!(mint.base.decimals, 6);
    assert_eq!(Option::<anchor_lang::prelude::Pubkey>::from(mint.base.freeze_authority), Some(pool_key));
    assert_eq!(mint.get_extension::<DefaultAccountState>().unwrap().state, AccountState::Frozen as u8);
    let meta = mint.get_variable_len_extension::<spl_token_metadata_interface::state::TokenMetadata>().unwrap();
    assert_eq!(meta.symbol, "WHEAT-2027");
}

#[test]
fn premium_outside_500_600_is_rejected() {
    for bad in [499u16, 601] {
        let mut env = setup_configured();
        let issuer = env.issuer.insecure_clone();
        let mut args = default_pool_args(&env);
        args.premium_bps = bad;
        let err = env.send_err(&[create_pool_ix(&env, 1, args)], &issuer, &[]);
        assert!(err.contains("InvalidPremium"), "{err}");
    }
}

#[test]
fn premium_bounds_500_and_600_are_accepted() {
    for ok in [500u16, 600] {
        let mut env = setup_configured();
        let issuer = env.issuer.insecure_clone();
        let mut args = default_pool_args(&env);
        args.premium_bps = ok;
        env.send(&[create_pool_ix(&env, 1, args)], &issuer, &[]).unwrap();
    }
}

#[test]
fn only_issuer_can_create_pool() {
    let mut env = setup_configured();
    let stranger = env.investor.insecure_clone();
    let mut i = create_pool_ix(&env, 1, default_pool_args(&env));
    i.accounts[0].pubkey = stranger.pubkey();
    let err = env.send_err(&[i], &stranger, &[]);
    assert!(err.contains("Unauthorized"), "{err}");
}

#[test]
fn add_project_requires_every_field_verified() {
    let mut env = setup_configured();
    let project = seed_project(&mut env, 1, 2);
    verify_all_fields(&mut env, project, 1);
    let issuer = env.issuer.insecure_clone();
    let args = default_pool_args(&env);
    env.send(&[create_pool_ix(&env, 1, args)], &issuer, &[]).unwrap();
    let err = env.send_err(&[add_project_ix(&env, 1, project)], &issuer, &[]);
    assert!(err.contains("FieldsNotVerified"), "{err}");
}

#[test]
fn add_project_sets_target_and_locks_project() {
    let mut env = setup_configured();
    let (pool, project) = seed_open_pool(&mut env);
    let p: f2f::Pool = fetch(&env.svm, &pool);
    assert_eq!(p.status, f2f::PoolStatus::Open);
    assert_eq!(p.target_amount, 100_000 * USDC);
    assert_eq!(p.project_count, 1);
    let fp: f2f::FarmProject = fetch(&env.svm, &project);
    assert_eq!(fp.pool, Some(pool));
    let producer = env.producer.insecure_clone();
    let err = env.send_err(&[register_field_ix(&env, project, 2, [3; 32], 10)], &producer, &[]);
    assert!(err.contains("ProjectLocked"), "{err}");
}

#[test]
fn open_pool_requires_a_project() {
    let mut env = setup_configured();
    let issuer = env.issuer.insecure_clone();
    let args = default_pool_args(&env);
    env.send(&[create_pool_ix(&env, 1, args)], &issuer, &[]).unwrap();
    let err = env.send_err(&[open_pool_ix(&env, 1)], &issuer, &[]);
    assert!(err.contains("NoProjects"), "{err}");
}

#[test]
fn crop_mismatch_is_rejected() {
    let mut env = setup_configured();
    let project = seed_project(&mut env, 1, 1);
    verify_all_fields(&mut env, project, 1);
    let issuer = env.issuer.insecure_clone();
    let mut args = default_pool_args(&env);
    args.crop = "barley".to_string();
    env.send(&[create_pool_ix(&env, 1, args)], &issuer, &[]).unwrap();
    let err = env.send_err(&[add_project_ix(&env, 1, project)], &issuer, &[]);
    assert!(err.contains("CropMismatch"), "{err}");
}
