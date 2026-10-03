use anchor_lang::prelude::*;
use anchor_lang::system_program::{create_account, CreateAccount};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::{initialize_mint2, InitializeMint2};
use anchor_spl::token_interface::{
    default_account_state_initialize, metadata_pointer_initialize, token_metadata_initialize,
    spl_token_2022::{extension::ExtensionType, state::{AccountState, Mint as MintState}},
    DefaultAccountStateInitialize, Mint, MetadataPointerInitialize, Token2022, TokenAccount, TokenInterface,
    TokenMetadataInitialize,
};
use spl_token_metadata_interface::state::TokenMetadata;

use crate::{constants::*, error::F2fError, state::{Config, Pool, PoolStatus}};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CreatePoolArgs {
    pub crop: String,
    pub season: u16,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub yield_bps: u16,
    pub premium_bps: u16,
    pub subscription_close_ts: i64,
    pub maturity_ts: i64,
}

#[derive(Accounts)]
#[instruction(pool_id: u64)]
pub struct CreatePool<'info> {
    #[account(mut, address = config.issuer @ F2fError::Unauthorized)]
    pub issuer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(init, payer = issuer, space = 8 + Pool::INIT_SPACE, seeds = [POOL_SEED, &pool_id.to_le_bytes()], bump)]
    pub pool: Account<'info, Pool>,
    /// CHECK: created and initialized by this instruction as a Token-2022 mint.
    #[account(mut, seeds = [MINT_SEED, pool.key().as_ref()], bump)]
    pub mint: UncheckedAccount<'info>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = issuer,
        associated_token::mint = usdc_mint,
        associated_token::authority = pool,
        associated_token::token_program = usdc_token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, Token2022>,
    pub usdc_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_pool(ctx: Context<CreatePool>, pool_id: u64, args: CreatePoolArgs) -> Result<()> {
    require!(args.crop.len() <= MAX_CROP_LEN, F2fError::StringTooLong);
    require!(args.name.len() <= MAX_NAME_LEN, F2fError::StringTooLong);
    require!(args.symbol.len() <= MAX_SYMBOL_LEN, F2fError::StringTooLong);
    require!(args.uri.len() <= MAX_URI_LEN, F2fError::StringTooLong);
    require!((PREMIUM_MIN_BPS..=PREMIUM_MAX_BPS).contains(&args.premium_bps), F2fError::InvalidPremium);
    require!(args.yield_bps <= MAX_YIELD_BPS, F2fError::InvalidYield);
    let now = Clock::get()?.unix_timestamp;
    require!(now < args.subscription_close_ts && args.subscription_close_ts < args.maturity_ts, F2fError::InvalidSchedule);

    let pool_key = ctx.accounts.pool.key();
    let mint_key = ctx.accounts.mint.key();
    let pool_bump = ctx.bumps.pool;
    let mint_bump = ctx.bumps.mint;
    let pool_id_bytes = pool_id.to_le_bytes();
    let pool_seeds: &[&[u8]] = &[POOL_SEED, &pool_id_bytes, &[pool_bump]];
    let mint_seeds: &[&[u8]] = &[MINT_SEED, pool_key.as_ref(), &[mint_bump]];
    let token_program_id = ctx.accounts.token_program.key();

    // Anchor has no default_account_state constraint, so the mint is built by hand:
    // allocate with room for the fixed extensions, fund rent for the metadata that
    // token_metadata_initialize appends, then initialize extensions before the mint.
    let space = ExtensionType::try_calculate_account_len::<MintState>(&[
        ExtensionType::DefaultAccountState,
        ExtensionType::MetadataPointer,
    ])?;
    let metadata = TokenMetadata {
        mint: mint_key,
        name: args.name.clone(),
        symbol: args.symbol.clone(),
        uri: args.uri.clone(),
        ..Default::default()
    };
    let lamports = Rent::get()?.minimum_balance(space + metadata.tlv_size_of()?);
    create_account(
        CpiContext::new_with_signer(
            anchor_lang::system_program::ID,
            CreateAccount { from: ctx.accounts.issuer.to_account_info(), to: ctx.accounts.mint.to_account_info() },
            &[mint_seeds],
        ),
        lamports,
        space as u64,
        &token_program_id,
    )?;
    default_account_state_initialize(
        CpiContext::new(
            token_program_id,
            DefaultAccountStateInitialize {
                token_program_id: ctx.accounts.token_program.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
            },
        ),
        &AccountState::Frozen,
    )?;
    metadata_pointer_initialize(
        CpiContext::new(
            token_program_id,
            MetadataPointerInitialize {
                token_program_id: ctx.accounts.token_program.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
            },
        ),
        Some(pool_key),
        Some(mint_key),
    )?;
    initialize_mint2(
        CpiContext::new(token_program_id, InitializeMint2 { mint: ctx.accounts.mint.to_account_info() }),
        INSTRUMENT_DECIMALS,
        &pool_key,
        Some(&pool_key),
    )?;
    token_metadata_initialize(
        CpiContext::new_with_signer(
            token_program_id,
            TokenMetadataInitialize {
                program_id: ctx.accounts.token_program.to_account_info(),
                metadata: ctx.accounts.mint.to_account_info(),
                update_authority: ctx.accounts.pool.to_account_info(),
                mint_authority: ctx.accounts.pool.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
            },
            &[pool_seeds],
        ),
        args.name,
        args.symbol,
        args.uri,
    )?;

    let pool = &mut ctx.accounts.pool;
    pool.pool_id = pool_id;
    pool.issuer = ctx.accounts.issuer.key();
    pool.mint = mint_key;
    pool.vault = ctx.accounts.vault.key();
    pool.crop = args.crop;
    pool.season = args.season;
    pool.target_amount = 0;
    pool.raised_amount = 0;
    pool.yield_bps = args.yield_bps;
    pool.premium_bps = args.premium_bps;
    pool.subscription_close_ts = args.subscription_close_ts;
    pool.maturity_ts = args.maturity_ts;
    pool.project_count = 0;
    pool.disbursed_count = 0;
    pool.settled_count = 0;
    pool.status = PoolStatus::Draft;
    pool.bump = pool_bump;
    pool.mint_bump = mint_bump;
    Ok(())
}
