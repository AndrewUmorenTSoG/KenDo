import { defineConfig } from 'vitest/config'

// Tests for the MCP connector and shared task rules. The Firestore tests need the emulator:
// `npm test` starts it; `npm run test:unit` runs only the tests that don't.
export default defineConfig({
  test: {
    include: ['netlify/**/*.test.mts', 'src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    env: { KENDO_PUBLIC_URL: 'https://kendo.test', TZ: 'UTC', GCLOUD_PROJECT: 'demo-kendo', GOOGLE_CLOUD_PROJECT: 'demo-kendo' },
  },
})
