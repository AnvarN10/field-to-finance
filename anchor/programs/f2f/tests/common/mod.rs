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
    /// Platform gas sponsor: pays transaction fees and rent for user accounts.
    pub sponsor: Keypair,
    /// Fee treasury wallet. Holds no SOL; its USDC ATA is created by `init_fee_config`.
    pub treasury: Keypair,
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
pub fn pda_fees() -> Pubkey { pda(&[f2f::FEES_SEED]) }
pub fn pda_terms(pool: &Pubkey) -> Pubkey { pda(&[f2f::TERMS_SEED, pool.as_ref()]) }
pub fn pda_instrument(pool: &Pubkey) -> Pubkey { pda(&[f2f::INSTRUMENT_SEED, pool.as_ref()]) }

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
    let env_keys: Vec<Keypair> = (0..9).map(|_| Keypair::new()).collect();
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
        sponsor: it.next().unwrap(),
        treasury: it.next().unwrap(),
        svm,
    };
    env.svm.airdrop(&env.sponsor.pubkey(), 100_000_000_000).unwrap();
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
    register_project_full_ix(env, project_id, crop, season, expected_kg, requested, env.producer.pubkey(), None, false)
}

/// `payer` pays rent for the project account; `with_usdc` passes the producer's USDC accounts for the mint fee.
#[allow(clippy::too_many_arguments)]
pub fn register_project_full_ix(
    env: &Env,
    project_id: u64,
    crop: &str,
    season: u16,
    expected_kg: u64,
    requested: u64,
    payer: Pubkey,
    treasury_usdc: Option<Pubkey>,
    with_usdc: bool,
) -> Instruction {
    let producer = env.producer.pubkey();
    ix(
        f2f::instruction::RegisterProject { project_id, crop: crop.to_string(), season, expected_kg, requested_amount: requested },
        f2f::accounts::RegisterProject {
            producer,
            payer,
            config: pda_config(),
            project: pda_project(&producer, project_id),
            fee_config: pda_fees(),
            usdc_mint: with_usdc.then(|| env.usdc_mint.pubkey()),
            producer_usdc: with_usdc.then(|| ata(&producer, &env.usdc_mint.pubkey(), &SPL_TOKEN)),
            treasury_usdc,
            usdc_token_program: with_usdc.then_some(SPL_TOKEN),
            system_program: system_program::ID,
        },
    )
}

pub fn register_field_ix(env: &Env, project: Pubkey, index: u8, polygon_hash: [u8; 32], area_ha_x100: u32) -> Instruction {
    register_field_full_ix(env, project, index, polygon_hash, area_ha_x100, env.producer.pubkey())
}

pub fn register_field_full_ix(env: &Env, project: Pubkey, index: u8, polygon_hash: [u8; 32], area_ha_x100: u32, payer: Pubkey) -> Instruction {
    ix(
        f2f::instruction::RegisterField { polygon_hash, area_ha_x100 },
        f2f::accounts::RegisterField {
            producer: env.producer.pubkey(),
            payer,
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
    // With fees configured the producer prepays the mint fee in USDC.
    let rp = if env.svm.get_account(&pda_fees()).is_some() {
        fund_usdc(env, &producer.pubkey(), MINT_FEE);
        register_project_full_ix(env, project_id, "wheat", 2027, 4_000_000, 100_000 * USDC, producer.pubkey(), Some(treasury_usdc(env)), true)
    } else {
        register_project_ix(env, project_id, "wheat", 2027, 4_000_000, 100_000 * USDC)
    };
    env.send(&[rp], &producer, &[]).unwrap();
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
        f2f::accounts::OpenPool {
            issuer: env.issuer.pubkey(),
            config: pda_config(),
            pool: pda_pool(pool_id),
            instrument_terms: pda_instrument(&pda_pool(pool_id)),
        },
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

/// Platform-level KYC approval: one per wallet, valid for every pool.
pub fn approve_ix(env: &Env, wallet: Pubkey) -> Instruction {
    ix(
        f2f::instruction::ApproveInvestor {},
        f2f::accounts::ApproveInvestor {
            compliance: env.compliance.pubkey(),
            config: pda_config(),
            investor: wallet,
            investor_record: pda_investor(&wallet),
            system_program: system_program::ID,
        },
    )
}

pub fn subscribe_ix(env: &Env, pool_id: u64, investor: Pubkey, amount: u64) -> Instruction {
    subscribe_full_ix(env, pool_id, investor, amount, investor, None)
}

/// `payer` pays rent for the Instrument account (the gas sponsor, or the investor themself).
pub fn subscribe_full_ix(env: &Env, pool_id: u64, investor: Pubkey, amount: u64, payer: Pubkey, treasury_usdc: Option<Pubkey>) -> Instruction {
    let pool = pda_pool(pool_id);
    let mint = pda_mint(&pool);
    ix(
        f2f::instruction::Subscribe { amount },
        f2f::accounts::Subscribe {
            investor,
            payer,
            pool,
            investor_record: pda_investor(&investor),
            mint,
            investor_instrument: ata(&investor, &mint, &TOKEN_2022),
            usdc_mint: env.usdc_mint.pubkey(),
            investor_usdc: ata(&investor, &env.usdc_mint.pubkey(), &SPL_TOKEN),
            vault: ata(&pool, &env.usdc_mint.pubkey(), &SPL_TOKEN),
            fee_config: pda_fees(),
            treasury_usdc,
            instrument_terms: pda_instrument(&pool),
            token_program: TOKEN_2022,
            usdc_token_program: SPL_TOKEN,
            associated_token_program: spl_associated_token_account_interface::program::ID,
            system_program: system_program::ID,
        },
    )
}

pub fn close_ix(env: &Env, pool_id: u64, caller: Pubkey) -> Instruction {
    let _ = env;
    ix(f2f::instruction::CloseSubscription {}, f2f::accounts::CloseSubscription { caller, pool: pda_pool(pool_id) })
}

/// Open pool from `seed_open_pool`, investor approved and fully subscribed, subscription closed: status Funded.
pub fn seed_funded_pool(env: &mut Env) -> (Pubkey, Pubkey) {
    let (pool, project) = seed_open_pool(env);
    let investor = env.investor.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    fund_usdc(env, &investor.pubkey(), 100_000 * USDC);
    env.send(&[approve_ix(env, investor.pubkey())], &compliance, &[]).unwrap();
    env.send(&[subscribe_ix(env, 1, investor.pubkey(), 100_000 * USDC), close_ix(env, 1, investor.pubkey())], &investor, &[]).unwrap();
    (pool, project)
}

pub fn disburse_ix(env: &Env, pool_id: u64, project: Pubkey) -> Instruction {
    disburse_full_ix(env, pool_id, project, None)
}

pub fn disburse_full_ix(env: &Env, pool_id: u64, project: Pubkey, treasury_usdc: Option<Pubkey>) -> Instruction {
    let pool = pda_pool(pool_id);
    let producer = env.producer.pubkey();
    ix(
        f2f::instruction::Disburse {},
        f2f::accounts::Disburse {
            issuer: env.issuer.pubkey(),
            config: pda_config(),
            pool,
            project,
            producer,
            usdc_mint: env.usdc_mint.pubkey(),
            vault: ata(&pool, &env.usdc_mint.pubkey(), &SPL_TOKEN),
            producer_usdc: ata(&producer, &env.usdc_mint.pubkey(), &SPL_TOKEN),
            pool_terms: pda_terms(&pool),
            fee_config: pda_fees(),
            treasury_usdc,
            usdc_token_program: SPL_TOKEN,
            associated_token_program: spl_associated_token_account_interface::program::ID,
            system_program: system_program::ID,
        },
    )
}

pub fn refund_ix(env: &Env, pool_id: u64, investor: Pubkey, amount: u64) -> Instruction {
    let pool = pda_pool(pool_id);
    let mint = pda_mint(&pool);
    ix(
        f2f::instruction::Refund { amount },
        f2f::accounts::Refund {
            investor,
            pool,
            mint,
            investor_instrument: ata(&investor, &mint, &TOKEN_2022),
            usdc_mint: env.usdc_mint.pubkey(),
            investor_usdc: ata(&investor, &env.usdc_mint.pubkey(), &SPL_TOKEN),
            vault: ata(&pool, &env.usdc_mint.pubkey(), &SPL_TOKEN),
            token_program: TOKEN_2022,
            usdc_token_program: SPL_TOKEN,
        },
    )
}

pub fn settle_ix(env: &Env, pool_id: u64, project: Pubkey, rule: f2f::SettlementRule) -> Instruction {
    ix(
        f2f::instruction::RecordSettlement { rule },
        f2f::accounts::RecordSettlement { issuer: env.issuer.pubkey(), config: pda_config(), pool: pda_pool(pool_id), project },
    )
}

pub fn fund_redemption_ix(env: &Env, pool_id: u64, amount: u64) -> Instruction {
    fund_redemption_by_ix(env, env.issuer.pubkey(), pool_id, amount)
}

/// `signer` funds from its own USDC ATA: the arranger (Config.issuer) or the pool's issuer of record.
pub fn fund_redemption_by_ix(env: &Env, signer: Pubkey, pool_id: u64, amount: u64) -> Instruction {
    let pool = pda_pool(pool_id);
    ix(
        f2f::instruction::FundRedemption { amount },
        f2f::accounts::FundRedemption {
            issuer: signer,
            config: pda_config(),
            pool,
            usdc_mint: env.usdc_mint.pubkey(),
            issuer_usdc: ata(&signer, &env.usdc_mint.pubkey(), &SPL_TOKEN),
            vault: ata(&pool, &env.usdc_mint.pubkey(), &SPL_TOKEN),
            instrument_terms: pda_instrument(&pool),
            usdc_token_program: SPL_TOKEN,
        },
    )
}

pub fn redeem_ix(env: &Env, pool_id: u64, investor: Pubkey, amount: u64) -> Instruction {
    let pool = pda_pool(pool_id);
    let mint = pda_mint(&pool);
    ix(
        f2f::instruction::Redeem { amount },
        f2f::accounts::Redeem {
            investor,
            pool,
            mint,
            investor_instrument: ata(&investor, &mint, &TOKEN_2022),
            usdc_mint: env.usdc_mint.pubkey(),
            investor_usdc: ata(&investor, &env.usdc_mint.pubkey(), &SPL_TOKEN),
            vault: ata(&pool, &env.usdc_mint.pubkey(), &SPL_TOKEN),
            instrument_terms: pda_instrument(&pool),
            token_program: TOKEN_2022,
            usdc_token_program: SPL_TOKEN,
        },
    )
}

pub fn revoke_ix(env: &Env, pool_id: u64, wallet: Pubkey) -> Instruction {
    let pool = pda_pool(pool_id);
    let mint = pda_mint(&pool);
    ix(
        f2f::instruction::RevokeInvestor {},
        f2f::accounts::RevokeInvestor {
            compliance: env.compliance.pubkey(),
            config: pda_config(),
            pool,
            mint,
            investor: wallet,
            investor_record: pda_investor(&wallet),
            investor_instrument: Some(ata(&wallet, &mint, &TOKEN_2022)),
            token_program: TOKEN_2022,
        },
    )
}

pub fn sweep_ix(env: &Env, pool_id: u64) -> Instruction {
    let pool = pda_pool(pool_id);
    ix(
        f2f::instruction::Sweep {},
        f2f::accounts::Sweep {
            issuer: env.issuer.pubkey(),
            config: pda_config(),
            pool,
            mint: pda_mint(&pool),
            usdc_mint: env.usdc_mint.pubkey(),
            vault: ata(&pool, &env.usdc_mint.pubkey(), &SPL_TOKEN),
            issuer_usdc: ata(&env.issuer.pubkey(), &env.usdc_mint.pubkey(), &SPL_TOKEN),
            usdc_token_program: SPL_TOKEN,
        },
    )
}

pub fn treasury_usdc(env: &Env) -> Pubkey {
    ata(&env.treasury.pubkey(), &env.usdc_mint.pubkey(), &SPL_TOKEN)
}

pub const NETWORK_FEE: u64 = 500_000;
pub const MINT_FEE: u64 = 3 * USDC;

pub struct FeeArgs {
    pub network_fee: u64,
    pub mint_fee: u64,
    pub max_arrangement_bps: u16,
}

pub fn default_fee_args() -> FeeArgs {
    FeeArgs { network_fee: NETWORK_FEE, mint_fee: MINT_FEE, max_arrangement_bps: 1_000 }
}

pub fn init_fee_config_ix(env: &Env, admin: Pubkey, treasury: Pubkey, a: FeeArgs) -> Instruction {
    ix(
        f2f::instruction::InitFeeConfig { network_fee: a.network_fee, mint_fee: a.mint_fee, max_arrangement_bps: a.max_arrangement_bps },
        f2f::accounts::InitFeeConfig {
            admin,
            config: pda_config(),
            fee_config: pda_fees(),
            treasury,
            usdc_mint: env.usdc_mint.pubkey(),
            treasury_usdc: ata(&treasury, &env.usdc_mint.pubkey(), &SPL_TOKEN),
            usdc_token_program: SPL_TOKEN,
            associated_token_program: spl_associated_token_account_interface::program::ID,
            system_program: system_program::ID,
        },
    )
}

pub fn update_fee_config_ix(env: &Env, admin: Pubkey, treasury: Pubkey, a: FeeArgs) -> Instruction {
    ix(
        f2f::instruction::UpdateFeeConfig { network_fee: a.network_fee, mint_fee: a.mint_fee, max_arrangement_bps: a.max_arrangement_bps },
        f2f::accounts::UpdateFeeConfig {
            admin,
            config: pda_config(),
            fee_config: pda_fees(),
            treasury,
            usdc_mint: env.usdc_mint.pubkey(),
            treasury_usdc: ata(&treasury, &env.usdc_mint.pubkey(), &SPL_TOKEN),
            usdc_token_program: SPL_TOKEN,
            associated_token_program: spl_associated_token_account_interface::program::ID,
            system_program: system_program::ID,
        },
    )
}

/// Configures fees: treasury = `env.treasury`, 0.5 USDC network fee, 3 USDC mint fee, 1,000 bps cap.
pub fn setup_fees(env: &mut Env) {
    let admin = env.admin.insecure_clone();
    let i = init_fee_config_ix(env, admin.pubkey(), env.treasury.pubkey(), default_fee_args());
    env.send(&[i], &admin, &[]).unwrap();
}

pub fn set_arrangement_fee_ix(env: &Env, issuer: Pubkey, pool_id: u64, bps: u16) -> Instruction {
    let pool = pda_pool(pool_id);
    ix(
        f2f::instruction::SetArrangementFee { bps },
        f2f::accounts::SetArrangementFee {
            issuer,
            config: pda_config(),
            pool,
            fee_config: pda_fees(),
            pool_terms: pda_terms(&pool),
            system_program: system_program::ID,
        },
    )
}

// ---- Instrument terms (ADR 0014) ----

pub const NOMINAL: u64 = 100_000 * USDC;

/// The pilot term sheet: $100,000 per token, 5% a year Act/360, hybrid settlement, 10,000 t, 30% tokenized.
pub fn pilot_terms_args(start_ts: i64) -> f2f::InstrumentTermsArgs {
    f2f::InstrumentTermsArgs {
        unit_nominal: NOMINAL,
        coupon_bps_annual: 500,
        day_count: f2f::DayCount::Act360,
        start_ts,
        settlement_mode: f2f::SettlementMode::Hybrid,
        volume_kg: 10_000_000,
        tokenized_share_bps: 3_000,
        quality_spec_hash: [9; 32],
        spec_uri: "https://f2f.example/api/evidence/spec.json".to_string(),
        elevator: "Ust-Kamenogorsk".to_string(),
        lab: "Baltic Control".to_string(),
    }
}

pub fn set_instrument_terms_ix(env: &Env, signer: Pubkey, pool_id: u64, issuer_of_record: Pubkey, args: f2f::InstrumentTermsArgs) -> Instruction {
    let _ = env;
    let pool = pda_pool(pool_id);
    ix(
        f2f::instruction::SetInstrumentTerms { args },
        f2f::accounts::SetInstrumentTerms {
            arranger: signer,
            config: pda_config(),
            pool,
            issuer_of_record,
            issuer_record: pda_investor(&issuer_of_record),
            instrument_terms: pda_instrument(&pool),
            system_program: system_program::ID,
        },
    )
}

pub fn elect_settlement_ix(env: &Env, signer: Pubkey, pool_id: u64, election: f2f::SettlementElection) -> Instruction {
    let _ = env;
    let pool = pda_pool(pool_id);
    ix(
        f2f::instruction::ElectSettlement { election },
        f2f::accounts::ElectSettlement { signer, config: pda_config(), pool, instrument_terms: pda_instrument(&pool) },
    )
}

#[allow(clippy::too_many_arguments)]
pub fn record_delivery_ix(
    env: &Env,
    signer: Pubkey,
    pool_id: u64,
    project: Pubkey,
    field_index: u8,
    seq: u32,
    kind: f2f::AttestationKind,
    verdict: f2f::Verdict,
    evidence_hash: [u8; 32],
) -> Instruction {
    let _ = env;
    let pool = pda_pool(pool_id);
    let field = pda_field(&project, field_index);
    ix(
        f2f::instruction::RecordDelivery { kind, verdict, evidence_hash, evidence_uri: "https://f2f.example/api/evidence/receipt.json".to_string() },
        f2f::accounts::RecordDelivery {
            signer,
            config: pda_config(),
            pool,
            instrument_terms: pda_instrument(&pool),
            project,
            field,
            attestation: pda_attestation(&field, seq),
            system_program: system_program::ID,
        },
    )
}

pub fn redeem_delivery_ix(env: &Env, pool_id: u64, investor: Pubkey, amount: u64) -> Instruction {
    let _ = env;
    let pool = pda_pool(pool_id);
    let mint = pda_mint(&pool);
    ix(
        f2f::instruction::RedeemDelivery { amount },
        f2f::accounts::RedeemDelivery {
            investor,
            pool,
            instrument_terms: pda_instrument(&pool),
            mint,
            investor_instrument: ata(&investor, &mint, &TOKEN_2022),
            token_program: TOKEN_2022,
        },
    )
}

/// Pilot-style pool 1: the producer is KYC-approved and becomes the issuer of record; one verified
/// two-field project of 10,000 t asking $1,000,000; pilot terms starting now; opened.
pub fn seed_pilot_pool(env: &mut Env, mode: f2f::SettlementMode) -> (Pubkey, Pubkey) {
    let producer = env.producer.insecure_clone();
    let issuer = env.issuer.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    let project = pda_project(&producer.pubkey(), 1);
    env.send(&[register_project_ix(env, 1, "wheat", 2027, 10_000_000, 1_000_000 * USDC)], &producer, &[]).unwrap();
    for i in 0..2u8 {
        env.send(&[register_field_ix(env, project, i, [i + 1; 32], 100_000)], &producer, &[]).unwrap();
    }
    verify_all_fields(env, project, 2);
    env.send(&[approve_ix(env, producer.pubkey())], &compliance, &[]).unwrap();
    let args = default_pool_args(env);
    let mut terms = pilot_terms_args(now(&env.svm));
    terms.settlement_mode = mode;
    env.send(
        &[create_pool_ix(env, 1, args), set_instrument_terms_ix(env, issuer.pubkey(), 1, producer.pubkey(), terms)],
        &issuer,
        &[],
    )
    .unwrap();
    env.send(&[add_project_ix(env, 1, project), open_pool_ix(env, 1)], &issuer, &[]).unwrap();
    (pda_pool(1), project)
}

/// Pilot pool fully subscribed ($1,000,000 = 10 tokens) by `env.investor`, closed (Funded) and disbursed.
pub fn seed_pilot_funded(env: &mut Env, mode: f2f::SettlementMode) -> (Pubkey, Pubkey) {
    let (pool, project) = seed_pilot_pool(env, mode);
    let investor = env.investor.insecure_clone();
    let compliance = env.compliance.insecure_clone();
    let issuer = env.issuer.insecure_clone();
    fund_usdc(env, &investor.pubkey(), 1_000_000 * USDC);
    env.send(&[approve_ix(env, investor.pubkey())], &compliance, &[]).unwrap();
    env.send(&[subscribe_ix(env, 1, investor.pubkey(), 1_000_000 * USDC), close_ix(env, 1, investor.pubkey())], &investor, &[]).unwrap();
    env.send(&[disburse_ix(env, 1, project)], &issuer, &[]).unwrap();
    (pool, project)
}
