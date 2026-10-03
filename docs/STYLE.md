# Documentation style

- Write in English, in clear and direct Markdown, for humans and AI agents.
- Keep headings stable. Use the templates in [templates/](templates/).
- Link related docs and source files with relative links from the current file.
- Explain behavior, responsibilities, flows, invariants and pitfalls. Do not restate code.
- Do not guess. Mark uncertainty explicitly, for example with an **Open question** note.
- Every system and flow doc ends with a source map of the most important files.
- Use Title Case for terms defined in the [glossary](glossary.md) when it improves clarity, for example Pool, Attestation, Producer.
- Amounts: on-chain values are integer base units of USDC (6 decimals). Docs and UI show USD.
- ADR frontmatter allows only `status`, `date` and `superseded_by`. Never rewrite an `Accepted` ADR to change the decision; write a new one and mark the old one `Superseded`.
- Docs that only matter for one task belong in a PR or the devlog, not in `docs/`.
