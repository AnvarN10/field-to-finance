"use client";

import { useId, useState } from "react";
import type { InvestorState } from "../../lib/chain/views";
import { formatTonnes, formatUsd } from "../../lib/format";
import type { FieldSetEntry } from "../../lib/pilot-docs";
import type { TxSigner } from "../../lib/tx-client";
import { FieldMapLoader } from "../field/field-map-loader";
import { TxStatus } from "../tx/tx-status";
import { useTransaction } from "../tx/use-transaction";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useJson } from "../use-json";
import { GeojsonUpload, type UploadedField } from "./geojson-upload";
import { MintFeeNotice, mintFeeShortfall } from "./mint-fee-notice";

type Field = UploadedField & { cadastral: string };

/**
 * Field boundaries for an application: GeoJSON or KML import, declared area and cadastral number per field, then the
 * sponsored register_project transaction signed by the farmer's Privy wallet. Crop, season, volume and amount come
 * from the application, so the on-chain project matches what the arranger reviews.
 */
export function RegisterFields({
  signer,
  application,
  mintFee,
  maxArrangementBps,
  onRegistered,
}: {
  signer: TxSigner;
  application: { crop: string; season: number; volumeT: number; requestedUsd: number };
  mintFee: string | null;
  maxArrangementBps: number | null;
  onRegistered: (project: string, fields: FieldSetEntry[]) => void;
}) {
  const base = useId();
  const [fields, setFields] = useState<Field[]>([]);
  const [error, setError] = useState<string | null>(null);
  const balance = useJson<InvestorState>(`/api/investor/${signer.publicKey}`);
  const usdcBalance = balance.data ? BigInt(balance.data.usdcBalance) : null;
  const entries = (): FieldSetEntry[] =>
    fields.map((f) => ({ polygonHash: f.polygonHash, areaHaX100: Math.round(Number(f.declaredHa) * 100), name: f.name, cadastralNumber: f.cadastral.trim() || null, declaredAreaHa: Number(f.declaredHa) }));
  const tx = useTransaction("register-project", signer, {
    onSuccess: ({ meta }) => {
      if (meta?.project) onRegistered(meta.project, entries());
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fields.length) return setError("Upload your field boundaries first.");
    const bad = fields.findIndex((f) => !(Number(f.declaredHa) > 0));
    if (bad >= 0) {
      document.getElementById(`${base}-declared-${bad}`)?.focus();
      return setError(`Enter the declared area of ${fields[bad]?.name}.`);
    }
    if (usdcBalance !== null && mintFeeShortfall(usdcBalance, mintFee) > 0n) return setError(`Get test USDC first: registering costs ${formatUsd(BigInt(mintFee ?? "0"))}.`);
    setError(null);
    void tx.run({
      crop: application.crop,
      season: application.season,
      expectedKg: String(application.volumeT * 1000),
      requestedAmount: (BigInt(application.requestedUsd) * 1_000_000n).toString(),
      fields: entries().map((f) => ({ polygonHash: f.polygonHash, areaHaX100: f.areaHaX100 })),
    });
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <GeojsonUpload
        onUploaded={(f) => {
          setFields(f.map((x) => ({ ...x, cadastral: "" })));
          setError(null);
        }}
      />
      {fields.length ? (
        <div className="flex flex-col gap-3">
          <FieldMapLoader polygons={fields.map((f) => f.polygon)} height={260} />
          <div className="overflow-x-auto" role="region" aria-label="Fields to register" tabIndex={0}>
            <table className="tabular w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Field</th>
                  <th className="py-2 pr-3 font-medium">Measured</th>
                  <th className="py-2 pr-3 font-medium">Declared (ha)</th>
                  <th className="py-2 font-medium">Cadastral number</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f, i) => (
                  <tr key={f.polygonHash} className="border-t border-border">
                    <td className="py-2 pr-3">{f.name}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{`${f.areaHa.toFixed(2)} ha`}</td>
                    <td className="py-2 pr-3">
                      <Input
                        id={`${base}-declared-${i}`}
                        aria-label={`Declared area for ${f.name}`}
                        inputMode="decimal"
                        value={f.declaredHa}
                        onChange={(e) => setFields((p) => p.map((x, j) => (j === i ? { ...x, declaredHa: e.target.value } : x)))}
                        className="w-28"
                      />
                    </td>
                    <td className="py-2">
                      <Input
                        aria-label={`Cadastral number for ${f.name}`}
                        maxLength={40}
                        value={f.cadastral}
                        onChange={(e) => setFields((p) => p.map((x, j) => (j === i ? { ...x, cadastral: e.target.value } : x)))}
                        className="w-44"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Cadastral numbers stay in the platform's private storage. Only polygon hashes and areas go on-chain.</p>
        </div>
      ) : null}
      <p className="tabular text-sm text-muted-foreground">{`Registers ${application.crop} ${application.season}: ${formatTonnes(BigInt(application.volumeT) * 1000n)} expected, ${formatUsd(BigInt(application.requestedUsd) * 1_000_000n)} requested.`}</p>
      <MintFeeNotice wallet={signer.publicKey} mintFee={mintFee} usdcBalance={usdcBalance} maxArrangementBps={maxArrangementBps} onFunded={() => void balance.reload()} />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={tx.busy} className="self-start">
        Register fields
      </Button>
      <TxStatus
        state={tx.state}
        onAction={(a) => {
          if (a === "faucet") void balance.reload();
          if (a === "retry") void tx.retry();
        }}
        successLabel="Fields registered on-chain"
      />
    </form>
  );
}
