import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default tseslint.config(
  {
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'prettier': prettierPlugin,
      'simple-import-sort': simpleImportSort,
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-constant-condition': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'prefer-const': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^_$',
          argsIgnorePattern: '^_$',
          caughtErrorsIgnorePattern: '^_$',
        },
      ],
    },
    ignores: ['node_modules', 'dist', 'eslint.config.js'],
    files: ['src/**/*.ts'],
  },
  // {
  //   languageOptions: {
  //     globals: {
  //       ...globals.browser,
  //     },
  //   },
  // },
);
