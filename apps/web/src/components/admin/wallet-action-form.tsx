"use client";

import { useId, useRef, useState } from "react";
import { approveInvestorAction, revokeInvestorAction } from "../../app/admin/actions";
import { Input } from "../ui/input";
import { ActionButton } from "./action-button";

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const FORMAT_ERROR = "Enter a Solana address: 32 to 44 base58 characters";

export function WalletActionForm({ poolId, mode }: { poolId: string; mode: "approve" | "revoke" }) {
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  // Enabled once something is pasted; the format is checked on press so a typo gets a message, not a dead button.
  async function act() {
    if (!ADDRESS.test(wallet)) {
      setError(FORMAT_ERROR);
      inputRef.current?.focus();
      return { ok: false as const, error: { code: "BadRequest", title: "Check the wallet address", detail: "", action: "none" as const }, logs: [] };
    }
    setError(null);
    return mode === "approve" ? approveInvestorAction(wallet) : revokeInvestorAction(poolId, wallet);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {mode === "approve" ? "Wallet to approve" : "Wallet to revoke"}
        <Input
          ref={inputRef}
          value={wallet}
          onChange={(e) => {
            setWallet(e.target.value.trim());
            setError(null);
          }}
          placeholder="Investor wallet address"
          spellCheck={false}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="font-mono text-base font-normal md:text-[13px]"
        />
        {error ? (
          <span id={errorId} className="text-xs font-normal text-destructive">
            {error}
          </span>
        ) : null}
      </label>
      <ActionButton
        label={mode === "approve" ? "Approve investor (all pools)" : "Revoke investor"}
        role="Compliance"
        action={act}
        disabled={wallet === ""}
        disabledReason={wallet === "" ? "Paste a wallet address" : undefined}
        confirmText={mode === "revoke" ? "Freeze this investor's Instrument account?" : undefined}
      />
    </div>
  );
}
