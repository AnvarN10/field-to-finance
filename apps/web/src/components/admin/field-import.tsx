"use client";

import { useState, useTransition } from "react";
import { saveFieldSetAction } from "../../app/admin/actions";
import { FieldImportError, areaCheck, parseFieldFile } from "../../lib/field-import";
import { shortKey } from "../../lib/format";
import { Button } from "../ui/button";

interface Row {
  name: string;
  polygonHash: string;
  areaHa: number;
  areaHaX100: number;
  cadastral: string;
  declared: string;
}

const cellInput =
  "h-8 w-full min-w-24 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Admin import of the farm's boundary export (ADR 0014): GeoJSON or KML, MultiPolygons split into fields,
 * a cadastral number and the declared area per field, and an area check. Polygons are stored by hash;
 * the field set with cadastral numbers stays in the bucket.
 */
export function FieldImport() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function handle(file: File) {
    setError(null);
    setSaved(null);
    setRows(null);
    let fields;
    try {
      fields = parseFieldFile(file.name, await file.text(), new DOMParser());
    } catch (e) {
      setError(e instanceof FieldImportError ? e.message : "The file could not be read.");
      return;
    }
    start(async () => {
      const out: Row[] = [];
      for (const f of fields) {
        const res = await fetch("/api/polygons", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f.feature) });
        const body = await res.json();
        if (!res.ok) {
          setError(`${f.name}: ${body.error ?? "upload failed"}`);
          return;
        }
        out.push({ name: f.name, polygonHash: body.polygonHash, areaHa: body.areaHa, areaHaX100: body.areaHaX100, cadastral: f.cadastralNumber ?? "", declared: "" });
      }
      setRows(out);
    });
  }

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r && r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const totalHa = rows?.reduce((n, r) => n + r.areaHa, 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Boundaries file (GeoJSON or KML)
        <input
          type="file"
          accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml"
          disabled={pending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handle(f);
          }}
          className="max-w-full text-sm font-normal text-muted-foreground file:mr-3 file:h-9 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-card file:px-3 file:text-sm file:font-medium file:text-foreground"
        />
      </label>
      {pending ? <p role="status" className="text-sm text-muted-foreground">Checking boundaries</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {rows ? (
        <>
          <div className="overflow-x-auto" role="region" aria-label="Imported fields table" tabIndex={0}>
            <table aria-label="Imported fields" className="tabular w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-medium">Field</th>
                  <th className="px-2 py-2 font-medium">Polygon area</th>
                  <th className="px-2 py-2 font-medium">Cadastral number</th>
                  <th className="px-2 py-2 font-medium">Declared area (ha)</th>
                  <th className="px-2 py-2 font-medium">Check</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const check = areaCheck(r.areaHa, r.declared ? Number(r.declared) : null);
                  return (
                    <tr key={r.polygonHash + i} className="border-b border-border last:border-0">
                      <td className="px-2 py-2">
                        <span className="block">{r.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{shortKey(r.polygonHash)}</span>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">{`${r.areaHa.toFixed(2)} ha`}</td>
                      <td className="px-2 py-2">
                        <input aria-label={`Cadastral number of ${r.name}`} value={r.cadastral} onChange={(e) => update(i, { cadastral: e.target.value })} className={cellInput} />
                      </td>
                      <td className="px-2 py-2">
                        <input aria-label={`Declared area of ${r.name}`} inputMode="decimal" value={r.declared} onChange={(e) => update(i, { declared: e.target.value })} className={`${cellInput} tabular`} />
                      </td>
                      <td className={`px-2 py-2 whitespace-nowrap ${check.ok ? "text-muted-foreground" : "font-medium text-destructive"}`}>
                        {check.deltaPct === null ? "Enter declared area" : `${check.deltaPct > 0 ? "+" : ""}${check.deltaPct.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="tabular text-sm text-muted-foreground">{`${rows.length} field${rows.length === 1 ? "" : "s"}, ${totalHa.toFixed(2)} ha. More than 5% between polygon and declared area is flagged.`}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await saveFieldSetAction(
                    rows.map((x) => ({
                      polygonHash: x.polygonHash,
                      areaHaX100: x.areaHaX100,
                      name: x.name,
                      cadastralNumber: x.cadastral.trim() || null,
                      declaredAreaHa: x.declared ? Number(x.declared) : null,
                    })),
                  );
                  if (r.ok) setSaved(r.hash);
                  else setError(r.error);
                })
              }
            >
              Save field set
            </Button>
            {saved ? (
              <p role="status" className="text-sm font-medium text-success">
                {`Field set saved: ${shortKey(saved)}. Cadastral numbers stay in the bucket; the farmer registers the boundaries in groups of up to 4.`}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
