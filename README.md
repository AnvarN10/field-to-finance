# Field-to-Finance

Farmers need money for seed, fertilizer and fuel months before the harvest exists. Field-to-Finance lets a farmer raise that money today against part of next season's harvest, on Solana.

1. A farmer registers fields and asks for financing.
2. An independent verifier confirms the fields with Sentinel-2 satellite data and signs an attestation recorded on Solana.
3. An Issuer packages verified farm projects into a pooled token, for example `WHEAT-2027`.
4. KYC-approved investors buy the token with USDC. Token accounts stay frozen until KYC passes.
5. The verifier keeps attesting through the season: sowing, vegetation index, harvest.
6. After harvest the pool settles and investors are paid out.

Status: hackathon build, Solana Colosseum fall 2026. Documentation starts at [docs/README.md](docs/README.md).

## Devnet

| What | Address |
| --- | --- |
| Program | [`9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm`](https://explorer.solana.com/address/9syreF6kWfmMfoCkTSE8f7p3kRY1Bh7TSDjGAr9s6Jfm?cluster=devnet) |
| Test USDC mint | [`Fhfr7QZ6PpZF4ug1kVdnA7dfMGaSJawGL6dhwNMFvTjv`](https://explorer.solana.com/address/Fhfr7QZ6PpZF4ug1kVdnA7dfMGaSJawGL6dhwNMFvTjv?cluster=devnet) |

Keys and endpoints live in Infisical, project `field-to-finance`, environment `dev`. Deploy and initialize in one go, because `init_config` accepts its first caller:

```bash
cd anchor && anchor deploy --provider.cluster devnet --provider.wallet ~/.config/f2f/deployer.json && cd ..
infisical run --env=dev -- ./node_modules/.bin/tsx scripts/devnet-bootstrap.ts
```

### Devnet test scripts

```bash
scripts/inf.sh ./node_modules/.bin/tsx scripts/devnet-seed-pool.ts                 # open pool WHEAT-2027 (idempotent)
scripts/inf.sh ./node_modules/.bin/tsx scripts/devnet-onboard-investor.ts <wallet>  # KYC + 10,000 test USDC + fee SOL
scripts/inf.sh ./node_modules/.bin/tsx scripts/buy/server.ts                        # http://localhost:4400, buy from Phantom
```

`scripts/inf.sh` injects the Infisical `dev` secrets using the local machine identity. SCAS attestations in these scripts come from the stub.
