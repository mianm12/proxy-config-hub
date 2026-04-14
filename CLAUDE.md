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
   - `definitions/runtime/*.yaml` → `scripts/config/runtime/*.js` (DNS, sniffer, tun, geodata, profile, base, regions, placeholders)
2. **`build.js`** bundles `scripts/override/main.js` via esbuild into `dist/scripts/override/main.js` (IIFE, exposes `globalThis.main`), then copies assets listed in `tools/lib/paths.js:COPY_ASSETS` to `dist/`.

### Shared tool modules

- **`tools/lib/fs-helpers.js`** — shared filesystem utilities: `pathExists`, `listEntries`, `copyDirectory`, `copyFile`. Used by build.js, yaml-to-js.js, verify-yaml-migration.js.
- **`tools/lib/paths.js`** — centralized path constants, namespace configs, and asset copy mappings. All tools import paths from here instead of computing them locally. To add a new asset to copy during build, add an entry to `COPY_ASSETS`. Namespace configs (`CANONICAL_NAMESPACES`, `LEGACY_NAMESPACES`) and layout validation sets are also defined here.
- **`tools/lib/bundle-runtime.js`** — loads and executes the bundled override script in a VM context; provides template config loading, example config generation, and YAML serialization.

### Override script (`scripts/override/main.js`)

Entry point: `function main(config)` — receives a Mihomo config object with `proxies` populated, returns the fully configured object. Pipeline:

1. **`applyRuntimePreset(config)`** — merges all runtime YAML presets (DNS, sniffer, tun, geodata, profile, base) onto config
2. **`buildProxyGroups(proxies, groupDefinitions)`** — creates proxy-groups from `groupDefinitions.yaml`, with region patterns loaded from `regions.yaml` and placeholder mappings from `placeholders.yaml`
3. **`assembleRuleSet(groupDefinitions, ruleProviders, inlineRules)`** — prepends inline rules, maps each rule provider to its target group, then appends fallback `MATCH`
4. **`validateOutput(config)`** — post-assembly validation (uses `extractRuleTarget` from rule-assembly for consistent rule parsing)

Shared modules live in `scripts/override/lib/`:
- **`utils.js`** — shared utilities (`cloneData`)
- **`proxy-groups.js`** — region detection, proxy classification, group building. Region patterns and placeholder mappings are loaded from compiled YAML products (`scripts/config/runtime/regions.js`, `scripts/config/runtime/placeholders.js`), not hardcoded.
- **`rule-assembly.js`** — rule set assembly, exports `assembleRuleSet` and `extractRuleTarget`
- **`runtime-preset.js`** — runtime preset application
- **`validate-output.js`** — output validation

### Data model

- **`definitions/`** is the single source of truth for all declarative config. Never hand-edit `scripts/config/` — it is generated.
- `definitions/rules/registry/` is the active ruleset assembly entrypoint for group definitions, inline rules, and rule providers.
- `definitions/rules/custom/` contains template/asset files copied verbatim to dist — they are NOT part of the active ruleset assembly.
- `definitions/runtime/regions.yaml` defines region matching patterns (id, name, icon, regex pattern, flags). To add a new region, add an entry here — no JS code change needed.
- `definitions/runtime/placeholders.yaml` defines reserved group IDs, fallback group ID, and `@`-prefix placeholder mappings. To add a new placeholder, add an entry here — no JS code change needed.
- The build rejects coexistence of `definitions/` and a legacy `rules/` directory.
- Verification scripts (`verify-main.js`, `verify-yaml-migration.js`) dynamically scan `definitions/` to discover expected outputs — adding new YAML files requires no changes to verification code.

### CI/CD

Push to `main` → GitHub Actions builds, verifies, deploys `dist/` to the `dist` branch, and purges jsdelivr CDN cache.

## Key Conventions

- ESM throughout (`"type": "module"` in package.json), target ES2020 for the bundle.
- The override script uses ES2018 features (negative lookbehind) — compatible with V8/Node but not JavaScriptCore (iOS).
- Rule providers reference remote rule-set URLs; group definitions declare proxy-group structure. Both are YAML-declared, JS-generated.
- Runtime preset YAML files map 1:1 to Mihomo top-level config keys (dns, sniffer, tun, etc.).
- All path constants are centralized in `tools/lib/paths.js`. Do not hardcode paths in tool scripts.
- Filesystem utilities are shared via `tools/lib/fs-helpers.js`. Do not duplicate `pathExists`/`copyDirectory` etc. in individual scripts.
- Design document is at `docs/DESIGN.md`.
