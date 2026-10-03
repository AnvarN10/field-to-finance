#!/usr/bin/env bash
# Runs a command with the field-to-finance dev secrets from Infisical (machine identity login).
set -euo pipefail
set -a; source ~/.infisical/personal.env; set +a
TOK=$(infisical login --method=universal-auth --client-id="$INFISICAL_CLIENT_ID" --client-secret="$INFISICAL_CLIENT_SECRET" --domain="$INFISICAL_API_URL" --silent --plain)
exec infisical run --projectId=e1088410-bcf7-45b7-a883-0a12cf0cb14b --env=dev --token="$TOK" --domain="$INFISICAL_API_URL" --silent -- "$@"
