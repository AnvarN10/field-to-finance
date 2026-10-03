mod common;
use common::*;
use solana_signer::Signer;

#[test]
fn init_config_stores_roles_and_usdc_mint() {
    let env = setup_configured();
    let config: f2f::Config = fetch(&env.svm, &pda_config());
    assert_eq!(config.admin, env.admin.pubkey());
    assert_eq!(config.issuer, env.issuer.pubkey());
    assert_eq!(config.scas, env.scas.pubkey());
    assert_eq!(config.compliance, env.compliance.pubkey());
    assert_eq!(config.usdc_mint, env.usdc_mint.pubkey());
}

#[test]
fn init_config_cannot_run_twice() {
    let mut env = setup_configured();
    let i = init_config_ix(&env, env.issuer.pubkey(), env.scas.pubkey(), env.compliance.pubkey());
    let admin = env.admin.insecure_clone();
    send_err(&mut env.svm, &[i], &admin, &[]);
}
