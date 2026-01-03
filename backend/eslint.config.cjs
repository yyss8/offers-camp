const js = require('@eslint/js');
const globals = require('globals');
const importPlugin = require('eslint-plugin-import');
const nPlugin = require('eslint-plugin-n');
const promisePlugin = require('eslint-plugin-promise');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  { ignores: ['node_modules', 'dist'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    settings: {
      node: {
        version: 'current',
      },
    },
    plugins: {
      import: importPlugin,
      n: nPlugin,
      promise: promisePlugin,
    },
    rules: {
      ...importPlugin.configs.recommended.rules,
      ...nPlugin.configs.recommended.rules,
      ...promisePlugin.configs.recommended.rules,
      'n/no-unsupported-features/node-builtins': 'off',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
    },
  },
  prettierConfig,
];
