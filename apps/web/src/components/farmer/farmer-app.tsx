"use client";

import { useState } from "react";
import type { InvestorState } from "../../lib/chain/views";
import { formatTonnes, formatUsd, parseUsd } from "../../lib/format";
import { FieldMapLoader } from "../field/field-map-loader";
import { TxStatus } from "../tx/tx-status";
import { useTransaction } from "../tx/use-transaction";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useJson } from "../use-json";
import { FarmerSessionProvider, useFarmerSession } from "../wallet/farmer-session";
import { FaucetButton } from "../wallet/faucet-button";
import { GeojsonUpload, type UploadedField } from "./geojson-upload";
import { ProjectList } from "./project-list";

const SOL_FOR_FEES = 20_000_000;

function Register({ wallet, onRegistered }: { wallet: string; onRegistered: () => void }) {
  const session = useFarmerSession();
  const [fields, setFields] = useState<UploadedField[]>([]);
  const [tonnes, setTonnes] = useState("400");
  const [usd, setUsd] = useState("2000");
  const [formError, setFormError] = useState<string | null>(null);
  const tx = useTransaction("register-project", session.signer, { onSuccess: onRegistered });
  const balance = useJson<InvestorState>(`/api/investor/${wallet}`);
  const lowSol = balance.data ? balance.data.solLamports < SOL_FOR_FEES : false;
  let requestedLabel = "";
  try {
    requestedLabel = formatUsd(parseUsd(usd));
  } catch {
    requestedLabel = "";
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fields.length) return setFormError("Upload your field boundaries first.");
    const t = Number(tonnes);
    if (!Number.isFinite(t) || t <= 0) return setFormError("Enter the expected harvest in tonnes.");
    let requested: bigint;
    try {
      requested = parseUsd(usd);
    } catch (err) {
      return setFormError((err as Error).message);
    }
    const declared = fields.map((f) => Math.round(Number(f.declaredHa) * 100));
    if (declared.some((d) => !Number.isFinite(d) || d <= 0)) return setFormError("Enter a declared area above 0 ha for every field.");
    setFormError(null);
    void tx.run({
      crop: "wheat",
      season: 2027,
      expectedKg: String(Math.round(t * 1000)),
      requestedAmount: requested.toString(),
      fields: fields.map((f, i) => ({ polygonHash: f.polygonHash, areaHaX100: declared[i] as number })),
    });
  }

  const label = "flex flex-col gap-1.5 text-sm font-medium";
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6 rounded-lg border border-border bg-card p-6">
      <h2 className="text-base font-semibold">Request financing for the 2027 wheat season</h2>
      <GeojsonUpload onUploaded={setFields} />
      {fields.length ? (
        <div className="flex flex-col gap-3">
          <FieldMapLoader polygons={fields.map((f) => f.polygon)} height={280} />
          <div className="overflow-x-auto">
            <table className="tabular w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Field</th>
                  <th className="py-2 pr-3 font-medium">Measured</th>
                  <th className="py-2 font-medium">Declared (ha)</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f, i) => (
                  <tr key={f.polygonHash} className="border-t border-border">
                    <td className="py-2 pr-3">{f.name}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{`${f.areaHa.toFixed(2)} ha`}</td>
                    <td className="py-2">
                      <Input
                        aria-label={`Declared area for ${f.name}`}
                        inputMode="decimal"
                        value={f.declaredHa}
                        onChange={(e) => setFields((prev) => prev.map((x, j) => (j === i ? { ...x, declaredHa: e.target.value } : x)))}
                        className="tabular w-28"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Expected harvest (tonnes)
          <Input value={tonnes} onChange={(e) => setTonnes(e.target.value)} inputMode="decimal" className="tabular h-10 text-base" />
          <span className="text-xs font-normal text-muted-foreground">{`30% backs the instrument: ${Number(tonnes) > 0 ? formatTonnes(BigInt(Math.round(Number(tonnes) * 300))) : "0 t"}`}</span>
        </label>
        <label className={label}>
          Amount requested (USD)
          <Input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" className="tabular h-10 text-base" />
          <span className="text-xs font-normal text-muted-foreground">Paid in USDC when the pool is funded.</span>
        </label>
      </div>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      {lowSol ? (
        <div className="flex flex-col gap-2 rounded-md bg-muted p-4 text-sm">
          <p>Registering costs a small network fee. Your new account has none yet.</p>
          <FaucetButton wallet={wallet} usdc={false} onDone={balance.reload} label="Get free devnet SOL for fees" />
        </div>
      ) : null}
      <Button type="submit" size="lg" disabled={tx.busy} className="h-11 self-start px-5 text-base">
        Register fields
      </Button>
      <TxStatus state={tx.state} onAction={(a) => a === "faucet" && void balance.reload()} successLabel={`Registered. Requested ${requestedLabel}`} />
    </form>
  );
}

function Inner() {
  const session = useFarmerSession();
  const [refreshKey, setRefreshKey] = useState(0);
  if (!session.ready) return <div className="h-40 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" aria-label="Loading account" />;
  if (!session.authenticated || !session.signer) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Sign in to register your fields</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          {session.mode === "privy"
            ? "Sign in with your email. We create a secure account for you; there is no seed phrase to manage."
            : "Connect a Solana wallet on devnet."}
        </p>
        <Button type="button" size="lg" onClick={session.login} className="h-11 px-5 text-base">
          {session.mode === "privy" ? "Sign in with email" : "Connect wallet"}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{session.email ? `Signed in as ${session.email}` : "Wallet connected"}</span>
        <Button type="button" variant="link" className="h-auto px-0 text-foreground" onClick={session.logout}>
          Sign out
        </Button>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Your projects</h2>
        <ProjectList wallet={session.signer.publicKey} refreshKey={refreshKey} />
      </section>
      <Register wallet={session.signer.publicKey} onRegistered={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}

export function FarmerApp() {
  return (
    <FarmerSessionProvider>
      <Inner />
    </FarmerSessionProvider>
  );
}
