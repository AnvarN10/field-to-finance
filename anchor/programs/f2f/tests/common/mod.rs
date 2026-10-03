#![allow(dead_code)]
use anchor_lang::{
    prelude::Pubkey,
    solana_program::{instruction::Instruction, program_pack::Pack, system_instruction, system_program},
    AccountDeserialize, InstructionData, ToAccountMetas,
};
use anchor_spl::token::spl_token;
use anchor_spl::token_interface::spl_token_2022;
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_message::{Message, VersionedMessage};
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;
use spl_associated_token_account_interface::{
    address::get_associated_token_address_with_program_id, instruction::create_associated_token_account_idempotent,
};

pub const USDC: u64 = 1_000_000;

pub struct Env {
    pub svm: LiteSVM,
    pub admin: Keypair,
    pub issuer: Keypair,
    pub scas: Keypair,
    pub compliance: Keypair,
    pub producer: Keypair,
    pub investor: Keypair,
    pub usdc_mint: Keypair,
}

pub fn program_id() -> Pubkey {
    f2f::id()
}

pub fn send(svm: &mut LiteSVM, ixs: &[Instruction], payer: &Keypair, extra: &[&Keypair]) -> Result<(), String> {
    let mut signers: Vec<&Keypair> = vec![payer];
    signers.extend_from_slice(extra);
    svm.expire_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &svm.latest_blockhash());
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &signers).unwrap();
    svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?}\n{}", e.err, e.meta.logs.join("\n")))
}

/// Sends and asserts failure; returns the logs so tests can match the error name.
pub fn send_err(svm: &mut LiteSVM, ixs: &[Instruction], payer: &Keypair, extra: &[&Keypair]) -> String {
    match send(svm, ixs, payer, extra) {
        Ok(()) => panic!("transaction was expected to fail"),
        Err(e) => e,
    }
}

pub fn ix<D: InstructionData, A: ToAccountMetas>(data: D, accounts: A) -> Instruction {
    Instruction::new_with_bytes(program_id(), &data.data(), accounts.to_account_metas(None))
}

pub fn fetch<T: AccountDeserialize>(svm: &LiteSVM, key: &Pubkey) -> T {
    let acc = svm.get_account(key).expect("account missing");
    T::try_deserialize(&mut acc.data.as_slice()).unwrap()
}

pub fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &program_id()).0
}
pub fn pda_config() -> Pubkey { pda(&[f2f::CONFIG_SEED]) }
pub fn pda_pool(pool_id: u64) -> Pubkey { pda(&[f2f::POOL_SEED, &pool_id.to_le_bytes()]) }
pub fn pda_mint(pool: &Pubkey) -> Pubkey { pda(&[f2f::MINT_SEED, pool.as_ref()]) }
pub fn pda_project(producer: &Pubkey, project_id: u64) -> Pubkey {
    pda(&[f2f::PROJECT_SEED, producer.as_ref(), &project_id.to_le_bytes()])
}
pub fn pda_field(project: &Pubkey, index: u8) -> Pubkey { pda(&[f2f::FIELD_SEED, project.as_ref(), &[index]]) }
pub fn pda_attestation(field: &Pubkey, seq: u32) -> Pubkey {
    pda(&[f2f::ATTESTATION_SEED, field.as_ref(), &seq.to_le_bytes()])
}
pub fn pda_investor(wallet: &Pubkey) -> Pubkey { pda(&[f2f::INVESTOR_SEED, wallet.as_ref()]) }

pub fn ata(owner: &Pubkey, mint: &Pubkey, token_program: &Pubkey) -> Pubkey {
    get_associated_token_address_with_program_id(owner, mint, token_program)
}

pub fn token_balance(svm: &LiteSVM, account: &Pubkey) -> u64 {
    let acc = svm.get_account(account).expect("token account missing");
    // Amount sits at the same offset (64..72) for SPL Token and Token-2022 accounts.
    u64::from_le_bytes(acc.data[64..72].try_into().unwrap())
}

/// Creates a classic SPL Token mint with 6 decimals acting as USDC.
pub fn create_usdc_mint(svm: &mut LiteSVM, payer: &Keypair, mint: &Keypair) {
    let rent = svm.minimum_balance_for_rent_exemption(spl_token::state::Mint::LEN);
    let create = system_instruction::create_account(&payer.pubkey(), &mint.pubkey(), rent, spl_token::state::Mint::LEN as u64, &spl_token::ID);
    let init = spl_token::instruction::initialize_mint2(&spl_token::ID, &mint.pubkey(), &payer.pubkey(), None, 6).unwrap();
    send(svm, &[create, init], payer, &[mint]).unwrap();
}

/// Creates the owner's USDC ATA if needed and mints `amount` to it. `env.admin` is the USDC mint authority.
pub fn fund_usdc(env: &mut Env, owner: &Pubkey, amount: u64) -> Pubkey {
    let account = ata(owner, &env.usdc_mint.pubkey(), &spl_token::ID);
    let create = create_associated_token_account_idempotent(&env.admin.pubkey(), owner, &env.usdc_mint.pubkey(), &spl_token::ID);
    let mint_to = spl_token::instruction::mint_to(&spl_token::ID, &env.usdc_mint.pubkey(), &account, &env.admin.pubkey(), &[], amount).unwrap();
    send(&mut env.svm, &[create, mint_to], &env.admin, &[]).unwrap();
    account
}

pub fn now(svm: &LiteSVM) -> i64 {
    svm.get_sysvar::<anchor_lang::prelude::Clock>().unix_timestamp
}

pub fn warp_to(svm: &mut LiteSVM, unix_timestamp: i64) {
    let mut clock = svm.get_sysvar::<anchor_lang::prelude::Clock>();
    clock.unix_timestamp = unix_timestamp;
    svm.set_sysvar(&clock);
}

pub fn setup() -> Env {
    let mut svm = LiteSVM::new();
    svm.add_program(program_id(), include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/f2f.so"))).unwrap();
    let env_keys: Vec<Keypair> = (0..7).map(|_| Keypair::new()).collect();
    for k in &env_keys[..6] {
        svm.airdrop(&k.pubkey(), 100_000_000_000).unwrap();
    }
    let mut it = env_keys.into_iter();
    let mut env = Env {
        admin: it.next().unwrap(),
        issuer: it.next().unwrap(),
        scas: it.next().unwrap(),
        compliance: it.next().unwrap(),
        producer: it.next().unwrap(),
        investor: it.next().unwrap(),
        usdc_mint: it.next().unwrap(),
        svm,
    };
    create_usdc_mint(&mut env.svm, &env.admin, &env.usdc_mint);
    env
}

pub fn init_config_ix(env: &Env, issuer: Pubkey, scas: Pubkey, compliance: Pubkey) -> Instruction {
    ix(
        f2f::instruction::InitConfig { issuer, scas, compliance },
        f2f::accounts::InitConfig {
            admin: env.admin.pubkey(),
            config: pda_config(),
            usdc_mint: env.usdc_mint.pubkey(),
            system_program: system_program::ID,
        },
    )
}

/// `setup()` plus a Config with distinct role keys.
pub fn setup_configured() -> Env {
    let mut env = setup();
    let i = init_config_ix(&env, env.issuer.pubkey(), env.scas.pubkey(), env.compliance.pubkey());
    let admin = env.admin.insecure_clone();
    send(&mut env.svm, &[i], &admin, &[]).unwrap();
    env
}

pub const SPL_TOKEN: Pubkey = spl_token::ID;
pub const TOKEN_2022: Pubkey = spl_token_2022::ID;
