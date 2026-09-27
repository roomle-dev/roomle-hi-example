import { HiMcpContainer } from './container';
import type { Bindings } from './env';

export { HiMcpContainer };

// Phase 2: per-session containers. Every session id gets its own container,
// so users plan in parallel without interfering - the id travels in both
// URLs: ?session= for MCP clients, and on the store page's bridge URL (the
// mcp_session store parameter). Without it, everyone shares one container.
const DEFAULT_SESSION = 'default';

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const { pathname, searchParams } = new URL(request.url);
    if (pathname !== '/mcp' && pathname !== '/bridge') {
      return new Response('Not found - the MCP endpoint is /mcp', {
        status: 404,
      });
    }
    const container = env.HI_MCP.getByName(
      searchParams.get('session') ?? DEFAULT_SESSION,
    );
    return container.fetch(request);
  },
} satisfies ExportedHandler<Bindings>;
