import eslintPluginAstro from 'eslint-plugin-astro'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**', '.astro/**', '.wrangler/**', 'node_modules/**'],
  },
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs['flat/recommended'],
  {
    // Frontmatter is TypeScript: parse it with the TS parser instead of the
    // default JS one, otherwise every type annotation is a parsing error.
    files: ['**/*.astro'],
    processor: 'astro/client-side-ts',
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.astro'],
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        Astro: 'readonly',
      },
    },
  },
  {
    // Client-side `<script>` blocks, extracted as virtual `.ts` files.
    files: ['**/*.astro/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
]
