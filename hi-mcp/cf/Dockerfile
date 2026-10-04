# The unchanged hi-mcp workspace server: npm ci at the workspace root,
# then the PoC starts with `npm start` (vite-node) on the PORT Cloudflare
# Containers injects. Build context: the hi-mcp/ folder (see wrangler.jsonc).
FROM node:20-slim

WORKDIR /app

# install first for layer caching: the workspace root plus the manifests
COPY package.json package-lock.json ./
COPY hi-mcp-server/package.json ./hi-mcp-server/
COPY cf/package.json ./cf/
# only the PoC workspace - the cf tooling (wrangler & co.) stays out of the image
RUN npm ci --workspace hi-mcp-server

# the server sources (tests and docs ride along, they are small)
COPY tsconfig.base.json vitest.config.ts ./
COPY hi-mcp-server ./hi-mcp-server

ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
