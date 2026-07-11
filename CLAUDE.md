# CLAUDE.md

This file is equivalent to `AGENTS.md` and provides repository guidance for Claude Code.

## Project

This is a personal Mihomo configuration compiler and publication repository. Human-authored configuration lives only in `config/**/*.yaml`; strict TypeScript compiles and validates it.

Artifacts:

- `dist/v2/override.js` for Mihomo Party, Clash Verge Rev, and Sub-Store Mihomo config override.
- `dist/v2/rename.js` for the Sub-Store node script operator.

Use Simplified Chinese for commit messages, comments, documentation, and console output.

## Commands

```bash
npm ci
npm run tools:setup
npm run check
npm run build
npm run test
npm run config:check
npm run verify:golden
npm run verify:mihomo
npm run audit:rules
npm run build:publication
npm run verify:publication
```

Run `npm run check` after code or configuration changes. Publication requires a current Mihomo verification receipt.

## Boundaries

- `config/`: only human-authored business configuration; `manifest.yaml` explicitly assembles modules.
- `src/compiler/`: YAML loading, Zod raw schemas, semantic validation, and Project IR.
- `src/domain/`: pure domain logic; no compiler, apps, tools, or Node API imports.
- `src/runtime/`: type-only Project IR dependency; no apps, tools, or Node API imports.
- `src/apps/`: host adapters; override and rename must not depend on one another.
- `src/build/`, `src/tools/`: bundles, official tool resolution, publication, and CI orchestration.
- `public/rules/`: custom rule assets copied verbatim during publication.
- historical `tests/fixtures/v1-input/` and `tests/golden/v1-*`: frozen migration evidence, not executable v1 code.

Never edit or commit generated `dist/v2/` artifacts.

## Conventions

- ESM, strict TypeScript, ES2020 bundle target.
- YAML remains the human interface; do not replace it with TypeScript configuration constants.
- Standard provider shorthand and full custom providers coexist.
- Runtime apply modes are explicit `overlay/replace/if-absent`; no generic deep merge.
- Initial topology supports `client → transit → landing → target` while retaining an IR boundary for future hops.
- Managed Mihomo fields are explicit; unrelated host fields pass through.
- QuickJS execution is not a formal gate yet.
- Subscription proxies remain in memory and must not enter logs, snapshots, or publication assets.
- Mihomo resolution order is `MIHOMO_BIN` → `PATH` → project cache with locked checksum.
- Network rule audit is independent and does not run inside normal `check`.

## CI/CD

- push/PR: `npm run tools:setup && npm run check`.
- `main`: deploy `/v2/` through a GitHub Pages artifact after checks pass.
- `v2.*.*` tag: validate and create an immutable GitHub Release.
- weekly/manual: remote provider availability and overlap audit.

Do not publish this project through `dist`, `gh-pages`, or `v2` branches.

Authoritative documentation is under `docs/v2/`, with `docs/DESIGN.md` as the entry point.
