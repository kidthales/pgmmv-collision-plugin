# PGMMV Collision Plugin

[![CI](https://github.com/kidthales/pgmmv-collision-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/kidthales/pgmmv-collision-plugin/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/kidthales/pgmmv-collision-plugin.svg)](https://github.com/kidthales/pgmmv-collision-plugin/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![ES5 / PGMMV 1.0.6+](https://img.shields.io/badge/ES5-PGMMV%201.0.6%2B-brightgreen.svg)](https://rpgmakerofficial.com/product/act/en/manual/01_01.html)

Utilities for working with [Pixel Game Maker MV (PGMMV)](https://rpgmakerofficial.com/product/act/en/manual/01_01.html) 2D object collisions, providing platformer-ready Link Conditions and a `window.kt.collision` runtime script API.

## Installation (PGMMV Editor)

1. Download the latest `pgmmv-collision-plugin-v<version>.js` asset (and optionally verify it against `SHA256SUMS.txt`) from [GitHub Releases](https://github.com/kidthales/pgmmv-collision-plugin/releases).
    - Alternatively, build the stripped release bundle locally from source with `npm run build` (outputs `dist/pgmmv-collision-plugin-v0.2.0.js`).
2. In PGMMV, open **Plugins** -> **Add** and select the downloaded `.js` file.
3. Enable the plugin in your project's plugin list.

> Compatible with **PGMMV 1.0.6+** (SpiderMonkey 33 / ECMAScript 5.1).

## Link Conditions

All three Link Conditions appear under the object transition **Link Condition** menu in PGMMV:

### `On Wall or Slope [PGMMV Collision Plugin]`

Tests whether the object instance's bottom wall collision (`WallBottom`) is touching a tile wall in the selected tile group, **or** the object instance is touching a slope from the top (`DirectionUpper`).

| Parameter                    | Type                     | Default      | Description                                                                                            |
| :--------------------------- | :----------------------- | :----------- | :----------------------------------------------------------------------------------------------------- |
| `Tile Group Variable Source` | `SwitchVariableObjectId` | `-1` (Unset) | Variable source (`ProjectCommon`, `SelfObject`, or `ParentObject`) holding the tile group ID variable. |
| `Tile Group`                 | `VariableId`             | `-1` (Unset) | Variable whose value specifies the target tile group ID.                                               |

Leaving either `Tile Group Variable Source` or `Tile Group` unset (or a variable ID `< 1`) falls back to `Agtk.constants.tileGroup.TileGroupDefault` (`0`).

### `On Slope Facing Downslope [PGMMV Collision Plugin]`

Tests whether the object instance is touching a slope from the top (`DirectionUpper`) while its `DisplayDirection` faces downslope:

- Facing left (`DisplayDirection === 270`) on a left-downward slope (`DownwardLeft`), or
- Facing right (`DisplayDirection === 90`) on a right-downward slope (`DownwardRight`).

This Link Condition has no parameters.

### `On Slope Facing Upslope [PGMMV Collision Plugin]`

Tests whether the object instance is touching a slope from the top (`DirectionUpper`) while its `DisplayDirection` faces upslope:

- Facing left (`DisplayDirection === 270`) on a right-downward slope (`DownwardRight`), or
- Facing right (`DisplayDirection === 90`) on a left-downward slope (`DownwardLeft`).

This Link Condition has no parameters.

## Script API (`window.kt.collision`)

Outside the PGMMV editor, `initialize()` registers the collision helper functions on `window.kt.collision`:

- `window.kt.collision.onTileWallOrSlope(variableObjectId, tileGroupVariableId, instanceId)` -> `boolean`
    - `variableObjectId`: `Agtk.constants.switchVariableObjects.ProjectCommon` (`0`), `SelfObject` (`-2`), `ParentObject` (`-7`), or `Agtk.constants.actionCommands.UnsetObject` (`-1`).
    - `tileGroupVariableId`: Variable ID containing the tile group ID (values `< 1` or an unset `variableObjectId` fall back to `Agtk.constants.tileGroup.TileGroupDefault`).
    - `instanceId`: Target object instance ID.
- `window.kt.collision.onSlopeFacingDownslope(instanceId)` -> `boolean`
- `window.kt.collision.onSlopeFacingUpslope(instanceId)` -> `boolean`

Example (ES5 inside a PGMMV **Execute Script** condition or action):

```js
var grounded = window.kt.collision.onTileWallOrSlope(Agtk.constants.actionCommands.UnsetObject, -1, instanceId);
var goingDownhill = window.kt.collision.onSlopeFacingDownslope(instanceId);
var goingUphill = window.kt.collision.onSlopeFacingUpslope(instanceId);
```

## Development

### Requirements

- Any current [Node.js](https://nodejs.org/en/download) LTS (Long-Term Support) version.
- A [Git](https://git-scm.com/) client.

### Setup

```bash
git clone https://github.com/kidthales/pgmmv-collision-plugin.git
cd pgmmv-collision-plugin
npm install
```

### SpiderMonkey 33 & ES5 Constraints

PGMMV embeds **SpiderMonkey 33**, which executes plugins in an [ECMAScript 5.1](https://262.ecma-international.org/5.1/) script environment. `eslint.config.js` enforces `ecmaVersion: 5` and `sourceType: 'script'` on `plugin.js` with `Agtk`, `cc`, and `jsb` declared as read-only globals, while `tsconfig.json` runs strict JSDoc type-checking against `@kidthales/pgmmv-types` without emitting ES6+ syntax.

### Scripts Reference

| Script             | Command                                                | Purpose                                                                                                                                                                                                                            |
| :----------------- | :----------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`     | `eslint --cache .`, `prettier --check`, `tsc --noEmit` | Verify ES5 compliance (`plugin.js`), ESM syntax (`scripts/**/*.mjs`, `tests/**/*.mjs`), Markdown/JSON/YAML formatting, and strict JSDoc types.                                                                                     |
| `npm run lint-fix` | `eslint --cache --fix .`, `prettier --write`           | Auto-fix ESLint and Prettier formatting issues across source and documentation files.                                                                                                                                              |
| `npm test`         | `node --test`                                          | Run `tests/plugin.test.mjs` covering `plugin.js` hooks, editor-mode guards, all 3 Link Conditions, `window.kt.collision`, `scripts/build.mjs` path-containment and comment-stripping invariants, and negative ESLint/`tsc` checks. |
| `npm run build`    | `node scripts/build.mjs`                               | Strip non-banner comments from `plugin.js`, format with Prettier, and emit `dist/pgmmv-collision-plugin-v<version>.js` (accepts an optional output path strictly inside `dist/`).                                                  |

## References & License

- [Changelog](./CHANGELOG.md)
- [MIT License](./LICENSE)
- [@kidthales/pgmmv-types](https://github.com/kidthales/pgmmv-types)
- [PGMMV Plug-in Specifications](https://rpgmakerofficial.com/product/act/en/manual/Plug-in_Spec_en.pdf)
