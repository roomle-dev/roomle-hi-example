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
    // its dist imports files without extensions - Node cannot load it unbundled
    server: { deps: { inline: ['@cloudflare/containers'] } },
    include: [
      'hi-mcp-server/tests/**/*.test.ts',
      'hi-mcp-client/tests/**/*.test.ts',
      'hi-mcp-chat/tests/**/*.test.ts',
      'cf/tests/**/*.test.ts',
    ],
  },
});
