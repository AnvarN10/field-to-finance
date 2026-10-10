#!/usr/bin/env bash
# Builds the English user guide PDF from Typst (Typst 0.14+, PT Sans installed).
set -euo pipefail
cd "$(dirname "$0")"
typst compile user-guide-en.typ user-guide-en.pdf
echo "Built $(pwd)/user-guide-en.pdf"
