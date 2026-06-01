import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import pluginReactConfig from 'eslint-plugin-react/configs/recommended.js'
import tseslint from 'typescript-eslint'

const baseNamingConvention = [
  'error',
  {
    selector: 'property',
    modifiers: ['requiresQuotes'],
    format: null,
  },
  {
    selector: 'objectLiteralProperty',
    modifiers: ['requiresQuotes'],
    format: null,
  },
  {
    selector: ['property'],
    format: ['strictCamelCase', 'UPPER_CASE'],
    leadingUnderscore: 'allow',
    filter: {
      // Allow CSS variables, common HTTP headers, library-specific names, paths, and hyphenated/numeric keys
      regex:
        '^(Authorization|Content-Type|Accept|--.*|string_contains|disableCSRFCheck|X-Frameio-.*|/.*|field-.*|class-name|icon-.*|[0-9]+|@typescript-eslint/.*|Variables|Read|Edit|Admin|Bucket|Key|Body|ContentLength|ContentType|Prefix|ContinuationToken|Signature)$',
      match: false,
    },
  },
  {
    selector: ['parameter'],
    format: ['strictCamelCase', 'StrictPascalCase'],
    leadingUnderscore: 'allow',
  },
  {
    selector: ['accessor'],
    format: ['strictCamelCase'],
  },
  {
    selector: ['classProperty'],
    format: ['strictCamelCase', 'UPPER_CASE'],
    leadingUnderscore: 'allow',
  },
  {
    selector: ['typeLike'],
    format: ['StrictPascalCase'],
  },
  {
    selector: 'typeParameter',
    format: ['StrictPascalCase'],
    prefix: ['T'],
  },
  {
    selector: ['function'],
    format: ['strictCamelCase', 'StrictPascalCase'],
    leadingUnderscore: 'allow',
  },
  {
    selector: ['classMethod'],
    format: ['strictCamelCase'],
    leadingUnderscore: 'allow',
  },
  {
    selector: ['variable'],
    format: ['strictCamelCase', 'StrictPascalCase', 'UPPER_CASE'],
    leadingUnderscore: 'allow',
  },
]

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/packages/db/src/generated/**',
      '**/packages/core/src/generated/**',
      '**/data/**',
      '**/packages/webui/components/ui/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ...pluginReactConfig,
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/naming-convention': baseNamingConvention,
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/naming-convention': baseNamingConvention.map((q) => {
        if (
          typeof q === 'object' &&
          (q.selector === 'property' ||
            (Array.isArray(q.selector) && q.selector.includes('property'))) &&
          Array.isArray(q.format)
        ) {
          return {
            ...q,
            format: [...q.format, 'StrictPascalCase'],
          }
        }
        return q
      }),
    },
  },
)
