import js from '@eslint/js'

export default [
  { ignores: ['dist/**', '_site/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        document: 'readonly',
        console: 'readonly',
        HTMLElement: 'readonly',
        CustomEvent: 'readonly',
        customElements: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly'
      }
    }
  },
  {
    files: ['**/*.test.js', 'eslint.config.js', 'script/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        afterEach: 'readonly',
        beforeEach: 'readonly',
        document: 'readonly',
        customElements: 'readonly',
        HTMLElement: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly'
      }
    }
  }
]
