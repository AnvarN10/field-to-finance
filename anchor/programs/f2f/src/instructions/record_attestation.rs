use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::F2fError,
    state::{Attestation, AttestationKind, Config, FarmProject, Field, Verdict},
};

#[derive(Accounts)]
pub struct RecordAttestation<'info> {
    #[account(mut, address = config.scas @ F2fError::Unauthorized)]
    pub scas: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub project: Account<'info, FarmProject>,
    #[account(mut, constraint = field.project == project.key() @ F2fError::FieldMismatch)]
    pub field: Account<'info, Field>,
    #[account(
        init,
        payer = scas,
        space = 8 + Attestation::INIT_SPACE,
        seeds = [ATTESTATION_SEED, field.key().as_ref(), &field.attestation_count.to_le_bytes()],
        bump
    )]
    pub attestation: Account<'info, Attestation>,
    pub system_program: Program<'info, System>,
}

pub fn handle_record_attestation(
    ctx: Context<RecordAttestation>,
    kind: AttestationKind,
    verdict: Verdict,
    evidence_hash: [u8; 32],
    evidence_uri: String,
    ndvi_mean_x10k: i16,
    scene_date: i64,
) -> Result<()> {
    require!(evidence_uri.len() <= MAX_URI_LEN, F2fError::StringTooLong);
    require!((-NDVI_SCALE..=NDVI_SCALE).contains(&ndvi_mean_x10k), F2fError::InvalidNdvi);
    let field = &mut ctx.accounts.field;
    let project = &mut ctx.accounts.project;

    let a = &mut ctx.accounts.attestation;
    a.field = field.key();
    a.project = project.key();
    a.sequence = field.attestation_count;
    a.kind = kind;
    a.verdict = verdict;
    a.evidence_hash = evidence_hash;
    a.evidence_uri = evidence_uri;
    a.ndvi_mean_x10k = ndvi_mean_x10k;
    a.scene_date = scene_date;
    a.signer = ctx.accounts.scas.key();
    a.recorded_at = Clock::get()?.unix_timestamp;
    a.bump = ctx.bumps.attestation;

    field.attestation_count += 1;
    if kind == AttestationKind::FieldVerified && verdict == Verdict::Pass && !field.verified {
        field.verified = true;
        project.verified_field_count += 1;
    }
    if kind == AttestationKind::Harvest {
        project.harvest_attested = true;
    }
    Ok(())
}
