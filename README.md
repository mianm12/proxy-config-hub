# proxy-config-hub

Unified repository for a minimal runnable Mihomo override bundle plus declarative YAML source trees.

## Local Usage

```bash
npm run build
npm run example:config
npm run verify
```

Available scripts:

- `npm run rules:build`
  Converts declarative YAML under `definitions/` into JS modules under `scripts/config/`.
  The script name is kept for compatibility even though it now handles both `rules` and `runtime`.
- `npm run build`
  Runs `rules:build`, bundles [scripts/override/main.js](/Users/ghstlnx/Workspace/proxy-config-hub/scripts/override/main.js) to [dist/scripts/override/main.js](/Users/ghstlnx/Workspace/proxy-config-hub/dist/scripts/override/main.js), and copies custom rule assets from `definitions/rules/custom/` to `dist/rules/custom/`.
- `npm run example:config`
  Builds the project and writes a previewable YAML config to [dist/example-full-config.yaml](/Users/ghstlnx/Workspace/proxy-config-hub/dist/example-full-config.yaml). You can also pass an explicit output path or `-` for stdout with `npm run example:config -- <target>`.
- `npm run verify`
  Runs the bundle verification and YAML migration verification suites.

## Repository Layout

```text
definitions/
  rules/
    registry/   Canonical rule registry YAML used for JS generation
    custom/     Custom rule templates/assets copied to dist, not loaded as active rules
  runtime/      Canonical runtime preset YAML used for JS generation

scripts/
  config/
    rules/      Generated JS modules from definitions/rules/registry/
    runtime/    Generated JS modules from definitions/runtime/
  override/
    main.js     Single Mihomo override entrypoint
    lib/        Runtime preset, proxy-group, rule assembly, and validation helpers

dist/
  scripts/
    override/
      main.js   Self-contained IIFE bundle exposing globalThis.main
  rules/
    custom/     Copied custom rule assets

templates/
  mihomo/       Sanitized example output and reference fixtures

tools/
  yaml-to-js.js           YAML source compiler
  verify-main.js          Bundle/runtime verification
  verify-yaml-migration.js  Legacy rules/ compatibility verification
```

## Source Model

- `definitions/` is the only canonical YAML source tree.
- `scripts/config/` is generated output and should not be edited by hand.
- `definitions/rules/custom/` is a template/published-asset subtree. It is not part of the active rule registry and is never converted into `scripts/config/**`.
- `rules/` is a migration-only legacy concept. The build tooling will reject mixed `rules/` + `definitions/` source trees.

## Notes

- Package manager: `npm`
- Node.js: `>=20`
- Module default: ESM (`"type": "module"` in [package.json](/Users/ghstlnx/Workspace/proxy-config-hub/package.json))
- The built bundle targets Mihomo-style script execution and exposes `main(config)` via `globalThis.main`

## Documentation

- Design notes and historical context: [DESIGN.md](/Users/ghstlnx/Workspace/proxy-config-hub/DESIGN.md)
- Sanitized Mihomo example config: [templates/mihomo/config-example.yaml](/Users/ghstlnx/Workspace/proxy-config-hub/templates/mihomo/config-example.yaml)
