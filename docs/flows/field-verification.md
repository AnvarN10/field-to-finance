# Field verification

## Purpose

Takes a Producer's field from an uploaded boundary to a `FieldVerified` Attestation on Solana, which `add_project` requires.

## Trigger

A Producer uploads GeoJSON in the farmer view.

## Participants

Producer (Privy embedded wallet), web app (`/api/polygons`, `/api/tx/register-project`, arranger cabinet), bucket `f2f-evidence`, SCAS stub with the SCAS key, the Program.

## Step-by-step flow

1. The browser splits the file into one Polygon per field (MultiPolygon is rejected) and posts each to `/api/polygons`.
2. The server normalizes the polygon with `@f2f/sdk` (unwrap Feature, drop altitude, round to 7 decimals, close rings), rejects self-crossing or out-of-range boundaries, computes the geodesic area, and stores `polygons/<polygonHash>.json`.
3. The Producer confirms declared areas and the financing request; the server builds `register_project` plus one `register_field(polygonHash, area_ha_x100)` per field and simulates it; the Producer signs.
4. In the arranger cabinet, "Verify fields with the SCAS stub" on the application (field verification step) runs the SCAS stub for the application's project; "Verify all fields" under Live pools, Manual pilot tools, covers every unverified field of every project not in a pool.
5. For each field the stub reads `attestation_count`, writes the stub evidence to `evidence/<sha256>.json`, then signs `record_attestation(FieldVerified, Pass, hash, uri, 0, now)`. The Program sets the field verified.
6. The field page shows the boundary over satellite imagery and the timeline with the evidence link and the stub badge.

## Data and state changes

FarmProject and Field accounts (step 3); Attestation account, Field `verified`, project `verified_field_count` (step 5); bucket objects (steps 2 and 5).

## Success behavior

Every field shows "Field verified · Pass" and the project shows "Verified. Waiting to join a pool".

## Failure behavior

- Invalid boundary: the upload is refused with the reason; nothing is stored.
- Boundary not uploaded: `register-project` returns 422.
- Two attestations at once on one field: serialized; both land with consecutive sequences.
- RPC failure during a batch: the batch continues and reports the failed fields.

## External dependencies

Devnet RPC, Railway bucket, Privy.

## Invariants and assumptions

- The on-chain polygon hash equals the stored polygon's SHA-256.
- Evidence exists before its Attestation.
- The stub always says it is a stub ([ADR 0012](../architecture/decisions/0012-scas-external-provider-stub.md)).

## Security and privacy notes

Field boundaries become public through `/api/polygons/<hash>`. Use demo boundaries unless the farmers agree.

## Observability and debugging

The arranger cabinet lists unverified fields; batch failures name the field. GlitchTip reports server errors.

## Testing notes

`test/polygons.test.ts`, `test/geojson.test.ts`, `test/scas-stub.test.ts`, `test/user-tx.test.ts`.

## Source map

- [geojson-upload.tsx](../../apps/web/src/components/farmer/geojson-upload.tsx)
- [polygons.ts](../../apps/web/src/lib/polygons.ts)
- [scas-stub.ts](../../apps/web/src/lib/scas-stub.ts)
- [arranger/actions.ts](../../apps/web/src/app/arranger/actions.ts), [arranger/workflow-actions.ts](../../apps/web/src/app/arranger/workflow-actions.ts)

## Related docs

- [Web app](../systems/web.md), [Program](../systems/program.md), [ADR 0012](../architecture/decisions/0012-scas-external-provider-stub.md)
