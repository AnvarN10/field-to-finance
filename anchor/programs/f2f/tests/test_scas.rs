mod common;
use common::*;
use f2f::{AttestationKind, Verdict};
use solana_signer::Signer;

#[test]
fn field_verified_pass_marks_field_and_counts_once() {
    let mut env = setup_configured();
    let project = seed_project(&mut env, 1, 1);
    let scas = env.scas.insecure_clone();
    env.send(&[attest_ix(&env, project, 0, 0, AttestationKind::FieldVerified, Verdict::Pass)], &scas, &[]).unwrap();
    env.send(&[attest_ix(&env, project, 0, 1, AttestationKind::FieldVerified, Verdict::Pass)], &scas, &[]).unwrap();
    let f: f2f::Field = fetch(&env.svm, &pda_field(&project, 0));
    assert!(f.verified);
    assert_eq!(f.attestation_count, 2);
    let p: f2f::FarmProject = fetch(&env.svm, &project);
    assert_eq!(p.verified_field_count, 1);
    let a: f2f::Attestation = fetch(&env.svm, &pda_attestation(&pda_field(&project, 0), 1));
    assert_eq!(a.signer, env.scas.pubkey());
    assert_eq!(a.evidence_hash, [7; 32]);
    assert_eq!(a.ndvi_mean_x10k, 6_500);
}

#[test]
fn failed_verification_leaves_field_unverified() {
    let mut env = setup_configured();
    let project = seed_project(&mut env, 1, 1);
    let scas = env.scas.insecure_clone();
    env.send(&[attest_ix(&env, project, 0, 0, AttestationKind::FieldVerified, Verdict::InsufficientData)], &scas, &[]).unwrap();
    let f: f2f::Field = fetch(&env.svm, &pda_field(&project, 0));
    assert!(!f.verified);
}

#[test]
fn harvest_attestation_flags_project() {
    let mut env = setup_configured();
    let project = seed_project(&mut env, 1, 1);
    let scas = env.scas.insecure_clone();
    env.send(&[attest_ix(&env, project, 0, 0, AttestationKind::Harvest, Verdict::Pass)], &scas, &[]).unwrap();
    let p: f2f::FarmProject = fetch(&env.svm, &project);
    assert!(p.harvest_attested);
}

#[test]
fn only_scas_can_attest() {
    let mut env = setup_configured();
    let project = seed_project(&mut env, 1, 1);
    let stranger = env.investor.insecure_clone();
    let mut a = attest_ix(&env, project, 0, 0, AttestationKind::FieldVerified, Verdict::Pass);
    a.accounts[0].pubkey = stranger.pubkey();
    let err = env.send_err(&[a], &stranger, &[]);
    assert!(err.contains("Unauthorized"), "{err}");
}

#[test]
fn field_from_another_project_is_rejected() {
    let mut env = setup_configured();
    let p1 = seed_project(&mut env, 1, 1);
    let p2 = seed_project(&mut env, 2, 1);
    let scas = env.scas.insecure_clone();
    let mut a = attest_ix(&env, p1, 0, 0, AttestationKind::FieldVerified, Verdict::Pass);
    let foreign_field = pda_field(&p2, 0);
    a.accounts[3].pubkey = foreign_field;
    a.accounts[4].pubkey = pda_attestation(&foreign_field, 0);
    let err = env.send_err(&[a], &scas, &[]);
    assert!(err.contains("FieldMismatch"), "{err}");
}
