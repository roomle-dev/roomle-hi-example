// HI group orchestrator MCP server - standalone, zero-dependency variant.
//
// One plain Node.js process (Node 18+, no npm install, no build):
//   - serves this directory's index.html          GET  /
//   - hosts the MCP endpoint (Streamable HTTP)    POST /mcp
//   - hosts the page bridge                       GET  /bridge (SSE), POST /bridge/result
//
// Start it with:  node hi-mcp-server.js
// Then open:      http://localhost:3100/?mcp=true
// MCP endpoint:   http://localhost:3100/mcp
//
// The MCP protocol layer (JSON-RPC over HTTP with JSON responses) is
// hand-rolled here instead of using @modelcontextprotocol/sdk, and the page
// bridge uses SSE + fetch instead of a WebSocket, so the file has no
// dependencies at all. Tool calls are relayed to the open example page, where
// they run against roomDesignerApi.extended (see the "MCP bridge" section in
// index.html).

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3100;
const DEFAULT_CALL_TIMEOUT_MS = 30_000;
const SNAPSHOT_CALL_TIMEOUT_MS = 120_000;
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const STATIC_ROOT = dirname(fileURLToPath(import.meta.url));
const STATIC_CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const AUTHORING_RULES = `Authoring rules for pos groups:
- A group is { id?, libraryId?, placement?, repositioningData?, roots: [...] }. A root module is an article pick: { id, articleId, attributes?, contextData? }. Use a unique id of your choice for new roots (the planner regenerates it and remaps your docking and repositioning references); keep the real ids of roots that already exist in a replaced group. Choose the articleId from the article catalog of get-plan-context: desc and category say what an article is and what it is for, dimensions give its size, dockingVectors the names of its docking vectors, subModules its fronts and appliances. Sub-modules come with the article - you author articles, their attributes and their docking, nothing else. attributes is an optional list of { id, value } overrides; attribute ids and allowed values come from the masterData section (request it with include) or from find-attributes. Everything else the calculation needs is completed automatically from the article template.
- Never set pos, rotationY or articlePos anywhere - all positions and rotations are computed by the planner, and new roots carrying articlePos/rotationY are rejected. Position a group declaratively instead, with placement or repositioningData.
- placement: { wall, alignment?, offsetMm?, roomIndex? } on a group stands it against a wall in the same call. wall is a side label ('left'/'right'/'top'/'bottom' as seen in the top-view image; the longest wall on that side is used) or a wall index from the room's walls array. alignment is 'center' (default), 'start'/'end' (the wall's endpoints), or the side label of an adjoining wall to sit flush in that corner - e.g. wall: "right", alignment: "top" is the corner the right and top walls share. offsetMm shifts along the wall.
- repositioningData: { posGroup: [x, y, z], posRotationY?, rootId, rootRelPos?, rootRelRotationY? } positions a group at a free point: the root module rootId ends up at posGroup (millimetres, y up, y = 0 on the floor) with yaw posRotationY (degrees), and the planner derives the group transform. Take coordinates from the walls array (wall start/end are [x, z]; pos = [x, 0, z]). rootRelPos/rootRelRotationY offset the target. Applied exactly once when the group loads; groups returned by get-plan-context never carry this field. Use either placement or repositioningData, not both.
- Docking (contextData) relates the root modules of a group to each other and is required: in a group with several roots, every additional root must be docked to a root that is already placed (undocked roots are rejected). Write the docking entry on the placed root (the anchor) and list the new root under dockedRoots - the anchor's own vector meets the named vector of the new root:
  { "id": "A", "articleId": "...", "contextData": { "dockedRoots": [{ "ownDockingVector": "RightBottom", "dockedRoots": [{ "id": "B", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }] }] } }
  puts B directly right of A. Chain it (A lists B, B lists C, ...) for a row; one anchor may carry several entries, one per own vector. Docking vector indices are resolved from the names automatically. An offset only takes effect in this direction - an entry written on the new root loses it.
- Docking vectors are named edges of a root module (dockInfos; the names per article are in the catalog as dockingVectors). Left and Right vectors lie on the side faces and run from the back to the front, Back vectors lie on the back face and run from left to right; Top and Bottom name the upper and lower edge; LeftBack and RightBack are the back edges of the two arms of an L-shaped corner module. Valid pairs, written as own vector of the anchor -> vector of the new root:
  beside: RightBottom -> LeftBottom (new root to the right), LeftBottom -> RightBottom (new root to the left).
  on top: LeftTop -> LeftBottom, RightTop -> RightBottom, BackTop -> BackBottom (the new root may be narrower or shallower).
  back to back: BackBottom -> BackBottom, BackTop -> BackTop (the new root is turned by 180 degrees; omit mode for these pairs).
  A root without docking vectors (a hood, for example) cannot be docked: give it its own group and position it with placement or repositioningData.
- mode selects which endpoints of the two vectors coincide: StartStart (default) the start points - the backs for Left/Right vectors, the left edges for Back vectors; EndEnd the end points - the fronts, or the right edges; StartEnd and EndStart mix them. offset is a translation [x, y, z] in millimetres added to the new root after docking: y for the gap between a base unit and the wall unit above it, x for a gap in a row.
- Recipes (own vector of the anchor -> vector of the new root):
  row: A -> B RightBottom -> LeftBottom, then B -> C the same way.
  wall unit W above base unit A: A -> W LeftTop -> LeftBottom, offset [0, <gap between the top of A and the bottom of W>, 0].
  narrow wall unit right-aligned above a wide base unit: A -> W BackTop -> BackBottom, mode EndEnd, offset [0, <gap>, 0].
  worktop or any part lying directly on a unit: A -> T LeftTop -> LeftBottom, no offset.
  island: front unit A -> back unit B BackBottom -> BackBottom, no mode.
  corner with an L-shaped module C: the rows continue from C's RightBottom (to the right) and LeftBottom (to the left) like from any other unit.
- To move an existing group, call place-group (same wall/alignment/offset vocabulary as placement). To modify an existing group, take it from get-plan-context, change it, and resubmit it with its id via create-or-replace-groups; keep the ids of the root modules you keep. A replace re-applies placement and positions.
- Verify results numerically: the returned groups carry pos, rotationY, footprint and the dockInfos of every root, and logMessages entries with category Error mean the input is wrong (typically a bad articleId or attribute value). Do not judge placement from a rendering alone.

Complete example - "a row of three tall units against the right wall" is ONE call, create-or-replace-groups with:
{ "posGroups": [{ "libraryId": "<libraryId>", "placement": { "wall": "right" }, "roots": [
  { "id": "u1", "articleId": "<articleId from the catalog>", "contextData": { "dockedRoots": [{ "ownDockingVector": "RightBottom", "dockedRoots": [{ "id": "u2", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }] }] } },
  { "id": "u2", "articleId": "<articleId>", "contextData": { "dockedRoots": [{ "ownDockingVector": "RightBottom", "dockedRoots": [{ "id": "u3", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }] }] } },
  { "id": "u3", "articleId": "<articleId>" }
] }] }

Second example - "two base units with a wall unit above each" is the same call with these roots (600 is the gap between the top of the base units and the bottom of the wall units):
  { "id": "b1", "articleId": "<base unit>", "contextData": { "dockedRoots": [
    { "ownDockingVector": "RightBottom", "dockedRoots": [{ "id": "b2", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }] },
    { "ownDockingVector": "LeftTop", "dockedRoots": [{ "id": "w1", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 600, 0] }] } ] } },
  { "id": "b2", "articleId": "<base unit>", "contextData": { "dockedRoots": [{ "ownDockingVector": "LeftTop", "dockedRoots": [{ "id": "w2", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 600, 0] }] }] } },
  { "id": "w1", "articleId": "<wall unit>" },
  { "id": "w2", "articleId": "<wall unit>" }

Third example - "a unit in the back right corner" (back = top in the top view): the same call with "placement": { "wall": "right", "alignment": "top" }. The equivalent with repositioningData, anchoring root u1 at the corner point taken from the walls array: "repositioningData": { "posGroup": [<corner x>, 0, <corner z>], "posRotationY": 270, "rootId": "u1" }.`;

const INSTRUCTIONS = `This server orchestrates HOMAG Intelligence (HI) object groups in a live Roomle room-planner session (proof of concept).

Typical workflow:
1. get-plan-context: fetch the rooms (each with a derived walls array), the article catalog (desc, category, dimensions, docking vector names, sub-modules per article) and the groups currently in the plan. Add masterData to include for the attribute vocabulary, or look an attribute up with find-attributes.
2. create-or-replace-groups: author each group as article picks plus docking (the placed root lists the new root) plus a placement (wall side label) - one call creates, docks and positions the group; never author coordinates. A group whose id matches an existing group in the plan completely replaces that group; all other groups are created. The payload format, the docking pairs and the recipes are returned by get-authoring-rules.
3. place-group: move an existing group to another wall when asked.
4. Check the result with get-price or get-order-data, and inspect it with get-plan-images.

${AUTHORING_RULES}`;

const TOOLS = [
  {
    name: 'get-plan-context',
    description:
      'Returns a snapshot of the HI planning session. Default sections: rooms (wall contours of all rooms; every ' +
      'room also carries a derived walls array - per wall: a side label (left/right/top/bottom as seen in the ' +
      'top-view image), start/end [x, z] in millimetres, lengthMm, type, heightMm, thicknessMm and the ' +
      'facingRotationY a group needs to stand against that wall), articles (compact catalog: articleId, name, ' +
      'desc, category, image, and per root module its master-data module, dimensions, main attribute values, ' +
      'docking vector names, insert levels and sub-modules) and groups (the groups currently in the plan with ' +
      'their pos, rotationY and footprint, without calculated geometry). masterData (per library the root ' +
      'modules and the customer-facing attributes with their allowed values) is returned only when included ' +
      'explicitly; other attributes are found with find-attributes. Use it before authoring or modifying groups.',
    inputSchema: {
      type: 'object',
      properties: {
        include: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['masterData', 'rooms', 'articles', 'groups'],
          },
          description:
            'The sections to include. Default: rooms, articles and groups. Add masterData for the attribute vocabulary.',
        },
      },
    },
  },
  {
    name: 'find-attributes',
    description:
      'Searches the attribute vocabulary of the loaded libraries by text (attribute id, name, description, ' +
      'group or selection name) and returns the matching attributes with their allowed values, their ' +
      'userRight and the root modules that carry them - including the attributes the compact masterData ' +
      'section of get-plan-context leaves out. Use it to find the attribute for a requested property, e.g. ' +
      'the front colour, and the value to set.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          minLength: 1,
          description: 'The text to search for, case-insensitive.',
        },
        libraryId: {
          type: 'string',
          description: 'Restricts the search to one library.',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'get-authoring-rules',
    description:
      'Returns the authoring rules for pos groups: the payload format of create-or-replace-groups, the root ' +
      'module fields, the placement options, the docking vectors with their valid pairs, mode and offset, and ' +
      'the recipes for a row, a wall unit above a base unit, an island and a corner. Fetch this before ' +
      'authoring pos groups.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create-or-replace-groups',
    description:
      'Creates or replaces HI object groups in the plan from an array of pos groups. Roots are article picks ' +
      '({ id, articleId, attributes?, contextData? }) - the server completes them from the article template, ' +
      'and the planner calculates and arranges the docked root modules (the docking vector names of an article ' +
      'are in the catalog as dockingVectors; the placed root lists the new root); never author coordinates. Position each ' +
      'group in the same call: placement ({ wall, alignment?, offsetMm? }) stands it against a wall, ' +
      'repositioningData places a root at a free point. A group whose id matches an existing group completely ' +
      'replaces that group (root modules keep their ids when they already exist in the replaced group); all ' +
      'other groups are created with regenerated ids. Returns the loaded object ids and the resulting groups - ' +
      'check their pos, footprint and any Error logMessages. The payload format is returned by get-authoring-rules.',
    inputSchema: {
      type: 'object',
      properties: {
        posGroups: {
          type: 'array',
          items: { type: 'object' },
          minItems: 1,
          description:
            'The pos groups to create or replace, following the rules returned by get-authoring-rules.',
        },
      },
      required: ['posGroups'],
    },
    timeoutMs: SNAPSHOT_CALL_TIMEOUT_MS,
  },
  {
    name: 'place-group',
    description:
      'Places an existing group against a wall of a room: computes the group pos/rotationY from the wall, the ' +
      "alignment and the group's calculated footprint, then reloads the group there. Pick the wall from the " +
      'walls array of get-plan-context by its side label (left/right/top/bottom as seen in the top-view image) ' +
      'and length, and pass its index. Use this after create-or-replace-groups to position a group - never ' +
      'author coordinates yourself. Returns the applied pos/rotationY, the footprint, the wall and the ' +
      'resulting group.',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: {
          type: 'string',
          description: 'The id of the group to place.',
        },
        wall: {
          anyOf: [
            { type: 'string', enum: ['left', 'right', 'top', 'bottom'] },
            { type: 'integer', minimum: 0 },
          ],
          description:
            "The target wall: a side label as seen in the top view ('right' places the group " +
            'against the longest wall on the right) or a wall index from the walls array of ' +
            'get-plan-context.',
        },
        roomIndex: {
          type: 'integer',
          minimum: 0,
          description: 'The index of the room in the rooms array. Defaults to 0.',
        },
        alignment: {
          type: 'string',
          enum: ['start', 'center', 'end', 'left', 'right', 'top', 'bottom'],
          description:
            "Where the group sits along the wall: 'center' (default), 'start'/'end' (the wall's endpoints), " +
            'or the side label of an adjoining wall to sit flush in that corner (e.g. wall "right" + ' +
            'alignment "top" is the back right corner in the top view).',
        },
        offsetMm: {
          type: 'number',
          description:
            'Extra distance in millimetres along the wall from the chosen alignment. Defaults to 0.',
        },
      },
      required: ['groupId', 'wall'],
    },
    timeoutMs: SNAPSHOT_CALL_TIMEOUT_MS,
  },
  {
    name: 'update-attribute',
    description:
      'Sets one attribute of a root module or sub module of a group in the plan. Attribute ids and allowed ' +
      'values are described in the masterData section of get-plan-context. Numeric values are passed as strings.',
    inputSchema: {
      type: 'object',
      properties: {
        rootModuleId: {
          type: 'string',
          description: 'The id of the root module.',
        },
        moduleId: {
          type: 'string',
          description:
            'The id of the sub module. Omit to change an attribute of the root module itself.',
        },
        attributeId: { type: 'string', description: 'The id of the attribute.' },
        value: {
          anyOf: [{ type: 'string' }, { type: 'boolean' }],
          description: 'The new value. Numbers are passed as strings.',
        },
      },
      required: ['rootModuleId', 'attributeId', 'value'],
    },
  },
  {
    name: 'get-price',
    description:
      'Calculates and returns the price/order data of the current planning situation.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get-order-data',
    description:
      'Returns the order data of the current planning situation without placing an order.',
    inputSchema: { type: 'object', properties: {} },
    timeoutMs: SNAPSHOT_CALL_TIMEOUT_MS,
  },
  {
    name: 'get-plan-images',
    description:
      'Renders the current plan and returns a perspective image and a top-view image, so the plan can be ' +
      'inspected visually. The top-view orientation matches the wall side labels of get-plan-context: a wall ' +
      "with side 'right' is at the right edge of the top image, 'top' at the upper edge.",
    inputSchema: { type: 'object', properties: {} },
    timeoutMs: SNAPSHOT_CALL_TIMEOUT_MS,
  },
];

const pageBridge = {
  page: null,
  pageUrl: '',
  nextCallId: 1,
  pendingCalls: new Map(),

  attachPage(response, url) {
    if (this.page && this.page !== response) {
      this.rejectPendingCalls('The example page was replaced by a newer one');
      this.page.end();
    }
    this.page = response;
    this.pageUrl = url;
    console.log(`[hi-mcp] page connected: ${url}`);
    response.on('close', () => {
      if (this.page === response) {
        console.log(`[hi-mcp] page disconnected: ${this.pageUrl}`);
        this.page = null;
        this.rejectPendingCalls('The example page disconnected');
      }
    });
  },

  rejectPendingCalls(reason) {
    for (const pendingCall of this.pendingCalls.values()) {
      clearTimeout(pendingCall.timeout);
      pendingCall.reject(new Error(reason));
    }
    this.pendingCalls.clear();
  },

  resolveResult(message) {
    const pendingCall = this.pendingCalls.get(message.id);
    if (!pendingCall) {
      return;
    }
    this.pendingCalls.delete(message.id);
    clearTimeout(pendingCall.timeout);
    if (message.ok) {
      pendingCall.resolve(message.result);
    } else {
      pendingCall.reject(new Error(message.error ?? 'Tool call failed'));
    }
  },

  call(tool, args, timeoutMs = DEFAULT_CALL_TIMEOUT_MS) {
    const page = this.page;
    if (!page || page.writableEnded) {
      throw new Error(
        'No HI example page connected. Open the example with the mcp=true query parameter ' +
          `(http://localhost:${PORT}/?mcp=true) and keep the tab open.`,
      );
    }
    const id = this.nextCallId++;
    console.log(
      `[hi-mcp] call ${id}: ${tool} ${JSON.stringify(args).slice(0, 400)}`,
    );
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCalls.delete(id);
        reject(new Error(`Tool call '${tool}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pendingCalls.set(id, { resolve, reject, timeout });
      page.write(
        `data: ${JSON.stringify({ kind: 'call', id, tool, args })}\n\n`,
      );
    });
  },
};

const stripDataUrlPrefix = (image) =>
  image.replace(/^data:image\/\w+;base64,/, '');

const textResult = (result) => ({
  content: [{ type: 'text', text: JSON.stringify(result ?? null, null, 2) }],
});

const callTool = async (name, args) => {
  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (!tool) {
    const error = new Error(`Tool ${name} not found`);
    error.jsonRpcCode = -32602;
    throw error;
  }
  if (name === 'get-authoring-rules') {
    return { content: [{ type: 'text', text: AUTHORING_RULES }] };
  }
  if (name === 'get-plan-images') {
    const images = await pageBridge.call(name, args, tool.timeoutMs);
    const content = [];
    for (const image of [images?.perspectiveImage, images?.topImage]) {
      if (image) {
        content.push({
          type: 'image',
          data: stripDataUrlPrefix(image),
          mimeType: 'image/png',
        });
      }
    }
    if (content.length === 0) {
      return textResult({ error: 'No images available' });
    }
    return { content };
  }
  return textResult(await pageBridge.call(name, args, tool.timeoutMs));
};

const handleJsonRpcRequest = async (message) => {
  const { method, params } = message;
  if (method === 'initialize') {
    const requestedVersion = params?.protocolVersion;
    return {
      protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)
        ? requestedVersion
        : SUPPORTED_PROTOCOL_VERSIONS[0],
      capabilities: { tools: {} },
      serverInfo: { name: 'hi-group-orchestrator', version: '0.1.0' },
      instructions: INSTRUCTIONS,
    };
  }
  if (method === 'ping') {
    return {};
  }
  if (method === 'tools/list') {
    return {
      tools: TOOLS.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      })),
    };
  }
  if (method === 'tools/call') {
    try {
      return await callTool(params?.name, params?.arguments ?? {});
    } catch (error) {
      if (error?.jsonRpcCode) {
        throw error;
      }
      return {
        content: [
          {
            type: 'text',
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      };
    }
  }
  const error = new Error(`Method not found: ${method}`);
  error.jsonRpcCode = -32601;
  throw error;
};

const readBody = (request) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
};

const handleMcp = async (request, response) => {
  if (request.method !== 'POST') {
    response.writeHead(405, { Allow: 'POST' });
    response.end();
    return;
  }
  let message;
  try {
    message = JSON.parse(await readBody(request));
  } catch {
    sendJson(response, 400, {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    });
    return;
  }
  if (message?.id === undefined) {
    // a notification (e.g. notifications/initialized) expects no response
    response.writeHead(202);
    response.end();
    return;
  }
  try {
    const result = await handleJsonRpcRequest(message);
    sendJson(response, 200, { jsonrpc: '2.0', id: message.id, result });
  } catch (error) {
    sendJson(response, 200, {
      jsonrpc: '2.0',
      id: message.id,
      error: {
        code: error?.jsonRpcCode ?? -32603,
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
};

const isAllowedPageOrigin = (request) => {
  const { origin } = request.headers;
  return (
    !origin ||
    origin === `http://localhost:${PORT}` ||
    origin === `http://127.0.0.1:${PORT}`
  );
};

const handleBridge = (request, response, requestUrl) => {
  if (!isAllowedPageOrigin(request)) {
    console.error(
      `[hi-mcp] rejected bridge request (origin: ${request.headers.origin})`,
    );
    response.writeHead(403);
    response.end();
    return;
  }
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
  });
  response.write(': connected\n\n');
  const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 25_000);
  response.on('close', () => clearInterval(heartbeat));
  pageBridge.attachPage(response, requestUrl.searchParams.get('url') ?? '');
};

const handleBridgeResult = async (request, response) => {
  if (!isAllowedPageOrigin(request)) {
    response.writeHead(403);
    response.end();
    return;
  }
  try {
    pageBridge.resolveResult(JSON.parse(await readBody(request)));
    response.writeHead(204);
    response.end();
  } catch {
    response.writeHead(400);
    response.end();
  }
};

const handleStatic = async (response, pathname) => {
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = normalize(join(STATIC_ROOT, relativePath));
  const contentType = STATIC_CONTENT_TYPES[extname(filePath)];
  if (!filePath.startsWith(STATIC_ROOT) || !contentType) {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found');
    return;
  }
  try {
    const content = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': contentType });
    response.end(content);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found');
  }
};

const httpServer = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://localhost:${PORT}`);
    if (requestUrl.pathname === '/mcp') {
      await handleMcp(request, response);
    } else if (requestUrl.pathname === '/bridge') {
      handleBridge(request, response, requestUrl);
    } else if (requestUrl.pathname === '/bridge/result') {
      await handleBridgeResult(request, response);
    } else if (request.method === 'GET') {
      await handleStatic(response, requestUrl.pathname);
    } else {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Not found');
    }
  } catch (error) {
    console.error('[hi-mcp] request failed', error);
    if (!response.headersSent) {
      response.writeHead(500, { 'Content-Type': 'text/plain' });
      response.end('Internal server error');
    }
  }
});

httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[hi-mcp] port ${PORT} is already in use - a previous instance is still running.`,
    );
    console.error(`[hi-mcp] stop it first: lsof -ti tcp:${PORT} | xargs kill`);
  } else {
    console.error('[hi-mcp] server failed to start', error);
  }
  process.exit(1);
});

const openInBrowser = (url) => {
  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd'
        : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { stdio: 'ignore', detached: true });
  child.on('error', () => {});
  child.unref();
};

httpServer.listen(PORT, () => {
  const exampleUrl = `http://localhost:${PORT}/?mcp=true`;
  console.log('');
  console.log('  HI group orchestrator MCP server ready');
  console.log('');
  console.log(`  ➜  Example:  ${exampleUrl}`);
  console.log(`  ➜  MCP:      http://localhost:${PORT}/mcp`);
  console.log('');
  console.log(
    '[hi-mcp] waiting for the example page (open it with the mcp=true query parameter)',
  );
  if (!process.argv.includes('--no-open')) {
    openInBrowser(exampleUrl);
  }
});
