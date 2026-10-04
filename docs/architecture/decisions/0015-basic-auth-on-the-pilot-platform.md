---
status: Accepted
date: "2026-10-05"
---

# Basic auth on the pilot platform

## Context

The first pilot term sheet is signed off for a real farmer, and the user approved showing that farmer's data on the platform (user decision 2026-10-05). Until now every page, the evidence files and the field polygons were public. The user asked for a gate "like Caddy basicauth". The web app runs on Railway, which has no Caddy or other reverse proxy in front of the service.

## Decision

- HTTP Basic Auth on the whole web app, implemented in the Next.js proxy (`src/proxy.ts`, Next.js 16's renamed middleware, Node.js runtime) with `src/lib/basic-auth.ts`.
- Credentials come from `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` (Infisical `dev`, Railway service variables of `web`). Comparison is constant-time: both the user and the password are compared as fixed-length HMACs with `timingSafeEqual`, and both comparisons always run.
- The challenge is `WWW-Authenticate: Basic realm="Field-to-Finance", charset="UTF-8"`.
- The proxy has no matcher, so it runs on every request: pages, server actions (POSTs to the page route), API routes, static assets and `public/` files. The only public path is `/api/health`, matched exactly, so the Railway healthcheck keeps working. Evidence and polygon routes stay protected because they will hold real farm data.
- Fail closed: if either variable is unset and `NODE_ENV` is `production`, every path except `/api/health` answers 503. Outside production (local dev, tests) unset variables disable the gate.
- The admin password (`ADMIN_PASSWORD`) stays as a second layer in front of the demo console.

## Consequences

- Browsers cache the credentials per origin, so same-origin `fetch` calls from the app (transactions, faucet, KYC, polygon upload, JSON reads) carry them without code changes. Privy and the wallet adapter talk to their own origins and to the RPC, not to this app, so they are unaffected.
- Anything outside the browser session cannot read the app: wallets fetching the Token-2022 metadata URI (`/api/instrument/<poolId>`) and external viewers of evidence URIs get 401. Wallets then show the mint without its JSON metadata (name and symbol are on-chain and still show). This is accepted for a closed pilot.
- Basic auth is a shared secret for a closed demo, not user accounts. It travels with every request, so it relies on HTTPS (Railway terminates TLS).

## Alternatives considered

- Caddy in front of the service: a second Railway service and an extra hop for one header check.
- Railway private networking only: the judges and the pilot farmer need a public URL.
- Per-user accounts: out of scope for the hackathon pilot.

## Related code

- `apps/web/src/proxy.ts`, `apps/web/src/lib/basic-auth.ts`
- `apps/web/test/basic-auth.test.ts`

## Related docs

- [Web app](../../systems/web.md)
