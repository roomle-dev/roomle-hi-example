import { writeFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { createHiMcpServer } from './hi-mcp-server';
import type { PlannerApi } from './planner-api';

// Writes the answers of tools/list and skills/list to a file: the fixture the
// copy of the tools in the roomle-ui embedding-lib checks its tool names,
// descriptions, input schemas and skill texts against.
// Usage: npm run export:fixture -- <absolute path of the output file>

const output = process.argv[2];
if (!output) {
  throw new Error(
    'Usage: npm run export:fixture -- <absolute path of the output file>'
  );
}

const notCalled = async () => {
  throw new Error('tools/list and skills/list call no planner method');
};
const plannerApi: PlannerApi = {
  extended: {
    getExternalObjectPlanContext: notCalled,
    externalObjectGroupOperation: notCalled,
    fetchPrice: notCalled,
    getExternalObjectSnapshot: notCalled,
    undo: notCalled,
    redo: notCalled,
  },
};

const server = createHiMcpServer(plannerApi);
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);
const client = new Client({ name: 'export-fixture', version: '0.0.0' });
await client.connect(clientTransport);

const { tools } = await client.listTools();
const { skills } = (await client.request(
  { method: 'skills/list', params: {} } as never,
  z.looseObject({})
)) as { skills: unknown[] };
await client.close();

writeFileSync(output, `${JSON.stringify({ tools, skills }, null, 2)}\n`);
console.log(
  `[hi-mcp] wrote ${tools.length} tools and ${skills.length} skills to ${output}`
);
