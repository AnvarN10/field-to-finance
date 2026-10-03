mod common;
use common::*;
use solana_signer::Signer;

#[test]
fn register_project_sets_tokenized_share_to_30_percent() {
    let mut env = setup_configured();
    let project = seed_project(&mut env, 1, 0);
    let p: f2f::FarmProject = fetch(&env.svm, &project);
    assert_eq!(p.producer, env.producer.pubkey());
    assert_eq!(p.expected_kg, 4_000_000);
    assert_eq!(p.tokenized_kg, 1_200_000);
    assert_eq!(p.requested_amount, 100_000 * USDC);
    assert_eq!(p.pool, None);
    assert_eq!(p.field_count, 0);
}

#[test]
fn register_field_increments_count_and_stores_polygon() {
    let mut env = setup_configured();
    let project = seed_project(&mut env, 1, 2);
    let p: f2f::FarmProject = fetch(&env.svm, &project);
    assert_eq!(p.field_count, 2);
    let f: f2f::Field = fetch(&env.svm, &pda_field(&project, 1));
    assert_eq!(f.index, 1);
    assert_eq!(f.polygon_hash, [2; 32]);
    assert_eq!(f.area_ha_x100, 100_000);
    assert!(!f.verified);
}

#[test]
fn only_the_producer_can_add_fields() {
    let mut env = setup_configured();
    let project = seed_project(&mut env, 1, 0);
    let stranger = env.investor.insecure_clone();
    // The stranger signs as producer and pays the rent.
    let i = register_field_full_ix(&env, project, 0, [9; 32], 100, stranger.pubkey());
    let mut i = i;
    i.accounts[0].pubkey = stranger.pubkey();
    let err = env.send_err(&[i], &stranger, &[]);
    assert!(err.contains("ConstraintHasOne") || err.contains("Unauthorized"), "{err}");
}

#[test]
fn crop_longer_than_16_chars_is_rejected() {
    let mut env = setup_configured();
    let producer = env.producer.insecure_clone();
    let i = register_project_ix(&env, 1, "a-very-long-crop-name", 2027, 1, 1);
    let err = env.send_err(&[i], &producer, &[]);
    assert!(err.contains("StringTooLong"), "{err}");
}
