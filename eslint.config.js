const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({ recommendedConfig: {} });

module.exports = [
  ...compat.config({
    extends: ['eslint:recommended', 'plugin:prettier/recommended'],
    ignorePatterns: [],
    overrides: [
      {
        files: ['plugin.js'],
        extends: ['eslint:recommended', 'plugin:prettier/recommended', 'plugin:es5/no-es2015'],
        parserOptions: {
          ecmaVersion: 5,
          sourceType: 'script'
        }
      }
    ]
  })
];
