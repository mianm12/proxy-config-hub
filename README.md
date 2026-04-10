# proxy-config-hub

Unified repository for Mihomo overrides, experimental Sub-Store scripts, and reusable rule assets.

## Repository Layout

```text
scripts/
  _lib/        Shared source modules for override bundling
  override/    Mihomo-first override script sources
  sub-store/   Sub-Store-only utility scripts
rules/
  custom/      Custom rules maintained in this repository
  provided/    Replacement rules for upstream gaps
templates/
  mihomo/      Sanitized example output and reference templates
tools/         Local validation and bundling tooling
```

## Development Baseline

- Package manager: `npm`
- Node.js: `>=20` (see `.nvmrc`)
- Module default: CommonJS (`package.json` does not opt into ESM)

## Documentation

- Full design and implementation decisions: [DESIGN.md](./DESIGN.md)
- Sanitized Mihomo example config: [templates/mihomo/config-example.yaml](./templates/mihomo/config-example.yaml)

This repository intentionally starts with structure and conventions only. CI workflows, bundling scripts, and override implementations will be added in later steps.
