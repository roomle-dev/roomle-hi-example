import { Container } from '@cloudflare/containers';

const PORT = 3000;
const SLEEP_AFTER = '15m';

/**
 * The unchanged hi-mcp Node server runs inside (npm start on the injected
 * PORT). The Durable Object only holds the container: the relay state (the
 * connected page, pending calls) lives in the container process and dies
 * with it — the store page's bridge reconnects on its own after a restart.
 */
export class HiMcpContainer extends Container {
  defaultPort = PORT;
  sleepAfter = SLEEP_AFTER;

  constructor(ctx: DurableObjectState<Cloudflare.Env>, env: Cloudflare.Env) {
    super(ctx, env);
    this.envVars = {
      PORT: String(PORT),
      // the URL the server tells users to open when no page is connected
      HI_MCP_STORE_URL: env.HI_MCP_STORE_URL ?? '',
    };
  }

  override async fetch(request: Request): Promise<Response> {
    const storeUrl = this.envVars?.HI_MCP_STORE_URL;
    if (storeUrl) {
      const url = new URL(storeUrl);
      const session =
        new URL(request.url).searchParams.get('session') ?? 'default';
      url.searchParams.set('mcp_session', session);
      this.envVars = { ...this.envVars, HI_MCP_STORE_URL: url.toString() };
    }
    return this.containerFetch(request, PORT);
  }
}
