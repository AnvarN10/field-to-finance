import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import {
  F2F_IDL,
  attestationPda,
  configPda,
  fieldPda,
  toAnchorEnum,
  type AttestationKindName,
  type F2f,
  type VerdictName,
} from "@f2f/sdk";
import { Connection, SystemProgram, type Keypair, type PublicKey, type TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import { RequestError } from "./errors";

export interface FieldState {
  address: PublicKey;
  project: PublicKey;
  index: number;
  polygonHash: Uint8Array;
  areaHaX100: number;
  verified: boolean;
  attestationCount: number;
}

export interface ProjectState {
  address: PublicKey;
  crop: string;
  season: number;
}

export interface AttestationArgs {
  project: PublicKey;
  field: PublicKey;
  sequence: number;
  kind: AttestationKindName;
  verdict: VerdictName;
  evidenceHash: Uint8Array;
  evidenceUri: string;
  ndviMeanX10k: number;
  /** Unix seconds. */
  sceneDate: number;
}

export interface SentAttestation {
  signature: string;
  attestation: PublicKey;
  sequence: number;
}

export interface Chain {
  readonly scas: PublicKey;
  loadProject(project: PublicKey): Promise<ProjectState>;
  loadField(project: PublicKey, index: number): Promise<FieldState>;
  assertScasAuthority(): Promise<void>;
  sendAttestation(args: Omit<AttestationArgs, "sequence">): Promise<SentAttestation>;
}

export function createProgram(connection: Connection, signer: Keypair, programId: PublicKey): Program<F2f> {
  const provider = new AnchorProvider(connection, new Wallet(signer), { commitment: "confirmed" });
  return new Program<F2f>({ ...F2F_IDL, address: programId.toBase58() } as F2f, provider);
}

function recordAttestation(program: Program<F2f>, scas: PublicKey, args: AttestationArgs) {
  const programId = program.programId;
  return program.methods
    .recordAttestation(
      // Anchor's generated enum types are unions of object literals; the runtime shape is { variant: {} }.
      toAnchorEnum(args.kind) as never,
      toAnchorEnum(args.verdict) as never,
      Array.from(args.evidenceHash),
      args.evidenceUri,
      args.ndviMeanX10k,
      new BN(args.sceneDate),
    )
    .accountsStrict({
      scas,
      config: configPda(programId),
      project: args.project,
      field: args.field,
      attestation: attestationPda(programId, args.field, args.sequence),
      systemProgram: SystemProgram.programId,
    });
}

export function buildRecordAttestationIx(
  program: Program<F2f>,
  scas: PublicKey,
  args: AttestationArgs,
): Promise<TransactionInstruction> {
  return recordAttestation(program, scas, args).instruction();
}

export function checkScasAuthority(configScas: PublicKey, signer: PublicKey): void {
  if (!configScas.equals(signer)) {
    throw new Error(`SCAS key ${signer.toBase58()} is not the Config SCAS authority ${configScas.toBase58()}`);
  }
}

/** Runs async tasks one at a time. Two sends for one Field would otherwise race on attestation_count. */
export function createSerialQueue(): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  };
}

export function createChain(opts: { rpcUrl: string; programId: PublicKey; scas: Keypair }): Chain {
  const connection = new Connection(opts.rpcUrl, "confirmed");
  const program = createProgram(connection, opts.scas, opts.programId);
  const serial = createSerialQueue();

  return {
    scas: opts.scas.publicKey,

    async loadProject(project) {
      const acc = await program.account.farmProject.fetchNullable(project);
      if (!acc) throw new RequestError(`project ${project.toBase58()} not found`, 404);
      return { address: project, crop: acc.crop, season: acc.season };
    },

    async loadField(project, index) {
      const address = fieldPda(opts.programId, project, index);
      const acc = await program.account.field.fetchNullable(address);
      if (!acc) throw new RequestError(`field ${index} of project ${project.toBase58()} not found`, 404);
      return {
        address,
        project: acc.project,
        index: acc.index,
        polygonHash: Uint8Array.from(acc.polygonHash),
        areaHaX100: acc.areaHaX100,
        verified: acc.verified,
        attestationCount: acc.attestationCount,
      };
    },

    async assertScasAuthority() {
      const config = await program.account.config.fetch(configPda(opts.programId));
      checkScasAuthority(config.scas, opts.scas.publicKey);
    },

    sendAttestation(args) {
      return serial(async () => {
        // Re-read inside the queue so the PDA uses the count after any earlier send.
        const field = await program.account.field.fetch(args.field);
        const sequence = field.attestationCount;
        const signature = await recordAttestation(program, opts.scas.publicKey, { ...args, sequence }).rpc({
          commitment: "confirmed",
        });
        return { signature, attestation: attestationPda(opts.programId, args.field, sequence), sequence };
      });
    },
  };
}
