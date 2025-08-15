const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const prettier = require('eslint-plugin-prettier');
const simpleImportSort = require('eslint-plugin-simple-import-sort');

module.exports = [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.yalc/**',
      '**/*.d.ts',
      'eslint.config.js'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.eslint.json', './packages/**/*/tsconfig.json']
      }
    },
    plugins: {
      '@typescript-eslint': typescript,
      'prettier': prettier,
      'simple-import-sort': simpleImportSort
    },
    rules: {
      ...typescript.configs.recommended.rules,
      'prettier/prettier': 'error',
      'simple-import-sort/imports': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-undef': 'off', // TypeScript handles this
      '@typescript-eslint/no-unused-expressions': 'off',
    }
  },
  {
    files: ['eslint.config.js'],
    languageOptions: {
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly'
      }
    }
  }
];
