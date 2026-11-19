import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { assertSafeOutputPath, buildPlugin, resolveRealPath, stripComments } from '../scripts/build.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const pluginPath = path.join(ROOT, 'plugin.js');
const pluginSource = fs.readFileSync(pluginPath, 'utf8');
const buildScript = path.join(ROOT, 'scripts', 'build.mjs');
const eslintBin = path.join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');
const tscBin = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

const AGTK_CONSTANTS = {
  switchVariableObjects: {
    ProjectCommon: 0,
    SelfObject: -2,
    ParentObject: -7
  },
  actionCommands: {
    UnsetObject: -1
  },
  tileGroup: {
    TileGroupDefault: 0
  },
  tile: {
    WallBottom: 8
  },
  linkCondition: {
    slopeTouched: {
      DirectionUpper: 1,
      DownwardNone: 0,
      DownwardLeft: 1,
      DownwardRight: 2
    }
  },
  objects: {
    variables: {
      DisplayDirectionId: 3,
      ParentObjectInstanceIDId: 14
    }
  }
};

function loadPlugin(context = {}) {
  return vm.runInNewContext(pluginSource, context, { filename: 'plugin.js' });
}

function createMockAgtk({ projectVariables = {}, instances = {} } = {}) {
  const wallCalls = [];
  const slopeCalls = [];

  function makeVariableStore(vars = {}) {
    return {
      get(id) {
        if (!(id in vars) || vars[id] === null || vars[id] === undefined) {
          return null;
        }
        return {
          getValue() {
            return vars[id];
          }
        };
      }
    };
  }

  const Agtk = {
    constants: AGTK_CONSTANTS,
    log() {},
    variables: makeVariableStore(projectVariables),
    objectInstances: {
      get(instanceId) {
        const spec = instances[instanceId];
        if (!spec) {
          throw new Error(`Unexpected object instance lookup: ${instanceId}`);
        }
        return {
          variables: makeVariableStore(spec.variables),
          isWallTouched(opts) {
            wallCalls.push({ instanceId, ...opts });
            return typeof spec.isWallTouched === 'function' ? spec.isWallTouched(opts) : Boolean(spec.wallTouched);
          },
          isSlopeTouched(opts) {
            slopeCalls.push({ instanceId, ...opts });
            return typeof spec.isSlopeTouched === 'function' ? spec.isSlopeTouched(opts) : Boolean(spec.slopeTouched);
          }
        };
      }
    }
  };

  return { Agtk, wallCalls, slopeCalls };
}

test('plugin.js evaluates to an object exposing all PGMMV plugin hooks', () => {
  const plugin = loadPlugin({});
  assert.equal(typeof plugin, 'object');
  assert.notEqual(plugin, null);

  for (const method of [
    'setLocale',
    'getInfo',
    'initialize',
    'finalize',
    'setParamValue',
    'setInternal',
    'call',
    'execLinkCondition'
  ]) {
    assert.equal(typeof plugin[method], 'function', `Expected ${method} to be a function`);
  }
});

test('getInfo returns expected metadata and linkCondition schemas for all categories', () => {
  const plugin = loadPlugin({});

  assert.equal(plugin.getInfo('name'), 'PGMMV Collision Plugin');
  assert.equal(plugin.getInfo('description'), 'Utilities for working with object collisions.');
  assert.equal(plugin.getInfo('author'), 'Tristan Bonsor <kidthales@agogpixel.com>');
  assert.equal(
    plugin.getInfo('help'),
    'This plugin provides utilities for working with 2D collisions. Currently limited\nto link conditions suitable for platformers.'
  );
  assert.deepEqual(JSON.parse(JSON.stringify(plugin.getInfo('parameter'))), []);
  assert.equal(plugin.getInfo('internal'), null);
  assert.deepEqual(JSON.parse(JSON.stringify(plugin.getInfo('actionCommand'))), []);
  assert.equal(plugin.getInfo('invalid'), undefined);
  assert.equal(plugin.getInfo(''), undefined);

  const linkConditions = JSON.parse(JSON.stringify(plugin.getInfo('linkCondition')));
  assert.deepEqual(linkConditions, [
    {
      id: 0,
      name: 'On Wall or Slope [PGMMV Collision Plugin]',
      description:
        'Test if object instance bottom wall collision is touching a tile wall or object instance is touching a slope from the top. Leaving the tile group inputs unset will use the default tile group.',
      parameter: [
        {
          id: 100,
          name: 'Tile Group Variable Source',
          type: 'SwitchVariableObjectId',
          option: ['SelfObject', 'ParentObject'],
          defaultValue: -1
        },
        {
          id: 0,
          name: 'Tile Group',
          type: 'VariableId',
          referenceId: 100,
          withNewButton: true,
          defaultValue: -1
        }
      ]
    },
    {
      id: 1,
      name: 'On Slope Facing Downslope [PGMMV Collision Plugin]',
      description: 'Test if object instance is touching a slope from the top and facing downslope.',
      parameter: []
    },
    {
      id: 2,
      name: 'On Slope Facing Upslope [PGMMV Collision Plugin]',
      description: 'Test if object instance is touching a slope from the top and facing upslope.',
      parameter: []
    }
  ]);
});

test('no-op hooks complete without throwing', () => {
  const plugin = loadPlugin({});

  assert.doesNotThrow(() => {
    plugin.setLocale('en');
    plugin.setParamValue([]);
    plugin.setInternal(null);
    plugin.call();
    plugin.finalize();
  });
});

test('initialize skips registering window.kt.collision in editor mode', () => {
  for (const agtkCandidate of [null, undefined, {}, { log: 'not-a-function' }]) {
    const windowObj = {};
    const plugin = loadPlugin({ Agtk: agtkCandidate, window: windowObj });
    assert.doesNotThrow(() => {
      plugin.initialize();
    });
    assert.equal('kt' in windowObj, false);
  }
});

test('initialize registers window.kt.collision outside editor and preserves existing window.kt keys', () => {
  const { Agtk } = createMockAgtk();
  const freshWindow = {};
  const pluginFresh = loadPlugin({ Agtk, window: freshWindow });
  pluginFresh.initialize();

  assert.equal(typeof freshWindow.kt, 'object');
  assert.equal(typeof freshWindow.kt.collision, 'object');
  assert.equal(typeof freshWindow.kt.collision.onTileWallOrSlope, 'function');
  assert.equal(typeof freshWindow.kt.collision.onSlopeFacingDownslope, 'function');
  assert.equal(typeof freshWindow.kt.collision.onSlopeFacingUpslope, 'function');

  const existingWindow = { kt: { otherPlugin: { ready: true } } };
  const pluginExisting = loadPlugin({ Agtk, window: existingWindow });
  pluginExisting.initialize();

  assert.deepEqual(existingWindow.kt.otherPlugin, { ready: true });
  assert.equal(typeof existingWindow.kt.collision.onTileWallOrSlope, 'function');
});

test('On Wall or Slope checks WallBottom with resolved tile group or slope fallback', () => {
  const { ProjectCommon, SelfObject, ParentObject } = AGTK_CONSTANTS.switchVariableObjects;
  const { UnsetObject } = AGTK_CONSTANTS.actionCommands;
  const { TileGroupDefault } = AGTK_CONSTANTS.tileGroup;
  const { WallBottom } = AGTK_CONSTANTS.tile;
  const { DirectionUpper, DownwardNone } = AGTK_CONSTANTS.linkCondition.slopeTouched;
  const { ParentObjectInstanceIDId } = AGTK_CONSTANTS.objects.variables;

  const { Agtk, wallCalls, slopeCalls } = createMockAgtk({
    projectVariables: { 5: 12 },
    instances: {
      1: {
        variables: { 7: 34, [ParentObjectInstanceIDId]: 2 },
        isWallTouched: ({ tileGroup }) => tileGroup === 12 || tileGroup === 56,
        slopeTouched: false
      },
      2: {
        variables: { 9: 56 },
        wallTouched: false,
        slopeTouched: true
      },
      3: {
        variables: { [ParentObjectInstanceIDId]: UnsetObject },
        wallTouched: false,
        slopeTouched: false
      }
    }
  });
  const windowObj = {};
  const plugin = loadPlugin({ Agtk, window: windowObj });
  plugin.initialize();

  // ProjectCommon variable source resolves project tile group 12 and short-circuits slope check
  assert.equal(
    plugin.execLinkCondition(
      0,
      [
        { id: 100, value: ProjectCommon },
        { id: 0, value: 5 }
      ],
      10,
      1
    ),
    true
  );
  assert.deepEqual(wallCalls.at(-1), {
    instanceId: 1,
    wallBit: WallBottom,
    useTileGroup: true,
    tileGroup: 12
  });
  assert.equal(slopeCalls.length, 0);

  // SelfObject variable source resolves instance 1 variable 7 -> tileGroup 34 (wall false -> checks slope)
  assert.equal(
    plugin.execLinkCondition(
      0,
      [
        { id: 100, value: SelfObject },
        { id: 0, value: 7 }
      ],
      10,
      1
    ),
    false
  );
  assert.deepEqual(wallCalls.at(-1), {
    instanceId: 1,
    wallBit: WallBottom,
    useTileGroup: true,
    tileGroup: 34
  });
  assert.deepEqual(slopeCalls.at(-1), {
    instanceId: 1,
    directionType: DirectionUpper,
    downwardType: DownwardNone
  });

  // ParentObject variable source resolves parent instance 2 variable 9 -> tileGroup 56
  assert.equal(
    plugin.execLinkCondition(
      0,
      [
        { id: 100, value: ParentObject },
        { id: 0, value: 9 }
      ],
      10,
      1
    ),
    true
  );
  assert.deepEqual(wallCalls.at(-1), {
    instanceId: 1,
    wallBit: WallBottom,
    useTileGroup: true,
    tileGroup: 56
  });

  // Wall false + slope true on instance 2 returns true
  assert.equal(plugin.execLinkCondition(0, [], 10, 2), true);
  assert.deepEqual(slopeCalls.at(-1), {
    instanceId: 2,
    directionType: DirectionUpper,
    downwardType: DownwardNone
  });

  // Missing ParentObject, unset params, invalid voId/varId, and missing variable fall back to TileGroupDefault
  for (const [params, instId] of [
    [[], 3],
    [
      [
        { id: 100, value: ParentObject },
        { id: 0, value: 9 }
      ],
      3
    ],
    [
      [
        { id: 100, value: 999 },
        { id: 0, value: 'bad' }
      ],
      3
    ],
    [
      [
        { id: 100, value: ProjectCommon },
        { id: 0, value: 0 }
      ],
      3
    ],
    [
      [
        { id: 100, value: SelfObject },
        { id: 0, value: 999 }
      ],
      3
    ]
  ]) {
    assert.equal(plugin.execLinkCondition(0, params, 10, instId), false);
    assert.equal(wallCalls.at(-1).tileGroup, TileGroupDefault);
  }

  // Runtime script API parity via window.kt.collision.onTileWallOrSlope
  assert.equal(windowObj.kt.collision.onTileWallOrSlope(ProjectCommon, 5, 1), true);
  assert.equal(windowObj.kt.collision.onTileWallOrSlope(UnsetObject, -1, 2), true);
  assert.equal(windowObj.kt.collision.onTileWallOrSlope(UnsetObject, -1, 3), false);
});

test('On Slope Facing Downslope matches direction 270->DownwardLeft and 90->DownwardRight', () => {
  const { DirectionUpper, DownwardLeft, DownwardRight } = AGTK_CONSTANTS.linkCondition.slopeTouched;
  const { DisplayDirectionId } = AGTK_CONSTANTS.objects.variables;

  const { Agtk, slopeCalls } = createMockAgtk({
    instances: {
      1: {
        variables: { [DisplayDirectionId]: 270 },
        isSlopeTouched: ({ directionType, downwardType }) =>
          directionType === DirectionUpper && downwardType === DownwardLeft
      },
      2: {
        variables: { [DisplayDirectionId]: 90 },
        isSlopeTouched: ({ directionType, downwardType }) =>
          directionType === DirectionUpper && downwardType === DownwardRight
      },
      3: {
        variables: { [DisplayDirectionId]: 270 },
        isSlopeTouched: ({ downwardType }) => downwardType === DownwardRight
      },
      4: {
        variables: { [DisplayDirectionId]: 180 },
        slopeTouched: true
      }
    }
  });
  const windowObj = {};
  const plugin = loadPlugin({ Agtk, window: windowObj });
  plugin.initialize();

  assert.equal(plugin.execLinkCondition(1, [], 10, 1), true);
  assert.deepEqual(slopeCalls.at(-1), {
    instanceId: 1,
    directionType: DirectionUpper,
    downwardType: DownwardLeft
  });

  assert.equal(plugin.execLinkCondition(1, [], 10, 2), true);
  assert.deepEqual(slopeCalls.at(-1), {
    instanceId: 2,
    directionType: DirectionUpper,
    downwardType: DownwardRight
  });

  assert.equal(plugin.execLinkCondition(1, [], 10, 3), false);
  const countBeforeNonHorizontal = slopeCalls.length;
  assert.equal(plugin.execLinkCondition(1, [], 10, 4), false);
  assert.equal(slopeCalls.length, countBeforeNonHorizontal);

  // Runtime script API parity
  assert.equal(windowObj.kt.collision.onSlopeFacingDownslope(1), true);
  assert.equal(windowObj.kt.collision.onSlopeFacingDownslope(2), true);
  assert.equal(windowObj.kt.collision.onSlopeFacingDownslope(3), false);
});

test('On Slope Facing Upslope matches direction 270->DownwardRight and 90->DownwardLeft', () => {
  const { DirectionUpper, DownwardLeft, DownwardRight } = AGTK_CONSTANTS.linkCondition.slopeTouched;
  const { DisplayDirectionId } = AGTK_CONSTANTS.objects.variables;

  const { Agtk, slopeCalls } = createMockAgtk({
    instances: {
      1: {
        variables: { [DisplayDirectionId]: 270 },
        isSlopeTouched: ({ directionType, downwardType }) =>
          directionType === DirectionUpper && downwardType === DownwardRight
      },
      2: {
        variables: { [DisplayDirectionId]: 90 },
        isSlopeTouched: ({ directionType, downwardType }) =>
          directionType === DirectionUpper && downwardType === DownwardLeft
      },
      3: {
        variables: { [DisplayDirectionId]: 90 },
        isSlopeTouched: ({ downwardType }) => downwardType === DownwardRight
      },
      4: {
        variables: { [DisplayDirectionId]: 0 },
        slopeTouched: true
      }
    }
  });
  const windowObj = {};
  const plugin = loadPlugin({ Agtk, window: windowObj });
  plugin.initialize();

  assert.equal(plugin.execLinkCondition(2, [], 10, 1), true);
  assert.deepEqual(slopeCalls.at(-1), {
    instanceId: 1,
    directionType: DirectionUpper,
    downwardType: DownwardRight
  });

  assert.equal(plugin.execLinkCondition(2, [], 10, 2), true);
  assert.deepEqual(slopeCalls.at(-1), {
    instanceId: 2,
    directionType: DirectionUpper,
    downwardType: DownwardLeft
  });

  assert.equal(plugin.execLinkCondition(2, [], 10, 3), false);
  const countBeforeNonHorizontal = slopeCalls.length;
  assert.equal(plugin.execLinkCondition(2, [], 10, 4), false);
  assert.equal(slopeCalls.length, countBeforeNonHorizontal);

  // Runtime script API parity
  assert.equal(windowObj.kt.collision.onSlopeFacingUpslope(1), true);
  assert.equal(windowObj.kt.collision.onSlopeFacingUpslope(2), true);
  assert.equal(windowObj.kt.collision.onSlopeFacingUpslope(3), false);
});

test('scripts/build.mjs builds plugin.js preserving /**! banner and stripping JSDoc/line comments', () => {
  const distDir = path.join(ROOT, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  const distTmpDir = fs.mkdtempSync(path.join(distDir, '.tmp-build-out-'));
  try {
    const outFile = path.join(distTmpDir, 'bundle.js');
    const result = spawnSync(process.execPath, [buildScript, outFile], {
      cwd: ROOT,
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const built = fs.readFileSync(outFile, 'utf8');
    assert.match(built, /^\/\*\*![\s\S]*@version 0\.2\.0[\s\S]*\*\//);
    assert.doesNotMatch(built, /\/\/\/ <reference/);
    assert.doesNotMatch(built, /noinspection/);
    assert.doesNotMatch(built, /@param/);

    const { Agtk } = createMockAgtk({
      instances: {
        1: {
          variables: {},
          wallTouched: true,
          slopeTouched: false
        }
      }
    });
    const windowObj = {};
    const plugin = vm.runInNewContext(built, { Agtk, window: windowObj }, { filename: 'bundle.js' });
    plugin.initialize();
    assert.equal(plugin.getInfo('name'), 'PGMMV Collision Plugin');
    assert.equal(plugin.execLinkCondition(0, [], 1, 1), true);
    assert.equal(typeof windowObj.kt.collision.onTileWallOrSlope, 'function');
  } finally {
    fs.rmSync(distTmpDir, { recursive: true, force: true });
  }
});

test('buildPlugin emits default unscoped dist filename from package.json metadata', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pgmmv-build-fixture-'));
  try {
    fs.writeFileSync(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({ name: '@kidthales/sample-plugin', version: '1.2.3' }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tempRoot, 'plugin.js'),
      '/**!\n * @license MIT\n */\n// strip me\n(function () { return {}; })();\n',
      'utf8'
    );

    const outPath = await buildPlugin({ rootDir: tempRoot, cwd: tempRoot });
    assert.equal(path.basename(outPath), 'sample-plugin-v1.2.3.js');
    assert.equal(path.dirname(outPath), path.join(tempRoot, 'dist'));

    const built = fs.readFileSync(outPath, 'utf8');
    assert.match(built, /@license MIT/);
    assert.doesNotMatch(built, /strip me/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('scripts/build.mjs enforces self-overwrite and dist/ containment guards including symlinks', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pgmmv-build-guards-'));
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pgmmv-build-outside-'));
  try {
    const inputPath = path.join(tempRoot, 'plugin.js');
    const distDir = path.join(tempRoot, 'dist');
    fs.writeFileSync(inputPath, 'var x = 1;\n', 'utf8');
    fs.mkdirSync(distDir, { recursive: true });

    for (const target of [inputPath, path.join(distDir, '..', 'plugin.js')]) {
      assert.throws(
        () => assertSafeOutputPath({ rootDir: tempRoot, inputPath, distDir, outputPath: target }),
        /Refusing to overwrite input file/
      );
    }

    for (const target of [
      distDir,
      path.join(distDir, '.'),
      path.join(tempRoot, 'outside.js'),
      path.join(outsideDir, 'escape.js'),
      path.join(distDir, '..', 'outside.js')
    ]) {
      assert.throws(
        () => assertSafeOutputPath({ rootDir: tempRoot, inputPath, distDir, outputPath: target }),
        /Refusing to write outside dist directory/
      );
    }

    const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
    const rootAliasInDist = path.join(distDir, 'root-alias');
    fs.symlinkSync(tempRoot, rootAliasInDist, symlinkType);
    assert.throws(
      () =>
        assertSafeOutputPath({
          rootDir: tempRoot,
          inputPath,
          distDir,
          outputPath: path.join(rootAliasInDist, 'plugin.js')
        }),
      /Refusing to overwrite input file/
    );

    const escapeLinkInDist = path.join(distDir, 'escape-link');
    fs.symlinkSync(outsideDir, escapeLinkInDist, symlinkType);
    assert.throws(
      () =>
        assertSafeOutputPath({
          rootDir: tempRoot,
          inputPath,
          distDir,
          outputPath: path.join(escapeLinkInDist, 'out.js')
        }),
      /Refusing to write outside dist directory/
    );

    const cliFail = spawnSync(process.execPath, [buildScript, '../outside.js'], {
      cwd: ROOT,
      encoding: 'utf8'
    });
    assert.notEqual(cliFail.status, 0);
    assert.match(cliFail.stderr + cliFail.stdout, /Refusing to write outside dist directory/);

    const danglingLink = path.join(distDir, 'dangling-dir');
    fs.symlinkSync(path.join(outsideDir, 'missing-target'), danglingLink, symlinkType);
    assert.throws(() => resolveRealPath(danglingLink), { code: 'ENOENT' });
    assert.throws(() => resolveRealPath(path.join(danglingLink, 'nested', 'out.js')), { code: 'ENOENT' });
    assert.throws(
      () =>
        assertSafeOutputPath({
          rootDir: tempRoot,
          inputPath,
          distDir,
          outputPath: path.join(danglingLink, 'out.js')
        }),
      { code: 'ENOENT' }
    );

    const symlinkDistRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pgmmv-build-symdist-'));
    try {
      const symDistInput = path.join(symlinkDistRoot, 'plugin.js');
      const symDistDir = path.join(symlinkDistRoot, 'dist');
      fs.writeFileSync(symDistInput, 'var x = 1;\n', 'utf8');
      fs.symlinkSync(outsideDir, symDistDir, symlinkType);

      assert.throws(
        () =>
          assertSafeOutputPath({
            rootDir: symlinkDistRoot,
            inputPath: symDistInput,
            distDir: symDistDir,
            outputPath: path.join(symDistDir, 'out.js')
          }),
        /Refusing to write through non-canonical dist directory/
      );
    } finally {
      fs.rmSync(symlinkDistRoot, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});

test('stripComments preserves ES5.1 §7.3 LineTerminator boundaries across CR, LS, and PS', () => {
  assert.equal(stripComments('return/*\r*/1;'), 'return\n1;');
  assert.equal(stripComments('return/*\u2028*/1;'), 'return\n1;');
  assert.equal(stripComments('return/*\u2029*/1;'), 'return\n1;');
  assert.equal(stripComments('var a/*inline*/=1;'), 'var a =1;');
  assert.equal(stripComments('var a = 1; // c\u2028var b = 2;'), 'var a = 1; \u2028var b = 2;');
  assert.equal(stripComments('var a = 1;\u2029'), 'var a = 1;\u2029');
});

test('stripComments rescans template literal braces and regex literals without stripping content', () => {
  const input = [
    'var a = `head ${ { k: 1 /* strip */ } } /* keep */ // keep`;',
    'var b = `m1 ${1} /* keep1 */ ${ `nested ${2} /* keep2 */` } // keep3`;',
    'var c = `div ${1}` / 2; // strip',
    'var r = /foo\\/\\*bar\\*\\/baz/g; /* strip */'
  ].join('\n');

  const output = stripComments(input);
  assert.match(output, /\/\* keep \*\/ \/\/ keep`/);
  assert.match(output, /\/\* keep1 \*\//);
  assert.match(output, /\/\* keep2 \*\//);
  assert.match(output, /\/\/ keep3`/);
  assert.match(output, /var c = `div \$\{1\}` \/ 2;/);
  assert.match(output, /var r = \/foo\\\/\\\*bar\\\*\\\/baz\/g;/);
  assert.doesNotMatch(output, /\/\* strip \*\//);
  assert.doesNotMatch(output, /\/\/ strip/);
});

test('stripComments and buildPlugin handle division after contextual/future-reserved identifiers and member keywords', async () => {
  const snippet = [
    '/**! @license MIT */',
    'var type = 10, out = 20, from = 4, set = 6, get = 8, of = 12, await = 14, yield = 16;',
    'var cfg = { default: 8, return: 10, await: 12 };',
    "var half = type / 2; // don't clip",
    "out /= 2; // don't break",
    "var mid = cfg.default / 2; // don't expose midpoint",
    "var opt = cfg?.return / 2; // don't break optional chaining",
    "var optAwait = cfg?.await / 2; // don't break member await",
    "var ratio = from / 2 + set / 2 + get / 2 + of / 2 + await / 2 + yield / 2; // don't leak",
    "var undef = undefined / 2; // don't break undefined",
    "for (var i = of / 2; i < 1; i++) {} // don't break for-init of"
  ].join('\n');

  const stripped = stripComments(snippet);
  assert.doesNotMatch(stripped, /don't/);
  assert.match(stripped, /var half = type \/ 2;/);
  assert.match(stripped, /out \/= 2;/);
  assert.match(stripped, /var mid = cfg\.default \/ 2;/);
  assert.match(stripped, /var opt = cfg\?\.return \/ 2;/);

  const es5BuildSnippet = [
    '/**! @license MIT */',
    'var type = 10, out = 20, from = 4, of = 12, await = 14, yield = 16;',
    'var cfg = { default: 8, return: 10 };',
    "var half = type / 2; // don't clip",
    "out /= 2; // don't break",
    "var mid = cfg.default / 2; // don't expose midpoint",
    "var ratio = from / 2 + of / 2 + await / 2 + yield / 2; // don't leak",
    "var ret = cfg.return / 2; // don't fail"
  ].join('\n');

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pgmmv-build-div-'));
  try {
    fs.writeFileSync(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({ name: '@kidthales/div-plugin', version: '0.2.0' }),
      'utf8'
    );
    fs.writeFileSync(path.join(tempRoot, 'plugin.js'), es5BuildSnippet, 'utf8');

    const outPath = await buildPlugin({ rootDir: tempRoot, cwd: tempRoot });
    const built = fs.readFileSync(outPath, 'utf8');
    assert.doesNotMatch(built, /don't/);
    assert.match(built, /type \/ 2/);
    assert.match(built, /out \/= 2/);
    assert.match(built, /cfg\.default \/ 2/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('stripComments still rescans regex literals after for-of, async await, and generator yield', () => {
  const input = [
    'for (var x of /a\\/\\*keep\\*\\//g) {} /* strip */',
    'async function f() { return await /b\\/\\*keep\\*\\//g; /* strip */ }',
    'const g = async (x) => await /c\\/\\*keep\\*\\//g; /* strip */',
    'function* gen() { yield /d\\/\\*keep\\*\\//g; /* strip */ }',
    'async function outer() {',
    '  function inner() {',
    '    var await = 10;',
    "    return await / 2; // don't leak",
    '  }',
    '  return inner() && (await /e\\/\\*keep\\*\\//g); /* strip */',
    '}'
  ].join('\n');

  const output = stripComments(input);
  assert.match(output, /\/a\\\/\\\*keep\\\*\\\/\/g/);
  assert.match(output, /\/b\\\/\\\*keep\\\*\\\/\/g/);
  assert.match(output, /\/c\\\/\\\*keep\\\*\\\/\/g/);
  assert.match(output, /\/d\\\/\\\*keep\\\*\\\/\/g/);
  assert.match(output, /\/e\\\/\\\*keep\\\*\\\/\/g/);
  assert.doesNotMatch(output, /\/\* strip \*\//);
  assert.doesNotMatch(output, /don't leak/);
});

test('stripComments and buildPlugin handle statement-header regexes, prefix/postfix ++/--, and expression braces', async () => {
  const input = [
    'if (cond) /[//]/.test(s);',
    'var x = 1;',
    'if (cond) /[/*]/.test(s) && /[*/]/.test(s);',
    'while (cond) /[//]/.test(s);',
    'for (var i = 0; i < 1; i++) /[/*]/.test(s) && /[*/]/.test(s);',
    'with (obj) /[//]/.test(s);',
    'var callDiv = obj.if(cond) / 2; /* strip */',
    'var optCallDiv = obj?.while(cond) / 2; /* strip */',
    'var n = ++/[//]/.lastIndex;',
    'var y = 1;',
    'var sum = ++/[/*]/.lastIndex + --/[*/]/.lastIndex;',
    'a',
    '++/[//]/.lastIndex;',
    'a /*',
    '*/ --/[//]/.lastIndex;',
    '{ foo(); } ++/[//]/.lastIndex;',
    'if (cond) ++/[//]/.lastIndex;',
    'var postA = a++ / 2; /* strip */',
    'var postB = arr[i]-- / 2; /* strip */',
    'var postC = obj.default++ / 2; /* strip */',
    'var objDiv = { a: 1 } / 2; /* strip */',
    'var fnDiv = function () {} / 2; /* strip */',
    'var asyncFnDiv = async function () {} / 2; /* strip */',
    'var clsDiv = class {} / 2; /* strip */',
    'var ternDiv = cond ? { a: 1 } : { b: 2 } / 2; /* strip */',
    'var nestedObjDiv = { a: { b: 1 } / 2 }; /* strip */',
    'if (cond) { foo(); } /[//]/.test(s);',
    'function decl() {} /[/*]/.test(s) && /[*/]/.test(s);',
    'class Decl {} /[//]/.test(s);',
    'lbl: { foo(); } /[//]/.test(s);',
    'switch (v) { case 1: { foo(); } /[//]/.test(s); }',
    'const arrowBlock = () => {}',
    '/[//]/.test(s);'
  ].join('\n');

  const output = stripComments(input);
  assert.doesNotMatch(output, /\/\* strip \*\//);
  assert.match(output, /if \(cond\) \/\[\/\/\]\/\.test\(s\);/);
  assert.match(output, /if \(cond\) \/\[\/\*\]\/\.test\(s\) && \/\[(\*\/)\]\/\.test\(s\);/);
  assert.match(output, /while \(cond\) \/\[\/\/\]\/\.test\(s\);/);
  assert.match(output, /for \(var i = 0; i < 1; i\+\+\) \/\[\/\*\]\/\.test\(s\) && \/\[(\*\/)\]\/\.test\(s\);/);
  assert.match(output, /with \(obj\) \/\[\/\/\]\/\.test\(s\);/);
  assert.match(output, /var n = \+\+\/\[\/\/\]\/\.lastIndex;/);
  assert.match(output, /var sum = \+\+\/\[\/\*\]\/\.lastIndex \+ --\/\[(\*\/)\]\/\.lastIndex;/);
  assert.match(output, /a\n\+\+\/\[\/\/\]\/\.lastIndex;/);
  assert.match(output, /--\/\[\/\/\]\/\.lastIndex;/);
  assert.match(output, /\{ foo\(\); \} \+\+\/\[\/\/\]\/\.lastIndex;/);
  assert.match(output, /if \(cond\) \+\+\/\[\/\/\]\/\.lastIndex;/);
  assert.match(output, /var objDiv = \{ a: 1 \} \/ 2;/);
  assert.match(output, /var fnDiv = function \(\) \{\} \/ 2;/);
  assert.match(output, /if \(cond\) \{ foo\(\); \} \/\[\/\/\]\/\.test\(s\);/);
  assert.match(output, /function decl\(\) \{\} \/\[\/\*\]\/\.test\(s\) && \/\[(\*\/)\]\/\.test\(s\);/);
  assert.match(output, /class Decl \{\} \/\[\/\/\]\/\.test\(s\);/);
  assert.match(output, /lbl: \{ foo\(\); \} \/\[\/\/\]\/\.test\(s\);/);
  assert.match(output, /switch \(v\) \{ case 1: \{ foo\(\); \} \/\[\/\/\]\/\.test\(s\); \}/);
  assert.match(output, /const arrowBlock = \(\) => \{\}\n\/\[\/\/\]\/\.test\(s\);/);

  const es5BuildSnippet = [
    '/**! @license MIT */',
    'if (cond) /[//]/.test(s);',
    'var x = 1;',
    'if (cond) /[/*]/.test(s) && /[*/]/.test(s);',
    'var n = ++/[//]/.lastIndex;',
    'var y = 1;',
    'var objDiv = { a: 1 } / 2; /* strip */',
    'var fnDiv = function () {} / 2; /* strip */'
  ].join('\n');

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pgmmv-build-f1-'));
  try {
    fs.writeFileSync(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({ name: '@kidthales/f1-plugin', version: '0.2.0' }),
      'utf8'
    );
    fs.writeFileSync(path.join(tempRoot, 'plugin.js'), es5BuildSnippet, 'utf8');

    const outPath = await buildPlugin({ rootDir: tempRoot, cwd: tempRoot });
    const built = fs.readFileSync(outPath, 'utf8');
    assert.doesNotMatch(built, /\/\* strip \*\//);
    assert.match(built, /if \(cond\) \/\[\/\/\]\/\.test\(s\);/);
    assert.match(built, /if \(cond\) \/\[\/\*\]\/\.test\(s\) && \/\[(\*\/)\]\/\.test\(s\);/);
    assert.match(built, /var n = \+\+\/\[\/\/\]\/\.lastIndex;/);
    assert.match(built, /var objDiv = \{ a: 1 \} \/ 2;/);
    assert.match(built, /var fnDiv = function \(\) \{\} \/ 2;/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('stripComments handles member-keyword for-of LHS, ASI-terminated concise async arrows, and object methods', () => {
  const input = [
    'for (obj.default of /[/*]/.exec(s) || []) {} /* strip */',
    'for (obj.of of /[/*]/.exec(s) || []) {} /* strip */',
    'const f = async (x) => x',
    'var y = await / 2; /* strip */',
    'async function outer() {',
    '  var o = {',
    '    m() {',
    '      var await = 10;',
    '      return await / 2; /* strip */',
    '    }',
    '  };',
    '  return o;',
    '}'
  ].join('\n');

  const output = stripComments(input);
  assert.doesNotMatch(output, /\/\* strip \*\//);
  assert.match(output, /for \(obj\.default of \/\[\/\*\]\/\.exec\(s\) \|\| \[\]\)/);
  assert.match(output, /for \(obj\.of of \/\[\/\*\]\/\.exec\(s\) \|\| \[\]\)/);
  assert.match(output, /var y = await \/ 2;/);
  assert.match(output, /return await \/ 2;/);
});

test('stripComments and buildPlugin preserve regexes and divisions across nested for-headers, async blocks, template interpolations, and adjacent JSDoc banners', async () => {
  const input = [
    '/**!',
    ' * @license MIT',
    ' *//**',
    ' * @description strip me',
    ' */',
    'for (var f = function () { s = "a"; { s = "b"; } /[/*]/.test(s) && /[*/]/.test(s); }; false; ) {}',
    'for (var g = function () { s = "a"; { s = "b"; } /[//]/.test(s);',
    'var z = 1; }; false; ) {}',
    'for (let [x = function () { a(); }()] of /[/*]/.exec(s) && /[*/]/.exec(s)) {}',
    'async function outer() {',
    '  var async = function () {};',
    '  async()',
    '  { return await /[/*]/.test(s) && /[*/]/.test(s); }',
    '}',
    'var await = 10;',
    "var x = `${async () => 1}` && await / 2; // don't crash"
  ].join('\n');

  const output = stripComments(input);
  assert.match(output, /@license MIT/);
  assert.doesNotMatch(output, /@description strip me/);
  assert.doesNotMatch(output, /don't crash/);
  assert.match(output, /\{ s = "b"; \} \/\[\/\*\]\/\.test\(s\) && \/\[(\*\/)\]\/\.test\(s\);/);
  assert.match(output, /\{ s = "b"; \} \/\[\/\/\]\/\.test\(s\);\nvar z = 1;/);
  assert.match(output, /of \/\[\/\*\]\/\.exec\(s\) && \/\[(\*\/)\]\/\.exec\(s\)/);
  assert.match(output, /\{ return await \/\[\/\*\]\/\.test\(s\) && \/\[(\*\/)\]\/\.test\(s\); \}/);
  assert.match(output, /var x = `\$\{async \(\) => 1\}` && await \/ 2;/);

  const es5BuildSnippet = [
    '/**!',
    ' * @license MIT',
    ' *//**',
    ' * @description strip me',
    ' */',
    'for (var f = function () { s = "a"; { s = "b"; } /[/*]/.test(s) && /[*/]/.test(s); }; false; ) {}',
    'for (var g = function () { s = "a"; { s = "b"; } /[//]/.test(s);',
    'var z = 1; }; false; ) {}'
  ].join('\n');

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pgmmv-build-vectors-'));
  try {
    fs.writeFileSync(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({ name: '@kidthales/vectors-plugin', version: '0.2.0' }),
      'utf8'
    );
    fs.writeFileSync(path.join(tempRoot, 'plugin.js'), es5BuildSnippet, 'utf8');

    const outPath = await buildPlugin({ rootDir: tempRoot, cwd: tempRoot });
    const built = fs.readFileSync(outPath, 'utf8');
    assert.match(built, /@license MIT/);
    assert.doesNotMatch(built, /@description strip me/);
    assert.match(built, /\/\[\/\*\]\/\.test\(s\) && \/\[(\*\/)\]\/\.test\(s\)/);
    assert.match(built, /\/\[\/\/\]\/\.test\(s\);/);
    assert.match(built, /var z = 1;/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('eslint rejects non-ES5 syntax in plugin.js', () => {
  const result = spawnSync(process.execPath, [eslintBin, '--stdin', '--stdin-filename', 'plugin.js'], {
    cwd: ROOT,
    input: 'const x = () => 1;\n',
    encoding: 'utf8'
  });

  assert.notEqual(result.status, 0, 'ESLint must reject ES6+ syntax under ecmaVersion: 5');
  assert.match(result.stdout + result.stderr, /Parsing error/i);
});

test('tsc --noEmit rejects invalid @kidthales/pgmmv-types usage under checkJs', () => {
  const tempDir = fs.mkdtempSync(path.join(ROOT, '.tmp-tsc-probe-'));
  try {
    const probePath = path.join(tempDir, 'probe.js');
    fs.writeFileSync(
      probePath,
      [
        '/// <reference types="@kidthales/pgmmv-types/pgmmv.d.ts" />',
        '(function () {',
        '  /** @type {import("@kidthales/pgmmv-types").AgtkPlugin} */',
        '  var invalidPlugin = {',
        '    setLocale: function () {},',
        '    getInfo: function () {},',
        '    initialize: function () {',
        '      Agtk.nonexistent();',
        '    },',
        '    finalize: function () {},',
        '    setParamValue: function () {},',
        '    setInternal: function () {},',
        '    call: function () {},',
        '    execLinkCondition: function () {',
        "      return 'not-a-boolean';",
        '    }',
        '  };',
        '  return invalidPlugin;',
        '})();'
      ].join('\n'),
      'utf8'
    );

    const tsconfigPath = path.join(tempDir, 'tsconfig.json');
    fs.writeFileSync(
      tsconfigPath,
      JSON.stringify(
        {
          compilerOptions: {
            target: 'es2020',
            lib: ['es2020', 'dom'],
            module: 'nodenext',
            moduleResolution: 'nodenext',
            allowJs: true,
            checkJs: true,
            noEmit: true,
            strict: true,
            types: ['@kidthales/pgmmv-types']
          },
          include: ['probe.js']
        },
        null,
        2
      ),
      'utf8'
    );

    const result = spawnSync(process.execPath, [tscBin, '-p', tsconfigPath, '--noEmit'], {
      cwd: ROOT,
      encoding: 'utf8'
    });

    assert.notEqual(result.status, 0, 'tsc --noEmit must reject invalid Agtk API and return types');
    const output = result.stdout + result.stderr;
    assert.match(output, /TS2339/);
    assert.match(output, /TS2322/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
