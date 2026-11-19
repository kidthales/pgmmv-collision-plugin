# Changelog

All notable changes to `@kidthales/pgmmv-collision-plugin` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-18

Modernizes `@kidthales/pgmmv-collision-plugin` for PGMMV's SpiderMonkey 33 (ES5.1) runtime with strict `@kidthales/pgmmv-types` JSDoc checking, a canonical `scripts/build.mjs` release bundler, a `node:test` verification suite, CI/publish workflow parity, and self-contained documentation.

### Added

- **Canonical release bundler (`scripts/build.mjs`, `npm run build`) (`#61`, `#64`, `#65`)**: Added `buildPlugin`, `stripComments`, `assertSafeOutputPath`, and `resolveRealPath` to emit Prettier-formatted `dist/pgmmv-collision-plugin-v<version>.js` bundles while preserving `/**!` / `/*!` license banners, enforcing `fs.realpathSync` self-overwrite and `dist/` containment guards, preserving ES5.1 §7.3 `LineTerminator` boundaries, and rescanning template literal braces.
- **Automated `node:test` suite (`tests/plugin.test.mjs`, `npm test`) (`#65`)**: Added 20 tests covering `plugin.js` metadata/hooks, editor-mode guards, `window.kt.collision` runtime registration, all 3 collision Link Conditions (`On Wall or Slope`, `On Slope Facing Downslope`, `On Slope Facing Upslope`), `scripts/build.mjs` symlink/containment/scanner edge cases, ESLint ES5 enforcement, and `tsc --noEmit` negative type checks.
- **Release publishing workflow (`.github/workflows/publish.yml`) (`#61`, `#64`, `#65`)**: Added tag-triggered release validation verifying `RELEASE_TAG == "v" + package.json.version == plugin.js @version`, running `npm run lint && npm test`, and uploading the stripped `.js` bundle alongside `SHA256SUMS.txt`.
- **Self-contained documentation (`README.md`, `CHANGELOG.md`) (`#65`)**: Removed the nonexistent `kidthales.com/pgmmv/collision-plugin/` link and documented standardized badges, GitHub Releases `.js` installation, all 3 Link Conditions and parameters, the `window.kt.collision` script API, npm scripts, and this Keep-a-Changelog history.

### Changed

- **Strict `@kidthales/pgmmv-types` JSDoc typing (`tsconfig.json`, `env.d.ts`, `plugin.js`) (`#61`, `#65`)**: Upgraded to `@kidthales/pgmmv-types@^0.2.1`, declared `Window.kt` in `env.d.ts`, enabled `allowJs`/`checkJs`/`strict`/`noEmit`, and narrowed `plugin.js` types cleanly with a preserved `/**!` `@version 0.2.0` header banner.
- **Toolchain, CI, ignore & Dependabot parity (`package.json`, `eslint.config.js`, `.prettierignore`, `.gitignore`, `.github/workflows/ci.yml`, `.github/dependabot.yml`) (`#61`, `#64`, `#65`)**: Updated `devDependencies` (ESLint 9, Prettier 3, TypeScript 7, `concurrently` 10), ignored `.ci-local` and `**/.tmp-*/**`, wired `npm test` and `npm run build` into CI with least-privilege `contents: read` permissions, and configured quarterly non-major Dependabot updates.

### Fixed

- **Editor-mode guard & parameter normalization (`plugin.js`) (`#61`)**: Guarded `window.kt.collision` registration against PGMMV editor-mode evaluation (`isEditor()`) and normalized `execLinkCondition` parameter lookups against declared parameter defaults.

## [0.1.0] - 2026-04-03

Initial release of `@kidthales/pgmmv-collision-plugin`.

### Added

- **`On Wall or Slope [PGMMV Collision Plugin]` Link Condition**: Checks bottom wall collision against a configurable tile group (falling back to `TileGroupDefault`) or upper slope collision.
- **`On Slope Facing Downslope [PGMMV Collision Plugin]` and `On Slope Facing Upslope [PGMMV Collision Plugin]` Link Conditions**: Checks upper slope contact relative to `DisplayDirection`.
- **`window.kt.collision` script API**: Exposes `onTileWallOrSlope`, `onSlopeFacingDownslope`, and `onSlopeFacingUpslope` for PGMMV Execute Script calls.
