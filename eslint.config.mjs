import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

const rules = {
  '@typescript-eslint/restrict-template-expressions': ['error', { allowBoolean: true, allowNullish: true, allowNumber: true }],
  '@typescript-eslint/explicit-member-accessibility': [
    'error',
    { accessibility: 'explicit', overrides: { constructors: 'explicit' } },
  ],
  '@typescript-eslint/explicit-function-return-type': 'error',
  '@typescript-eslint/explicit-module-boundary-types': 'error',
  '@typescript-eslint/typedef': [
    'error',
    {
      memberVariableDeclaration: true,
      parameter: true,
      propertyDeclaration: true,
      variableDeclaration: true,
      variableDeclarationIgnoreFunction: false,
    },
  ],
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
  ],
  '@typescript-eslint/consistent-generic-constructors': ['error', 'type-annotation'],
  '@typescript-eslint/no-inferrable-types': 'off',
  '@typescript-eslint/no-extraneous-class': 'off',
  '@typescript-eslint/no-confusing-void-expression': 'off',
  '@typescript-eslint/unbound-method': 'off',
  complexity: ['error', 12],
  'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true, IIFEs: true }],
};

export default defineConfig(
  { ignores: ['.angular/**', 'dist/**', 'out/**', 'coverage/**', 'node_modules/**', '**/*.js'] },
  {
    files: ['editor/src/**/*.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      ...rules,
      '@angular-eslint/prefer-host-metadata-property': 'error',
      '@angular-eslint/prefer-inject': 'error',
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-signal-model': 'error',
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/no-output-on-prefix': 'off',
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
    },
  },
  {
    files: ['editor/**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
  {
    files: ['electron/src/**/*.ts', 'forge.config.ts', 'tools/**/*.{ts,mts}'],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: { allowDefaultProject: ['forge.config.ts'] }, tsconfigRootDir: import.meta.dirname },
    },
    rules,
  },
  prettier,
);
