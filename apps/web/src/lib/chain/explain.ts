export type ErrorAction = "kyc" | "faucet" | "switch-network" | "retry" | "none";

export interface ExplainedError {
  code: string;
  title: string;
  detail: string;
  action: ErrorAction;
}

type Entry = [title: string, detail: string, action?: ErrorAction];

/** F2fError variants from anchor/programs/f2f/src/error.rs in plain words. No em dashes (style-lock). */
const PROGRAM: Record<string, Entry> = {
  Unauthorized: ["This key is not allowed to do that", "The signer does not hold the role this step needs."],
  InvalidPremium: ["Premium must be between 5% and 6%", "Set the premium between 500 and 600 basis points."],
  InvalidYield: ["Yield is too high", "Fixed yield can be at most 50%."],
  InvalidSchedule: ["Check the dates", "Subscription must close in the future and before maturity."],
  StringTooLong: ["A text field is too long", "Crop up to 16 characters, name up to 32, symbol up to 10."],
  ZeroAmount: ["Enter an amount above zero", "The amount must be greater than zero."],
  PoolNotDraft: ["The pool is no longer a draft", "Projects can only be added before the pool opens."],
  PoolNotOpen: ["The pool is not open for subscription", "Subscriptions are accepted only while the pool is open.", "retry"],
  PoolNotFunded: ["The pool is not funded", "This step needs the pool to be Funded."],
  PoolNotRefunding: ["Refunds are not open", "Refunds open only if the pool closes under target."],
  PoolNotRedeeming: ["Redemption is not open yet", "Redemption opens after maturity once the Issuer has funded principal plus yield.", "retry"],
  NoProjects: ["Add a project first", "A pool needs at least one verified project before it opens."],
  ProjectAlreadyInPool: ["The project is already in a pool", "A Farm Project joins at most one pool."],
  ProjectNotInPool: ["The project is not in this pool", "Pick a project that belongs to this pool."],
  CropMismatch: ["Crop or season does not match the pool", "Only projects with the pool's crop and season can join."],
  NoFields: ["The project has no fields", "Register at least one field."],
  TooManyFields: ["Too many fields", "A project can have at most 8 fields."],
  FieldsNotVerified: ["Some fields are not verified yet", "Every field needs a passing SCAS check before the project joins a pool."],
  ProjectLocked: ["The project is locked", "Fields cannot be added after the project joins a pool."],
  FieldMismatch: ["The field does not belong to this project", "Check the project and field index."],
  InvalidNdvi: ["Vegetation index out of range", "NDVI must be between -1 and 1."],
  SubscriptionClosed: ["Subscription has closed", "The subscription window for this pool has ended."],
  SubscriptionStillOpen: ["Subscription is still open", "Close the pool when it is full or after the close time."],
  ExceedsTarget: ["That is more than the pool still needs", "Lower the amount to the remaining capacity."],
  InvestorNotApproved: ["This wallet hasn't passed KYC", "Its KYC approval is missing or was revoked, so it cannot hold the Instrument.", "kyc"],
  AlreadyDisbursed: ["Already disbursed", "This project has already been paid."],
  NotDisbursed: ["Disburse first", "Settlement is recorded only after the Producer was paid."],
  HarvestNotAttested: ["No harvest attestation yet", "Record a Harvest attestation for this project before settlement."],
  AlreadySettled: ["Already settled", "This project already has a settlement rule."],
  NotAllDisbursed: ["Disburse every project first", "Redemption deposits are accepted only after every project is paid."],
  InstrumentOutstanding: ["Instrument still outstanding", "Sweep is possible only after every investor has redeemed."],
  MathOverflow: ["Amount too large", "The amount overflows the program's arithmetic."],
  FeeTooHigh: ["Fee is above the cap", "Arrangement fees are capped by FeeConfig and by the program at 10%; flat fees have program caps too."],
  InvalidTreasury: ["Wrong treasury account", "Fees must go to the USDC account of the treasury named in FeeConfig."],
  MissingFeeAccount: ["Fee accounts are missing", "A fee is due but the transaction did not include the treasury or USDC accounts. Reload and try again.", "retry"],
  // Instrument terms (ADR 0014)
  IssuerNotApproved: ["The issuer of record hasn't passed KYC", "Approve the farmer's wallet in KYC before making it the issuer."],
  IssuerMismatch: ["Wrong issuer for this pool", "A farmer-issued pool takes only that farmer's projects, and its issuer cannot change once projects joined."],
  InvalidTerms: ["Check the instrument terms", "Nominal and volume must be above zero and the tokenized share at most 30%."],
  InvalidCoupon: ["Coupon is too high", "The annual coupon can be at most 30%."],
  UnsupportedDayCount: ["Day count not supported", "Only Act/360 is supported."],
  NotWholeTokens: ["Buy whole tokens", "This instrument is sold in whole tokens. Enter a multiple of the token nominal."],
  TargetNotWholeTokens: ["Pool target is not whole tokens", "The projects' requested total must be a multiple of the token nominal."],
  NotHybrid: ["No election for this instrument", "Only a Hybrid instrument lets the issuer choose buyback or delivery."],
  AlreadyElected: ["Settlement already elected", "The issuer's election is final."],
  ElectionClosed: ["The election window has closed", "The issuer can elect buyback or delivery up to maturity. After it, delivery applies."],
  DeliveryNotElected: ["Grain delivery does not apply", "This pool settles by cash buyback."],
  DeliveryElected: ["Cash redemption is closed", "Grain delivery applies to this pool, so holders claim grain instead of cash."],
  DeliveryNotAttested: ["Delivery is not confirmed yet", "Grain claims open once the elevator receipt and a passing lab certificate are recorded.", "retry"],
  InvalidAttestationKind: ["Wrong attestation kind", "Elevator receipts and lab certificates go through the delivery step, season checks through SCAS."],
  NotMatured: ["Not matured yet", "Grain claims open at maturity.", "retry"],
  ElectionPending: ["Elect buyback first", "A Hybrid instrument accepts cash only after the issuer elects buyback."],
};

export function messageOf(e: unknown): string {
  if (e == null) return "";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && typeof (e as { message?: unknown }).message === "string") return (e as { message: string }).message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export function extractLogs(e: unknown, depth = 0): string[] {
  if (!e || typeof e !== "object" || depth > 3) return [];
  const o = e as Record<string, unknown>;
  for (const k of ["logs", "transactionLogs"]) {
    const v = o[k];
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v as string[];
  }
  for (const k of ["error", "cause", "simulationResponse"]) {
    const r = extractLogs(o[k], depth + 1);
    if (r.length) return r;
  }
  return [];
}

export function explainChainError(input: { logs?: readonly string[] | null; error?: unknown }): ExplainedError {
  const text = [...(input.logs ?? []), messageOf(input.error)].join("\n");

  if (/caused by account: investor_record\. Error Code: AccountNotInitialized/.test(text)) {
    return {
      code: "KycRequired",
      title: "This wallet hasn't passed KYC",
      detail: "Instrument accounts start frozen and only KYC-approved wallets can subscribe. Complete KYC, then subscribe again.",
      action: "kyc",
    };
  }
  if (/Account is frozen|custom program error: 0x11\b/.test(text)) {
    return {
      code: "AccountFrozen",
      title: "This token account is frozen",
      detail: "Instrument accounts start frozen. Only a KYC-approved wallet can receive or send the Instrument.",
      action: "kyc",
    };
  }
  if (/User rejected|rejected the request|Approval Denied/i.test(text)) {
    return { code: "UserRejected", title: "Signature cancelled", detail: "Nothing was sent. You can try again.", action: "none" };
  }
  if (/block height exceeded|has expired/i.test(text)) {
    return { code: "Expired", title: "The transaction expired before it landed", detail: "Devnet was slow or the approval took too long. Nothing was charged; try again.", action: "retry" };
  }
  if (/Blockhash not found|BlockhashNotFound/i.test(text)) {
    return {
      code: "WrongNetwork",
      title: "Your wallet is on a different network",
      detail: "Switch your wallet to Devnet and try again.",
      action: "switch-network",
    };
  }
  if (/Attempt to debit an account but found no record of a prior credit|AccountNotFound|insufficient lamports/i.test(text)) {
    // ADR 0013: users never pay SOL. The payer is the gas sponsor (user transactions) or a role key (console, demo).
    return {
      code: "NoSol",
      title: "A platform account is out of devnet SOL",
      detail: "Your wallet needs no SOL: the gas sponsor or a server key that pays this transaction is empty. Nothing was charged. Try again later.",
      action: "none",
    };
  }
  if (
    /Error: insufficient funds|custom program error: 0x1\b/.test(text) ||
    /caused by account: (investor|producer)_usdc\. Error Code: AccountNotInitialized/.test(text)
  ) {
    return { code: "InsufficientUsdc", title: "Not enough test USDC", detail: "Get test USDC from the faucet, then try again.", action: "faucet" };
  }
  const m = /Error Code: (\w+)/.exec(text);
  if (m) {
    const code = m[1] as string;
    const known = PROGRAM[code];
    if (known) return { code, title: known[0], detail: known[1], action: known[2] ?? "none" };
    return { code, title: "The program rejected this transaction", detail: `Program error ${code}. Reload the page and try again; if it repeats, the pool may have changed state.`, action: "none" };
  }
  return {
    code: "Unknown",
    title: "Something went wrong",
    detail: messageOf(input.error) || "The transaction did not go through. Try again.",
    action: "retry",
  };
}
