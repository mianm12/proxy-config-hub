# proxy-config-hub

Unified repository for Mihomo overrides, experimental Sub-Store scripts, and reusable rule assets.

## Local Usage

```bash
npm run validate
npm run build
npm run smoke
npm run smoke -- --emit-example-config
```

`npm run build` bundles the override sources in `scripts/override/` into self-contained files under `dist/scripts/override/` and copies local custom rule assets into `dist/rules/`.

`npm run smoke -- --emit-example-config` will run the smoke checks and also generate a full YAML config from the built-in sample proxies at `dist/example-full-config.yaml`.

If you want the generated config on stdout instead of a file:

```bash
npm run smoke -- --emit-example-config -
```

Repository-hosted custom rule assets are currently wired to `https://cdn.jsdelivr.net/gh/ghstlnx/proxy-config-hub@dist/...`. If you publish this repository under a different owner or repo name, update the custom entries in `rules/sources.yaml` before using the generated override bundles.

## Repository Layout

```text
scripts/
  _lib/        Shared source modules for override bundling
  override/    Mihomo-first override script sources
rules/
  custom/      Custom rules maintained in this repository
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

The repository now includes a minimal runnable Mihomo baseline: shared override libraries, three bundled override entries, local rule assets, a schema validator, and smoke tests for the generated dist artifacts.
