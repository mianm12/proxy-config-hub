# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mihomo (Clash.Meta) override script and declarative YAML rule configuration hub. The main output is a single IIFE bundle (`dist/scripts/override/main.js`) that takes a bare proxy subscription and produces a complete Mihomo config with DNS, proxy groups, and routing rules. A Sub-Store rename script is also published.

Language: Chinese (Simplified) is used in commit messages, comments, docs, and console output throughout this repo. Follow this convention.

## Commands

```bash
npm ci                    # Install dependencies (Node.js >= 24 required)
npm run rules:build       # Compile definitions/ YAML → scripts/config/ JS modules
npm run build             # rules:build + esbuild bundle + copy assets to dist/
npm run verify            # Build then run verify:main + verify:migration
npm run example:config    # Build then generate dist/example-full-config.yaml
npm run audit:rule-overlap # Check domain/IP overlap across rule providers (fetches remote)
```

No test framework — verification is done via `tools/verify-main.js` (bundle sanity check) and `tools/verify-yaml-migration.js` (migration compatibility).

## Architecture

### Build pipeline

1. **`tools/yaml-to-js.js`** compiles YAML from two namespaces under `definitions/` into JS modules under `scripts/config/`:
   - `definitions/rules/registry/*.yaml` → `scripts/config/rules/*.js` (rule providers, group definitions, inline rules)
   - `definitions/runtime/*.yaml` → `scripts/config/runtime/*.js` (DNS, sniffer, tun, geodata, profile, base)
2. **`build.js`** bundles `scripts/override/main.js` via esbuild into `dist/scripts/override/main.js` (IIFE, exposes `globalThis.main`), then copies `definitions/rules/custom/` and `scripts/sub-store/` to `dist/`.

### Override script (`scripts/override/main.js`)

Entry point: `function main(config)` — receives a Mihomo config object with `proxies` populated, returns the fully configured object. Pipeline:

1. **`applyRuntimePreset(config)`** — merges all runtime YAML presets (DNS, sniffer, tun, geodata, profile, base) onto config
2. **`buildProxyGroups(proxies, groupDefinitions)`** — creates proxy-groups from `groupDefinitions.yaml`
3. **`assembleRuleSet(groupDefinitions, ruleProviders, inlineRules)`** — prepends inline rules, maps each rule provider to its target group, then appends fallback `MATCH`
4. **`validateOutput(config)`** — post-assembly validation

Shared modules live in `scripts/override/lib/`.

### Data model

- **`definitions/`** is the single source of truth for all declarative config. Never hand-edit `scripts/config/` — it is generated.
- `definitions/rules/registry/` is the active ruleset assembly entrypoint for group definitions, inline rules, and rule providers.
- `definitions/rules/custom/` contains template/asset files copied verbatim to dist — they are NOT part of the active ruleset assembly.
- The build rejects coexistence of `definitions/` and a legacy `rules/` directory.

### CI/CD

Push to `main` → GitHub Actions builds, verifies, deploys `dist/` to the `dist` branch, and purges jsdelivr CDN cache.

## Key Conventions

- ESM throughout (`"type": "module"` in package.json), target ES2020 for the bundle.
- The override script uses ES2018 features (negative lookbehind) — compatible with V8/Node but not JavaScriptCore (iOS).
- Rule providers reference remote rule-set URLs; group definitions declare proxy-group structure. Both are YAML-declared, JS-generated.
- Runtime preset YAML files map 1:1 to Mihomo top-level config keys (dns, sniffer, tun, etc.).
