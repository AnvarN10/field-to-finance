"use client";

import { useId, useRef, useState } from "react";
import { adminMintUsdcAction } from "../../app/arranger/actions";
import { Input } from "../ui/input";
import { ActionButton } from "./action-button";

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/** Mirrors ADMIN_MINT_MAX_USD in admin-ops. */
const MAX_USD = 5_000_000;

/** Large test-USDC amounts for demo investors buying $100,000 tokens; the public faucet stays small. */
export function MintUsdcForm() {
  const [wallet, setWallet] = useState("");
  const [usd, setUsd] = useState("1000000");
  const [errors, setErrors] = useState<{ wallet?: string; usd?: string }>({});
  const walletRef = useRef<HTMLInputElement>(null);
  const usdRef = useRef<HTMLInputElement>(null);
  const base = useId();

  async function act() {
    const e: { wallet?: string; usd?: string } = {};
    if (!ADDRESS.test(wallet)) e.wallet = "Enter a Solana address: 32 to 44 base58 characters";
    const n = Number(usd);
    if (!(Number.isInteger(n) && n >= 1 && n <= MAX_USD)) e.usd = `Whole dollars from $1 to $${MAX_USD.toLocaleString("en-US")}`;
    setErrors(e);
    if (e.wallet || e.usd) {
      (e.wallet ? walletRef : usdRef).current?.focus();
      return { ok: false as const, error: { code: "BadRequest", title: "Fix the highlighted fields", detail: "", action: "none" as const }, logs: [] };
    }
    return adminMintUsdcAction(wallet, n);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <div className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
          <label htmlFor={`${base}-wallet`}>Wallet</label>
          <Input
            id={`${base}-wallet`}
            ref={walletRef}
            value={wallet}
            onChange={(e) => setWallet(e.target.value.trim())}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={errors.wallet ? true : undefined}
            aria-describedby={errors.wallet ? `${base}-w` : undefined}
            className="font-mono text-base font-normal md:text-[13px]"
          />
          {errors.wallet ? (
            <span id={`${base}-w`} className="text-xs font-normal text-destructive">
              {errors.wallet}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          <label htmlFor={`${base}-usd`}>Amount (USD)</label>
          <Input
            id={`${base}-usd`}
            ref={usdRef}
            value={usd}
            onChange={(e) => setUsd(e.target.value.trim())}
            inputMode="numeric"
            aria-invalid={errors.usd ? true : undefined}
            aria-describedby={errors.usd ? `${base}-u` : undefined}
            className="tabular"
          />
          {errors.usd ? (
            <span id={`${base}-u`} className="text-xs font-normal text-destructive">
              {errors.usd}
            </span>
          ) : null}
        </div>
      </div>
      <ActionButton label="Mint test USDC" role="Deployer" action={act} disabled={wallet === ""} disabledReason={wallet === "" ? "Paste a wallet address" : undefined} />
    </div>
  );
}
