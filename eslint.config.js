const js = require('@eslint/js');
const jsdoc = require('eslint-plugin-jsdoc');
const sonarjs = require('eslint-plugin-sonarjs');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

/**
 * Configuración ESLint (flat config) alineada con AGENTS.md:
 * §2 Clean Code (DRY, funciones pequeñas, sin `console`) y
 * §3 JSDoc obligatorio en clases y métodos públicos.
 *
 * @type {import('eslint').Linter.Config[]}
 */
module.exports = [
  {
    ignores: ['node_modules/**', 'coverage/**', 'uploads/**', 'scripts/**'],
  },
  js.configs.recommended,
  jsdoc.configs['flat/recommended'],
  sonarjs.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      'no-console': 'error',
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      complexity: ['warn', 10],
      'max-lines-per-function': ['warn', { max: 40, skipBlankLines: true, skipComments: true }],
      'max-depth': ['warn', 3],
      'jsdoc/tag-lines': 'off',
      'jsdoc/no-defaults': 'off',
      'jsdoc/reject-any-type': 'off',
      'jsdoc/reject-function-type': 'off',
      'jsdoc/check-tag-names': ['warn', { definedTags: ['openapi'] }],
      'jsdoc/require-jsdoc': [
        'warn',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
          },
          contexts: ['MethodDefinition', 'ClassDeclaration', 'FunctionDeclaration'],
        },
      ],
      'jsdoc/require-param-description': 'warn',
      'jsdoc/require-returns-description': 'warn',
      'jsdoc/require-returns': 'warn',
      'jsdoc/require-param': 'warn',
      'jsdoc/check-param-names': 'warn',
      'jsdoc/no-undefined-types': 'off',
      'jsdoc/valid-types': 'off',
    },
  },
  {
    files: ['tests/**/*.js'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
      'max-lines-per-function': 'off',
      'sonarjs/no-duplicate-string': 'off',
    },
  },
  prettier,
];
