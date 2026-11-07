// eslint.config.js
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['.stryker-tmp/**', 'reports/**']),
  {
    files: ['**/*.js'],
    plugins: {
      js,
    },
    extends: ['js/recommended'],
    rules: {
      'no-unused-vars': 'warn',
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
]);
