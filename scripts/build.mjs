import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { createScanner, LanguageVariant, SyntaxKind } from 'typescript/unstable/ast';

const NON_REGEX_PREDECESSOR_TOKENS = new Set([
  SyntaxKind.Identifier,
  SyntaxKind.PrivateIdentifier,
  SyntaxKind.NumericLiteral,
  SyntaxKind.BigIntLiteral,
  SyntaxKind.StringLiteral,
  SyntaxKind.RegularExpressionLiteral,
  SyntaxKind.NoSubstitutionTemplateLiteral,
  SyntaxKind.TemplateTail,
  SyntaxKind.CloseParenToken,
  SyntaxKind.CloseBracketToken,
  SyntaxKind.PlusPlusToken,
  SyntaxKind.MinusMinusToken,
  SyntaxKind.ThisKeyword,
  SyntaxKind.TrueKeyword,
  SyntaxKind.FalseKeyword,
  SyntaxKind.NullKeyword
]);

/**
 * Check whether a token starts trivia (whitespace, newline, or comment).
 * @param {number} token
 * @returns {boolean}
 */
function isTrivia(token) {
  return (
    token === SyntaxKind.SingleLineCommentTrivia ||
    token === SyntaxKind.MultiLineCommentTrivia ||
    token === SyntaxKind.NewLineTrivia ||
    token === SyntaxKind.WhitespaceTrivia
  );
}

/**
 * Strip non-banner comments using TypeScript's scanner while preserving `/*!` and `/**!` headers.
 * @param {string} source
 * @returns {string}
 */
function stripComments(source) {
  const scanner = createScanner(false, LanguageVariant.Standard, source);
  let output = '';
  let lastNonTriviaToken = SyntaxKind.Unknown;

  for (let token = scanner.scan(); token !== SyntaxKind.EndOfFile; token = scanner.scan()) {
    if (
      (token === SyntaxKind.SlashToken || token === SyntaxKind.SlashEqualsToken) &&
      !NON_REGEX_PREDECESSOR_TOKENS.has(lastNonTriviaToken)
    ) {
      token = scanner.reScanSlashToken();
    }

    const text = scanner.getTokenText();

    if (token === SyntaxKind.SingleLineCommentTrivia) {
      continue;
    }

    if (token === SyntaxKind.MultiLineCommentTrivia) {
      if (text.startsWith('/**!') || text.startsWith('/*!')) {
        output += text;
      } else {
        output += text.includes('\n') ? '\n' : ' ';
      }
      continue;
    }

    if (!isTrivia(token)) {
      lastNonTriviaToken = token;
    }

    output += text;
  }

  return output;
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(__dirname, '..');
  const pkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const baseName = String(pkg.name).replace(/^@[^/]+\//, '');
  const inputPath = path.join(rootDir, 'plugin.js');
  const outputArg = process.argv[2];
  const outputPath = outputArg
    ? path.resolve(process.cwd(), outputArg)
    : path.join(rootDir, 'dist', `${baseName}-v${pkg.version}.js`);

  const source = readFileSync(inputPath, 'utf8');
  const stripped = stripComments(source);
  const prettierConfig = await prettier.resolveConfig(inputPath);
  const formatted = await prettier.format(stripped, {
    ...(prettierConfig ?? {}),
    filepath: inputPath
  });

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, formatted, 'utf8');
  console.log(`Built ${path.relative(rootDir, outputPath)}`);
}

await main();
