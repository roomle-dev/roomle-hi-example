export interface Bindings {
  /** The hi-mcp container, bound as a Durable Object (wrangler.jsonc). */
  HI_MCP: DurableObjectNamespace;
  /**
   * The store URL the server names in its "no page connected" error
   * (wrangler.jsonc vars) - the URL users open to connect a page.
   */
  HI_MCP_STORE_URL: string;
}

declare global {
  namespace Cloudflare {
    interface Env {
      HI_MCP_STORE_URL?: string;
    }
  }
}
