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

impl Env {
    /// Method form so callers can build instructions from `&env` inside the argument list
    /// (two-phase borrows apply to method receivers, not to `&mut env.svm` arguments).
    pub fn send(&mut self, ixs: &[Instruction], payer: &Keypair, extra: &[&Keypair]) -> Result<(), String> {
        send(&mut self.svm, ixs, payer, extra)
    }

    pub fn send_err(&mut self, ixs: &[Instruction], payer: &Keypair, extra: &[&Keypair]) -> String {
        send_err(&mut self.svm, ixs, payer, extra)
    }
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
    let admin = env.admin.insecure_clone();
    env.send(&[create, mint_to], &admin, &[]).unwrap();
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
    env.send(&[i], &admin, &[]).unwrap();
    env
}

pub const SPL_TOKEN: Pubkey = spl_token::ID;
pub const TOKEN_2022: Pubkey = spl_token_2022::ID;

pub fn register_project_ix(env: &Env, project_id: u64, crop: &str, season: u16, expected_kg: u64, requested: u64) -> Instruction {
    let producer = env.producer.pubkey();
    ix(
        f2f::instruction::RegisterProject { project_id, crop: crop.to_string(), season, expected_kg, requested_amount: requested },
        f2f::accounts::RegisterProject {
            producer,
            project: pda_project(&producer, project_id),
            system_program: system_program::ID,
        },
    )
}

pub fn register_field_ix(env: &Env, project: Pubkey, index: u8, polygon_hash: [u8; 32], area_ha_x100: u32) -> Instruction {
    ix(
        f2f::instruction::RegisterField { polygon_hash, area_ha_x100 },
        f2f::accounts::RegisterField {
            producer: env.producer.pubkey(),
            project,
            field: pda_field(&project, index),
            system_program: system_program::ID,
        },
    )
}

/// Registers a wheat 2027 project with `fields` fields of 1,000 ha each. Expected 4,000 t, requests 100,000 USDC.
pub fn seed_project(env: &mut Env, project_id: u64, fields: u8) -> Pubkey {
    let producer = env.producer.insecure_clone();
    let project = pda_project(&producer.pubkey(), project_id);
    env.send(&[register_project_ix(env, project_id, "wheat", 2027, 4_000_000, 100_000 * USDC)], &producer, &[]).unwrap();
    for i in 0..fields {
        env.send(&[register_field_ix(env, project, i, [i + 1; 32], 100_000)], &producer, &[]).unwrap();
    }
    project
}

pub fn attest_ix(env: &Env, project: Pubkey, field_index: u8, seq: u32, kind: f2f::AttestationKind, verdict: f2f::Verdict) -> Instruction {
    let field = pda_field(&project, field_index);
    ix(
        f2f::instruction::RecordAttestation {
            kind,
            verdict,
            evidence_hash: [7; 32],
            evidence_uri: "https://evidence.example/abc.json".to_string(),
            ndvi_mean_x10k: 6_500,
            scene_date: 1_780_000_000,
        },
        f2f::accounts::RecordAttestation {
            scas: env.scas.pubkey(),
            config: pda_config(),
            project,
            field,
            attestation: pda_attestation(&field, seq),
            system_program: system_program::ID,
        },
    )
}

/// Records one FieldVerified/Pass Attestation per field, assuming each field has no Attestations yet.
pub fn verify_all_fields(env: &mut Env, project: Pubkey, fields: u8) {
    let scas = env.scas.insecure_clone();
    for i in 0..fields {
        let a = attest_ix(env, project, i, 0, f2f::AttestationKind::FieldVerified, f2f::Verdict::Pass);
        env.send(&[a], &scas, &[]).unwrap();
    }
}

pub fn default_pool_args(env: &Env) -> f2f::CreatePoolArgs {
    let t = now(&env.svm);
    f2f::CreatePoolArgs {
        crop: "wheat".to_string(),
        season: 2027,
        name: "Wheat 2027".to_string(),
        symbol: "WHEAT-2027".to_string(),
        uri: "https://f2f.example/pools/1.json".to_string(),
        yield_bps: 1_200,
        premium_bps: 550,
        subscription_close_ts: t + 7 * 86_400,
        maturity_ts: t + 300 * 86_400,
    }
}

pub fn create_pool_ix(env: &Env, pool_id: u64, args: f2f::CreatePoolArgs) -> Instruction {
    let pool = pda_pool(pool_id);
    ix(
        f2f::instruction::CreatePool { pool_id, args },
        f2f::accounts::CreatePool {
            issuer: env.issuer.pubkey(),
            config: pda_config(),
            pool,
            mint: pda_mint(&pool),
            usdc_mint: env.usdc_mint.pubkey(),
            vault: ata(&pool, &env.usdc_mint.pubkey(), &SPL_TOKEN),
            token_program: TOKEN_2022,
            usdc_token_program: SPL_TOKEN,
            associated_token_program: spl_associated_token_account_interface::program::ID,
            system_program: system_program::ID,
        },
    )
}

pub fn add_project_ix(env: &Env, pool_id: u64, project: Pubkey) -> Instruction {
    ix(
        f2f::instruction::AddProject {},
        f2f::accounts::AddProject { issuer: env.issuer.pubkey(), config: pda_config(), pool: pda_pool(pool_id), project },
    )
}

pub fn open_pool_ix(env: &Env, pool_id: u64) -> Instruction {
    ix(
        f2f::instruction::OpenPool {},
        f2f::accounts::OpenPool { issuer: env.issuer.pubkey(), config: pda_config(), pool: pda_pool(pool_id) },
    )
}

/// Pool 1 with one verified two-field project, opened. Target is 100,000 USDC.
pub fn seed_open_pool(env: &mut Env) -> (Pubkey, Pubkey) {
    let project = seed_project(env, 1, 2);
    verify_all_fields(env, project, 2);
    let issuer = env.issuer.insecure_clone();
    let args = default_pool_args(env);
    env.send(&[create_pool_ix(env, 1, args)], &issuer, &[]).unwrap();
    env.send(&[add_project_ix(env, 1, project), open_pool_ix(env, 1)], &issuer, &[]).unwrap();
    (pda_pool(1), project)
}
