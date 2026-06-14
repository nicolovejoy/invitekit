import { defineConfig } from 'vitest/config'
import path from 'path'

// Separate config for Firestore security-rules tests, which require the
// Firestore emulator (started by `npm run test:rules` via emulators:exec).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.rules.test.js'],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
