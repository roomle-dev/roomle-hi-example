import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PageBridge } from './page-bridge';
import { SNAPSHOT_CALL_TIMEOUT_MS } from './page-bridge';

const AUTHORING_RULES = `Authoring rules for pos groups:
- A group is { id?, libraryId?, placement?, repositioningData?, roots: [...] }. A root module is an article pick and nothing else: { id, articleId, attributes?, contextData? }. The server rejects a root that carries articlePos or rotationY and a group that carries pos or rotationY, ignores every other field, and drops roots marked isGenerated (worktop, toe kick - the library regenerates them). Every root position comes from the docking (contextData); the group position comes from placement or repositioningData. Groups returned by get-plan-context are in this shape - resubmit them as they are. Use a unique id of your choice for new roots (the planner regenerates it and remaps your docking and repositioning references); keep the real ids of roots that already exist in a replaced group. Choose the articleId from the article catalog of get-plan-context: desc and category say what an article is and what it is for, dimensions give its size, dockingVectors the names of its docking vectors, subModules its fronts and appliances, cornerArticle true marks an article made for a room corner. Sub-modules come with the article - you author articles, their attributes and their docking, nothing else. attributes is an optional list of { id, value } overrides; attribute ids and allowed values come from the masterData section (request it with include) or from find-attributes. Everything else the calculation needs is completed automatically from the article template.
- Never author a position: no articlePos or rotationY on a root, no pos or rotationY on a group - the payload is rejected. Roots are positioned by docking only; a group is positioned declaratively, with placement or repositioningData.
- placement: { wall, alignment?, offsetMm?, roomIndex? } on a group stands it against a wall in the same call. wall is a side label ('left'/'right'/'top'/'bottom' as seen in the top-view image; the longest wall on that side is used) or a wall index from the room's walls array. alignment is 'center' (default), 'start'/'end' (the wall's endpoints), or the side label of an adjoining wall to sit flush in that corner - e.g. wall: "right", alignment: "top" is the corner the right and top walls share. offsetMm shifts along the wall. With a corner article in the group, the side label of the adjoining wall as alignment puts the article's corner point exactly into that room corner and turns it so that both back edges lie along the two walls; without a corner article the group's footprint is placed flush into the corner.
- Extending a kitchen: units next to an existing group are roots of that group, never a new group. Take the group from get-plan-context, add the new picks, dock each to a free docking vector of the root it continues (freeDockingVectors per root: a free LeftBottom takes the new root's RightBottom, a free RightBottom takes LeftBottom, a free Top vector takes the new root's Bottom vector), and resubmit the group with its id. A new group with a placement is only for a free stretch of wall - a placement whose footprint meets another group is rejected, and the error names the group, the root and its free vectors to dock to.
- repositioningData: { posGroup: [x, y, z], posRotationY?, rootId, rootRelPos?, rootRelRotationY? } positions a group at a free point: the root module rootId ends up at posGroup (millimetres, y up, y = 0 on the floor) with yaw posRotationY (degrees), and the planner derives the group transform. Take coordinates from the walls array (wall start/end are pos-space points [x, 0, z] on the floor, in the coordinates of posGroup). rootRelPos/rootRelRotationY offset the target. Applied exactly once when the group loads; groups returned by get-plan-context never carry this field. Use either placement or repositioningData, not both.
- Docking (contextData) relates the root modules of a group to each other and is required: in a group with several roots, every additional root must be docked to a root that is already placed (undocked roots are rejected). Write the docking entry on the placed root (the anchor) and list the new root under dockedRoots - the anchor's own vector meets the named vector of the new root:
  { "id": "A", "articleId": "...", "contextData": { "dockedRoots": [{ "ownDockingVector": "RightBottom", "dockedRoots": [{ "id": "B", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }] }] } }
  puts B directly right of A. Chain it (A lists B, B lists C, ...) for a row; one anchor may carry several entries, one per own vector. Docking vector indices are resolved from the names automatically. An offset only takes effect in this direction - an entry written on the new root loses it.
- Docking vectors are named edges of a root module (dockInfos; the names per article are in the catalog as dockingVectors). Left and Right vectors lie on the side faces and run from the back to the front, Back vectors lie on the back face and run from left to right; Top and Bottom name the upper and lower edge; LeftBack and RightBack exist only on corner articles - they are the back edges of the two arms of an L-shaped corner module, and their start point is the article's corner point. Valid pairs, written as own vector of the anchor -> vector of the new root:
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
  room corner (an L-shaped kitchen, "in the corner"): start the group with a corner article C (cornerArticle true in the catalog), give the group placement { wall, alignment: <side label of the adjoining wall> }, and continue the rows along both walls from C's RightBottom (to the right) and LeftBottom (to the left) like from any other unit. Prefer a corner article over butting two straight units together in a corner.
- To move an existing group, call place-group (same wall/alignment/offset vocabulary as placement). To modify an existing group, take it from get-plan-context, change it, and resubmit it with its id via create-or-replace-groups; keep the ids of the root modules you keep. A replace re-applies placement and positions.
- Verify results numerically: the returned groups carry position (pos, rotationY, footprint) and per root the dockingVectors, the input attributes and the docking; logMessages entries with category Error mean the input is wrong (typically a bad articleId or attribute value). Do not judge placement from a rendering alone.

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

Third example - "a unit in the back right corner" (back = top in the top view): the same call with "placement": { "wall": "right", "alignment": "top" }. For an L-shaped kitchen in that corner make u1 a corner article and dock one row to its RightBottom and the other to its LeftBottom. The equivalent with repositioningData, anchoring root u1 at the corner point taken from the walls array: "repositioningData": { "posGroup": [<corner x>, 0, <corner z>], "posRotationY": 270, "rootId": "u1" }.`;

const INSTRUCTIONS = `This server orchestrates HOMAG Intelligence (HI) object groups in a live Roomle room-planner session (proof of concept).

Typical workflow:
1. get-plan-context: fetch the rooms (each with a derived walls array), the article catalog (desc, category, dimensions, docking vector names, sub-modules per article) and the groups currently in the plan. Add masterData to include for the attribute vocabulary, or look an attribute up with find-attributes.
2. create-or-replace-groups: author each group as article picks plus docking (the placed root lists the new root) plus a placement (wall side label; a plan into a room corner starts with a corner article, cornerArticle true in the catalog) - one call creates, docks and positions the group; never author coordinates. A group whose id matches an existing group in the plan completely replaces that group; all other groups are created. Units next to an existing group are added to that group, docked to a free docking vector of the root they continue - a new group is only for a free stretch of wall. The payload format, the docking pairs and the recipes are returned by get-authoring-rules.
3. place-group: move an existing group to another wall when asked.
4. Check the result with get-price or get-order-data, and inspect it with get-plan-images.

${AUTHORING_RULES}`;

const textResult = (result: unknown) => ({
  content: [
    { type: 'text' as const, text: JSON.stringify(result ?? null, null, 2) },
  ],
});

const stripDataUrlPrefix = (image: string): string =>
  image.replace(/^data:image\/\w+;base64,/, '');

export const createHiMcpServer = (bridge: PageBridge): McpServer => {
  const server = new McpServer(
    { name: 'hi-group-orchestrator', version: '0.1.0' },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    'get-plan-context',
    {
      description:
        'Returns a snapshot of the HI planning session, agent-ready as the planner API provides it - one coordinate ' +
        'system throughout: 3D, right-handed, Y up (group pos and room contours use pos: [x, level, -y]). Default ' +
        'sections: rooms (every room carries its contour levels with 3D segments and a derived walls array - per ' +
        'wall: a side label (left/right/top/bottom as seen in the top-view image), start/end [x, 0, z] in millimetres ' +
        '(the 3D contour points on the floor), lengthMm, type, heightMm, thicknessMm and the facingRotationY a ' +
        'group needs to stand against that wall), articles (compact catalog: articleId, name, ' +
        'desc, category, image, and per root module its master-data module, dimensions, main attribute values, ' +
        'docking vector names, insert levels and sub-modules, plus cornerArticle for articles made for a room ' +
        'corner) and groups (the groups currently in the plan: position with pos, rotationY and footprint, and ' +
        'per root the article pick with input attributes, docking, docking vector names and the free docking vectors ' +
        'a new root can dock to, plus its desc and imageUrl - no root positions, ' +
        'no geometry; a returned group is a valid create-or-replace-groups payload). masterData (per library the root ' +
        'modules and the customer-facing attributes with their allowed values; modules, attributes and values carry ' +
        'their desc and imageUrl, e.g. the swatch of a colour) is returned only when included ' +
        'explicitly; the same compacted attribute vocabulary is searched by find-attributes. Use it before ' +
        'authoring or modifying groups.',
      inputSchema: {
        include: z
          .array(z.enum(['masterData', 'rooms', 'articles', 'groups']))
          .optional()
          .describe(
            'The sections to include. Default: rooms, articles and groups. Add masterData for the attribute vocabulary.',
          ),
      },
    },
    async ({ include }) =>
      textResult(await bridge.call('get-plan-context', { include })),
  );

  server.registerTool(
    'find-attributes',
    {
      description:
        'Searches the attribute vocabulary of the loaded libraries by text (attribute id, name, description, ' +
        'group or selection name) and returns the matching attributes with their allowed values (each with ' +
        'desc and imageUrl) and the root modules that carry them. The vocabulary is the compacted master data ' +
        'of get-plan-context (root modules and their customer-facing attributes). Use it to find the attribute ' +
        'for a requested property, e.g. the front colour, and the value to set.',
      inputSchema: {
        text: z
          .string()
          .min(1)
          .describe('The text to search for, case-insensitive.'),
        libraryId: z
          .string()
          .optional()
          .describe('Restricts the search to one library.'),
      },
    },
    async ({ text, libraryId }) =>
      textResult(await bridge.call('find-attributes', { text, libraryId })),
  );

  server.registerTool(
    'get-authoring-rules',
    {
      description:
        'Returns the authoring rules for pos groups: the payload format of create-or-replace-groups, the root ' +
        'module fields, the placement options, the docking vectors with their valid pairs, mode and offset, and ' +
        'the recipes for a row, a wall unit above a base unit, an island and a corner. Fetch this before ' +
        'authoring pos groups.',
      inputSchema: {},
    },
    async () => ({
      content: [{ type: 'text' as const, text: AUTHORING_RULES }],
    }),
  );

  server.registerTool(
    'create-or-replace-groups',
    {
      description:
        'Creates or replaces HI object groups in the plan from an array of pos groups. Roots are article picks ' +
        'and nothing else ({ id, articleId, attributes?, contextData? }; a root with articlePos/rotationY or a group ' +
        'with pos/rotationY is rejected) - the server completes them from the article template, ' +
        'and the planner calculates and arranges the docked root modules (the docking vector names of an article ' +
        'are in the catalog as dockingVectors; the placed root lists the new root); never author coordinates. Position each ' +
        'group in the same call: placement ({ wall, alignment?, offsetMm? }) stands it against a wall or, with a ' +
        'corner article and the adjoining wall as alignment, puts its corner point into the room corner (a placement ' +
        'whose footprint meets another group is rejected - add the roots to that group instead); ' +
        'repositioningData places a root at a free point. A group whose id matches an existing group completely ' +
        'replaces that group (root modules keep their ids when they already exist in the replaced group); all ' +
        'other groups are created with regenerated ids. Returns the loaded object ids and the resulting groups - ' +
        'check their pos, footprint and any Error logMessages. The payload format is returned by get-authoring-rules.',
      inputSchema: {
        posGroups: z
          .array(z.record(z.string(), z.unknown()))
          .min(1)
          .describe(
            'The pos groups to create or replace, following the rules returned by get-authoring-rules.',
          ),
      },
    },
    async ({ posGroups }) =>
      textResult(
        await bridge.call(
          'create-or-replace-groups',
          { posGroups },
          SNAPSHOT_CALL_TIMEOUT_MS,
        ),
      ),
  );

  server.registerTool(
    'place-group',
    {
      description:
        'Places an existing group against a wall of a room: computes the group pos/rotationY from the wall, the ' +
        "alignment and the group's calculated footprint - a group with a corner article is placed by its corner " +
        'point when the alignment names the adjoining wall - then reloads the group there; a target that meets ' +
        'another group is rejected. Pick the wall from the ' +
        'walls array of get-plan-context by its side label (left/right/top/bottom as seen in the top-view image) ' +
        'and length, and pass its index. Use this after create-or-replace-groups to position a group - never ' +
        'author coordinates yourself. Returns the applied pos/rotationY, the footprint, the wall and the ' +
        'resulting group.',
      inputSchema: {
        groupId: z.string().describe('The id of the group to place.'),
        wall: z
          .union([
            z.enum(['left', 'right', 'top', 'bottom']),
            z.number().int().min(0),
          ])
          .describe(
            "The target wall: a side label as seen in the top view ('right' places the group " +
              'against the longest wall on the right) or a wall index from the walls array of ' +
              'get-plan-context.',
          ),
        roomIndex: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('The index of the room in the rooms array. Defaults to 0.'),
        alignment: z
          .enum(['start', 'center', 'end', 'left', 'right', 'top', 'bottom'])
          .optional()
          .describe(
            "Where the group sits along the wall: 'center' (default), 'start'/'end' (the wall's endpoints), " +
              'or the side label of an adjoining wall to sit flush in that corner (e.g. wall "right" + ' +
              'alignment "top" is the back right corner in the top view).',
          ),
        offsetMm: z
          .number()
          .optional()
          .describe(
            'Extra distance in millimetres along the wall from the chosen alignment. Defaults to 0.',
          ),
      },
    },
    async ({ groupId, wall, roomIndex, alignment, offsetMm }) =>
      textResult(
        await bridge.call(
          'place-group',
          { groupId, wall, roomIndex, alignment, offsetMm },
          SNAPSHOT_CALL_TIMEOUT_MS,
        ),
      ),
  );

  server.registerTool(
    'update-attribute',
    {
      description:
        'Sets one attribute of a root module or sub module of a group in the plan. Attribute ids and allowed ' +
        'values are described in the masterData section of get-plan-context. Numeric values are passed as strings.',
      inputSchema: {
        rootModuleId: z.string().describe('The id of the root module.'),
        moduleId: z
          .string()
          .optional()
          .describe(
            'The id of the sub module. Omit to change an attribute of the root module itself.',
          ),
        attributeId: z.string().describe('The id of the attribute.'),
        value: z
          .union([z.string(), z.boolean()])
          .describe('The new value. Numbers are passed as strings.'),
      },
    },
    async ({ rootModuleId, moduleId, attributeId, value }) =>
      textResult(
        await bridge.call('update-attribute', {
          rootModuleId,
          moduleId,
          attributeId,
          value,
        }),
      ),
  );

  server.registerTool(
    'get-price',
    {
      description:
        'Calculates and returns the price/order data of the current planning situation.',
      inputSchema: {},
    },
    async () => textResult(await bridge.call('get-price', {})),
  );

  server.registerTool(
    'get-order-data',
    {
      description:
        'Returns the order data of the current planning situation without placing an order.',
      inputSchema: {},
    },
    async () =>
      textResult(
        await bridge.call('get-order-data', {}, SNAPSHOT_CALL_TIMEOUT_MS),
      ),
  );

  server.registerTool(
    'get-plan-images',
    {
      description:
        'Renders the current plan and returns a perspective image and a top-view image, so the plan can be ' +
        'inspected visually. The top-view orientation matches the wall side labels of get-plan-context: a wall ' +
        "with side 'right' is at the right edge of the top image, 'top' at the upper edge.",
      inputSchema: {},
    },
    async () => {
      const images = (await bridge.call(
        'get-plan-images',
        {},
        SNAPSHOT_CALL_TIMEOUT_MS,
      )) as { perspectiveImage?: string; topImage?: string };
      const content = [];
      for (const image of [images.perspectiveImage, images.topImage]) {
        if (image) {
          content.push({
            type: 'image' as const,
            data: stripDataUrlPrefix(image),
            mimeType: 'image/png',
          });
        }
      }
      if (content.length === 0) {
        return textResult({ error: 'No images available' });
      }
      return { content };
    },
  );

  return server;
};
