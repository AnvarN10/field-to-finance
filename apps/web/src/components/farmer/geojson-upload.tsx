"use client";

import { useState } from "react";
import { track } from "../../lib/analytics";
import { FieldImportError, parseFieldFile } from "../../lib/field-import";
import { MAX_FIELDS_PER_UPLOAD } from "../../lib/geojson";

export interface UploadedField {
  name: string;
  polygonHash: string;
  areaHa: number;
  areaHaX100: number;
  polygon: { coordinates: number[][][] };
  declaredHa: string;
}

export function GeojsonUpload({ onUploaded }: { onUploaded: (fields: UploadedField[]) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);

  async function handle(text: string, fileName: string) {
    setError(null);
    setCount(0);
    let items;
    try {
      // GeoJSON or KML; a MultiPolygon becomes one field per part (ADR 0014).
      items = parseFieldFile(fileName, text, new DOMParser());
    } catch (e) {
      setError(e instanceof FieldImportError ? e.message : "The file could not be read. Export it again as GeoJSON or KML.");
      return;
    }
    if (items.length > MAX_FIELDS_PER_UPLOAD) {
      setError(`Register at most ${MAX_FIELDS_PER_UPLOAD} fields at a time. This file has ${items.length}; split it into projects of up to ${MAX_FIELDS_PER_UPLOAD} fields.`);
      return;
    }
    setBusy(true);
    try {
      const fields: UploadedField[] = [];
      for (const item of items) {
        const res = await fetch("/api/polygons", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(item.feature) });
        const body = await res.json();
        if (!res.ok) throw new Error(`${item.name}: ${body.error ?? "upload failed"}. Fix this boundary and choose the file again.`);
        fields.push({ name: item.name, polygonHash: body.polygonHash, areaHa: body.areaHa, areaHaX100: body.areaHaX100, polygon: body.polygon, declaredHa: body.areaHa.toFixed(2) });
      }
      setCount(fields.length);
      track("fields_uploaded", { count: fields.length });
      onUploaded(fields);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Check your connection and choose the file again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="geojson" className="text-sm font-medium">
        Field boundaries (GeoJSON or KML)
      </label>
      <input
        id="geojson"
        type="file"
        accept=".geojson,.json,.kml,application/geo+json,application/json,application/vnd.google-earth.kml+xml"
        disabled={busy}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await handle(await f.text(), f.name);
        }}
        className="max-w-full text-sm text-muted-foreground file:mr-3 file:h-9 file:cursor-pointer file:rounded-md file:border file:border-border file:bg-card file:px-3 file:text-sm file:font-medium file:text-foreground file:transition-colors file:duration-100 disabled:opacity-60 [@media(hover:hover)]:file:hover:bg-muted"
      />
      <p className="text-xs text-muted-foreground">
        {`Up to ${MAX_FIELDS_PER_UPLOAD} fields; a MultiPolygon counts one field per part. `}
        <button
          type="button"
          disabled={busy}
          className="rounded-sm font-medium text-primary underline decoration-muted-foreground underline-offset-4 disabled:opacity-60 [@media(hover:hover)]:hover:decoration-current"
          onClick={async () => handle(await (await fetch("/samples/demo-fields.geojson")).text(), "demo-fields.geojson")}
        >
          Use the sample file
        </button>
      </p>
      {busy ? <p role="status" className="text-sm text-muted-foreground">Checking boundaries</p> : null}
      {count ? <p role="status" className="text-sm font-medium text-success">{`${count} field${count > 1 ? "s" : ""} ready`}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
