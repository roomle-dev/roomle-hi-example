import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // runtime-only Cloudflare module - stubbed for the worker tests
      'cloudflare:workers': new URL(
        './cf/tests/stubs/cloudflare-workers.ts',
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    include: [
      'hi-mcp-poc-json/tests/**/*.test.ts',
      'cf/tests/**/*.test.ts',
    ],
  },
});
