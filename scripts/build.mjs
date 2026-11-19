import console from 'node:console';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { parsers as babelParsers } from 'prettier/plugins/babel';

const LINE_TERMINATOR_RE = /[\n\r\u2028\u2029]/;

/**
 * Return the `[start, end]` UTF-16 span for a Babel comment node, preferring `range` when
 * Prettier's Babel parser merged adjacent JSDoc blocks.
 *
 * @param {{ start?: number, end?: number, range?: [number, number] }} comment
 * @returns {[number, number]}
 */
function getCommentSpan(comment) {
  if (Array.isArray(comment.range)) {
    return [comment.range[0], comment.range[1]];
  }
  return [comment.start ?? 0, comment.end ?? 0];
}

/**
 * Normalize path casing on case-insensitive Windows filesystems for equality checks.
 *
 * @param {string} targetPath
 * @returns {string}
 */
function normalizeForCompare(targetPath) {
  return process.platform === 'win32' ? targetPath.toLowerCase() : targetPath;
}

/**
 * Resolve the canonical real path of an existing or not-yet-created target path.
 * Walks up only while segments genuinely do not exist; dangling symlinks rethrow ENOENT.
 *
 * @param {string} targetPath
 * @returns {string}
 */
export function resolveRealPath(targetPath) {
  const absolute = resolve(targetPath);
  const pending = [];
  let current = absolute;

  while (true) {
    try {
      const real = realpathSync(current);
      return pending.length > 0 ? join(real, ...pending.reverse()) : real;
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
        let isDanglingSymlink = false;
        try {
          lstatSync(current);
          isDanglingSymlink = true;
        } catch {
          // Segment does not exist on disk; walk up to its parent directory.
        }
        if (isDanglingSymlink) {
          throw err;
        }
        const parent = dirname(current);
        if (parent === current) {
          return absolute;
        }
        pending.push(basename(current));
        current = parent;
        continue;
      }
      throw err;
    }
  }
}

/**
 * Verify that `outputPath` neither overwrites `inputPath` nor escapes `distDir`.
 *
 * @param {{ rootDir: string, inputPath: string, distDir: string, outputPath: string }} paths
 */
export function assertSafeOutputPath({ rootDir, inputPath, distDir, outputPath }) {
  const realRoot = resolveRealPath(rootDir);
  const realInput = resolveRealPath(inputPath);
  const realDist = resolveRealPath(distDir);
  const realOutput = resolveRealPath(outputPath);

  if (normalizeForCompare(realOutput) === normalizeForCompare(realInput)) {
    throw new Error(`Refusing to overwrite input file: ${inputPath}`);
  }

  const expectedDist = resolve(realRoot, 'dist');
  if (normalizeForCompare(realDist) !== normalizeForCompare(expectedDist)) {
    throw new Error(`Refusing to write through non-canonical dist directory (${distDir}): ${realDist}`);
  }

  const relToDist = relative(realDist, realOutput);
  const isInsideDist =
    relToDist !== '' &&
    relToDist !== '.' &&
    relToDist !== '..' &&
    !relToDist.startsWith(`..${sep}`) &&
    !relToDist.startsWith('../') &&
    !isAbsolute(relToDist);

  if (!isInsideDist) {
    throw new Error(`Refusing to write outside dist directory (${distDir}): ${outputPath}`);
  }
}

/**
 * Strip non-banner comments from JavaScript source while preserving `/**!` / `/*!` headers,
 * ES5.1 §7.3 `LineTerminator` boundaries, and template literal interpolations.
 *
 * @param {string} source
 * @returns {string}
 */
export function stripComments(source) {
  const ast = babelParsers.babel.parse(source);
  const rawComments = Array.isArray(ast?.comments) ? ast.comments : [];
  const comments = [...rawComments].sort((a, b) => getCommentSpan(a)[0] - getCommentSpan(b)[0]);
  const chunks = [];
  let lastEnd = 0;

  for (const comment of comments) {
    if (comment.type !== 'CommentLine' && comment.type !== 'CommentBlock') {
      continue;
    }

    const [start, end] = getCommentSpan(comment);
    if (start < lastEnd || end < start) {
      continue;
    }

    if (start > lastEnd) {
      chunks.push(source.slice(lastEnd, start));
    }

    if (comment.type === 'CommentBlock') {
      // Prettier's Babel parser merges adjacent `/** ... */` blocks via `range`; split at `*/`
      // boundaries so a leading `/**!` banner never shields an immediately following JSDoc block.
      let blockStart = start;
      while (blockStart < end) {
        const closeIdx = source.indexOf('*/', blockStart + 2);
        const blockEnd = closeIdx !== -1 && closeIdx + 2 <= end ? closeIdx + 2 : end;
        const rawBlock = source.slice(blockStart, blockEnd);
        if (rawBlock.startsWith('/**!') || rawBlock.startsWith('/*!')) {
          chunks.push(rawBlock);
        } else {
          chunks.push(LINE_TERMINATOR_RE.test(rawBlock) ? '\n' : ' ');
        }
        blockStart = blockEnd;
      }
    }

    lastEnd = end;
  }

  if (lastEnd < source.length) {
    chunks.push(source.slice(lastEnd));
  }

  return chunks.join('');
}

/**
 * Build the comment-stripped, Prettier-formatted plugin distribution bundle.
 *
 * @param {{ rootDir?: string, outputArg?: string, cwd?: string }} [options]
 * @returns {Promise<string>}
 */
export async function buildPlugin(options = {}) {
  const defaultRootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const rootDir = options.rootDir ? resolve(options.rootDir) : defaultRootDir;
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
  const unscopedName = String(pkg.name).replace(/^@[^/]+\//, '');
  const inputPath = resolve(rootDir, 'plugin.js');
  const distDir = resolve(rootDir, 'dist');
  const defaultOutPath = resolve(distDir, `${unscopedName}-v${pkg.version}.js`);
  const outputPath = options.outputArg ? resolve(cwd, options.outputArg) : defaultOutPath;

  assertSafeOutputPath({ rootDir, inputPath, distDir, outputPath });

  const source = readFileSync(inputPath, 'utf8');
  const stripped = stripComments(source);
  const prettierConfig = await prettier.resolveConfig(inputPath);
  const formatted = await prettier.format(stripped, {
    ...(prettierConfig ?? {}),
    filepath: inputPath
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, formatted, 'utf8');
  return outputPath;
}

async function main() {
  const outputPath = await buildPlugin({ outputArg: process.argv[2] });
  console.log(`Built ${outputPath}`);
}

const isEntrypoint =
  typeof process.argv[1] === 'string' &&
  existsSync(process.argv[1]) &&
  normalizeForCompare(realpathSync(resolve(process.argv[1]))) ===
    normalizeForCompare(realpathSync(fileURLToPath(import.meta.url)));

if (isEntrypoint) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
