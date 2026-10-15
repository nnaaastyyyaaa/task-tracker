// eslint.config.js
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
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
