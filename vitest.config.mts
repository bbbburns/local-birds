import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-plugin';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      // Fixed secrets for the test worker so the suite is self-contained and
      // does not depend on a developer's .dev.vars (absent in CI, where an
      // undefined secret made "Bearer undefined" pass the auth checks).
      miniflare: {
        bindings: {
          EBIRD_API_KEY: 'test-ebird-api-key',
          POLL_SECRET: 'test-poll-secret',
          THUMBNAIL_PUSH_SECRET: 'test-thumbnail-push-secret',
        },
      },
    }),
  ],
  test: {
    setupFiles: ['./test/setup.ts'],
  },
});
