# The unchanged hi-mcp workspace server: npm ci at the workspace root,
# then the PoC starts with `npm start` (vite-node) on the PORT Cloudflare
# Containers injects. Build context: the hi-mcp/ folder (see wrangler.jsonc).
FROM node:20-slim

WORKDIR /app

# install first for layer caching: the workspace root plus the PoC manifest
COPY package.json package-lock.json ./
COPY hi-mcp-poc-json/package.json ./hi-mcp-poc-json/
RUN npm ci

# the server sources (tests and docs ride along, they are small)
COPY tsconfig.base.json vitest.config.ts ./
COPY hi-mcp-poc-json ./hi-mcp-poc-json

ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
