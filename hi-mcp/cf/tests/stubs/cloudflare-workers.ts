// Test stub for the Cloudflare-runtime-only module `cloudflare:workers`
// (aliased in vitest.config.ts). The worker routing tests never construct
// the container - the base classes only need to exist as importable
// constructors.
export class DurableObject {
  constructor(_ctx: unknown, _env: unknown) {}
}

export class WorkerEntrypoint {}
