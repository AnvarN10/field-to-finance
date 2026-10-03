import { describe, expect, it } from "vitest";
import { explainChainError, extractLogs } from "../src/lib/chain/explain";

const PID = "9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm";

describe("explainChainError", () => {
  it("turns a missing InvestorRecord into a KYC message (the demo beat)", () => {
    const e = explainChainError({
      logs: [
        `Program ${PID} invoke [1]`,
        "Program log: Instruction: Subscribe",
        "Program log: AnchorError caused by account: investor_record. Error Code: AccountNotInitialized. Error Number: 3012. Error Message: The program expected this account to be already initialized.",
        `Program ${PID} failed: custom program error: 0xbc4`,
      ],
    });
    expect(e).toMatchObject({ code: "KycRequired", title: "This wallet hasn't passed KYC", action: "kyc" });
  });

  it("maps a revoked investor to KYC as well", () => {
    const e = explainChainError({
      logs: ["Program log: AnchorError thrown in programs/f2f/src/instructions/subscribe.rs:40. Error Code: InvestorNotApproved. Error Number: 6024. Error Message: x."],
    });
    expect(e).toMatchObject({ code: "InvestorNotApproved", action: "kyc" });
  });

  it("explains a frozen token account", () => {
    const e = explainChainError({
      logs: [
        "Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb invoke [1]",
        "Program log: Instruction: TransferChecked",
        "Program log: Error: Account is frozen",
        "Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb failed: custom program error: 0x11",
      ],
    });
    expect(e).toMatchObject({ code: "AccountFrozen", action: "kyc" });
  });

  it("points to the faucet for missing USDC or a missing USDC account; missing SOL is the sponsor's problem (ADR 0013)", () => {
    expect(explainChainError({ logs: ["Program log: Error: insufficient funds", "Program Tokenkeg failed: custom program error: 0x1"] })).toMatchObject({ code: "InsufficientUsdc", action: "faucet" });
    expect(explainChainError({ logs: ["Program log: AnchorError caused by account: investor_usdc. Error Code: AccountNotInitialized. Error Number: 3012."] })).toMatchObject({ code: "InsufficientUsdc", action: "faucet" });
    expect(explainChainError({ logs: ["Program log: AnchorError caused by account: producer_usdc. Error Code: AccountNotInitialized. Error Number: 3012."] })).toMatchObject({ code: "InsufficientUsdc", action: "faucet" });
    expect(explainChainError({ error: "AccountNotFound" })).toMatchObject({ code: "NoSol", action: "none", title: "A platform account is out of devnet SOL" });
  });

  it("explains the fee errors in plain words", () => {
    expect(explainChainError({ logs: ["Program log: AnchorError occurred. Error Code: FeeTooHigh. Error Number: 6032."] })).toMatchObject({ code: "FeeTooHigh", title: "Fee is above the cap" });
    expect(explainChainError({ logs: ["Program log: AnchorError occurred. Error Code: InvalidTreasury. Error Number: 6033."] })).toMatchObject({ code: "InvalidTreasury" });
    expect(explainChainError({ logs: ["Program log: AnchorError occurred. Error Code: MissingFeeAccount. Error Number: 6034."] })).toMatchObject({ code: "MissingFeeAccount" });
  });

  it("tells the user to switch networks when the wallet does not know the blockhash", () => {
    expect(explainChainError({ error: new Error("Transaction simulation failed: Blockhash not found") })).toMatchObject({
      code: "WrongNetwork",
      title: "Your wallet is on a different network",
      action: "switch-network",
    });
  });

  it("recognises a cancelled signature", () => {
    expect(explainChainError({ error: { name: "WalletSignTransactionError", message: "User rejected the request." } })).toMatchObject({ code: "UserRejected", action: "none" });
  });

  it("maps known program errors and keeps unknown codes", () => {
    expect(explainChainError({ logs: ["Program log: AnchorError occurred. Error Code: ExceedsTarget. Error Number: 6023."] })).toMatchObject({
      code: "ExceedsTarget",
      title: "That is more than the pool still needs",
    });
    expect(explainChainError({ logs: ["Program log: Error Code: SomethingNew."] })).toMatchObject({ code: "SomethingNew", title: "The program rejected this transaction" });
    expect(explainChainError({})).toMatchObject({ code: "Unknown", action: "retry" });
  });

  it("finds logs nested in wallet errors", () => {
    expect(extractLogs({ error: { logs: ["a", "b"] } })).toEqual(["a", "b"]);
    expect(extractLogs({ transactionLogs: ["c"] })).toEqual(["c"]);
    expect(extractLogs(null)).toEqual([]);
  });
});

describe("explainChainError fallback for unknown program errors", () => {
  it("names a way to recover", () => {
    const e = explainChainError({ logs: ["Program log: AnchorError occurred. Error Code: SomethingNew. Error Number: 6099."] });
    expect(e.detail).toMatch(/Reload the page and try again/);
  });
});

describe("expired transaction", () => {
  it("is reported as expired with a retry, not as a network mismatch", async () => {
    const { explainChainError } = await import("../src/lib/chain/explain");
    const e = explainChainError({ error: new Error("Signature abc has expired: block height exceeded.") });
    expect(e.title).toBe("The transaction expired before it landed");
    expect(e.action).toBe("retry");
  });
});
