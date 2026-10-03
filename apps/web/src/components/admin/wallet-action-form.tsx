"use client";

import { useState } from "react";
import { approveInvestorAction, revokeInvestorAction } from "../../app/admin/actions";
import { Input } from "../ui/input";
import { ActionButton } from "./action-button";

export function WalletActionForm({ poolId, mode }: { poolId: string; mode: "approve" | "revoke" }) {
  const [wallet, setWallet] = useState("");
  const valid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {mode === "approve" ? "Wallet to approve" : "Wallet to revoke"}
      <Input
        value={wallet}
        onChange={(e) => setWallet(e.target.value.trim())}
        placeholder="Investor wallet address"
        spellCheck={false}
        autoComplete="off"
        className="font-mono text-[13px] font-normal"
      />
      </label>
      <ActionButton
        label={mode === "approve" ? "Approve investor (all pools)" : "Revoke investor"}
        role="Compliance"
        action={() => (mode === "approve" ? approveInvestorAction(wallet) : revokeInvestorAction(poolId, wallet))}
        disabled={!valid}
        disabledReason={valid ? undefined : "Paste a wallet address"}
        confirmText={mode === "revoke" ? "Freeze this investor's Instrument account?" : undefined}
      />
    </div>
  );
}
