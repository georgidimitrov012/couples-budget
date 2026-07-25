// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Build output and generated files aren't ours to lint.
    ignores: ['dist/*', '.expo/*', 'expo-env.d.ts', 'lib/database.types.ts'],
  },
  {
    // The React Compiler hook rules (new in eslint-config-expo 57) are stricter
    // than some intentional patterns here — the per-instance realtime channel id
    // (useRef(Math.random())) that fixed the launch crash, and deliberate
    // prop->state sync effects. Keep them visible as warnings rather than
    // blocking CI or forcing risky rewrites of the realtime hooks. See the
    // supabase-realtime-channel-uniqueness note before "fixing" these.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    // Jest tests put jest.mock() before imports (trips import/first) and use
    // require() in mock factories — idiomatic for Jest, not a code smell.
    files: ['__tests__/**', 'test/**', 'tests/**'],
    rules: {
      'import/first': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
