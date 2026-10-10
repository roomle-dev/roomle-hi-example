FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY hi-mcp/package.json ./hi-mcp/
COPY hi-mcp/hi-mcp-server/package.json ./hi-mcp/hi-mcp-server/
COPY hi-mcp/hi-mcp-chat/package.json ./hi-mcp/hi-mcp-chat/
COPY hi-mcp/cf/package.json ./hi-mcp/cf/
COPY minimal-hi-example/package.json ./minimal-hi-example/
RUN npm ci --workspace hi-mcp/hi-mcp-server --omit=dev

COPY hi-mcp/tsconfig.base.json ./hi-mcp/
COPY hi-mcp/hi-mcp-server ./hi-mcp/hi-mcp-server

ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start", "--workspace", "hi-mcp/hi-mcp-server"]
