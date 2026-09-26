import { HiMcpContainer } from './container';
import type { Bindings } from './env';

export { HiMcpContainer };

// Phase 1: one shared container for everyone. Both endpoints are forwarded
// unchanged: /mcp (stateless HTTP from the MCP clients) and /bridge (the
// store page's WebSocket upgrade — the core unknown of the Cloudflare
// deployment, verified with the first deploy; the fallback is documented in
// the feature analysis).
const DEFAULT_SESSION = 'default';

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname !== '/mcp' && pathname !== '/bridge') {
      return new Response('Not found - the MCP endpoint is /mcp', {
        status: 404,
      });
    }
    const container = env.HI_MCP.getByName(DEFAULT_SESSION);
    return container.fetch(request);
  },
} satisfies ExportedHandler<Bindings>;
