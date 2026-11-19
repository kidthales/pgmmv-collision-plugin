const js = require('@eslint/js');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = [
  {
    ignores: ['dist/**', '.ci-local/**', '**/.tmp-*/**']
  },
  js.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    files: ['eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs'
    }
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    }
  },
  {
    files: ['plugin.js'],
    languageOptions: {
      ecmaVersion: 5,
      sourceType: 'script',
      globals: {
        Agtk: 'readonly',
        cc: 'readonly',
        jsb: 'readonly',
        window: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none' }]
    }
  }
];
