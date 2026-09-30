import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PlannerApi } from './planner-api';
import { toolExecutors } from './tool-executors';

const AUTHORING_RULES = `Authoring rules for pos groups:
- A group is { id?, libraryId?, placement?, roots: [...] }. A root module is an article pick and nothing else: { id, articleId, attributes?, contextData? }. The server rejects a root that carries articlePos or rotationY and a group that carries pos or rotationY, ignores every other field, and drops roots marked isGenerated (worktop, toe kick - the library regenerates them). Every root position comes from the docking (contextData); the position of a new group comes from its placement. Groups returned by get-plan-context are in this shape - resubmit them as they are. Use a unique id of your choice for new roots (the planner regenerates it and remaps your docking references); keep the real ids of roots that already exist in a replaced group. Choose the articleId from the article catalog of get-plan-context: desc and category say what an article is and what it is for, dimensions give its size, dockingVectors the names of its docking vectors, subModules its fronts and appliances, cornerArticle true marks an article made for a room corner. Sub-modules come with the article - you author articles, their attributes and their docking, nothing else. attributes is an optional list of { id, value } overrides; attribute ids and allowed values come from the masterData section (request it with include) or from find-attributes. Everything else the calculation needs is completed automatically from the article template.
- One kitchen is one group. Every unit standing beside, above or back to back with another unit is a root of the SAME group, docked to it; a new group carries one placement, and the planner derives every root position from the docking. Never create a second group to put units next to existing ones, and never position two groups so that they touch - units that belong together are docked.
- Never author a position: no articlePos or rotationY on a root, no pos or rotationY on a group - the payload is rejected. Roots are positioned by docking only; a new group is positioned with placement only.
- Docking (contextData) relates the root modules of a group to each other and is required: in a group with several roots, every additional root must be docked to a root that is already placed (undocked roots are rejected). Write the docking entry on the placed root and list the new root under dockedRoots - the placed root's own vector meets the named vector of the new root:
  { "id": "A", "articleId": "...", "contextData": { "dockedRoots": [{ "ownDockingVector": "RightBottom", "dockedRoots": [{ "id": "B", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }] }] } }
  puts B directly right of A; the mirrored entry { "ownDockingVector": "LeftBottom", "dockedRoots": [{ "id": "B", "dockingVector": "RightBottom", "mode": "StartStart", "offset": [0, 0, 0] }] } written on A puts B directly left of A. Chain entries (A lists B, B lists C, ...) for a row; one placed root may carry several entries, one per own vector. Docking vector indices are resolved from the names automatically. An offset only takes effect in this direction - an entry written on the new root loses it.
- Docking vectors are named edges of a root module (dockInfos; the names per article are in the catalog as dockingVectors). Left and Right vectors lie on the side faces and run from the back to the front, Back vectors lie on the back face and run from left to right; Top and Bottom name the upper and lower edge; LeftBack and RightBack exist only on corner articles - they are the back edges of the two arms of an L-shaped corner module, and their start point is the article's corner point. Valid pairs, written as own vector of the placed root -> vector of the new root:
  beside: RightBottom -> LeftBottom (new root to the right), LeftBottom -> RightBottom (new root to the left).
  on top: LeftTop -> LeftBottom, RightTop -> RightBottom, BackTop -> BackBottom (the new root may be narrower or shallower).
  back to back: BackBottom -> BackBottom, BackTop -> BackTop (the new root is turned by 180 degrees; omit mode for these pairs).
  A root without docking vectors (a hood, for example) cannot be docked: give it its own group and position it with a placement.
- mode selects which endpoints of the two vectors coincide: StartStart (default) the start points - the backs for Left/Right vectors, the left edges for Back vectors; EndEnd the end points - the fronts, or the right edges; StartEnd and EndStart mix them. offset is a translation [x, y, z] in millimetres added to the new root after docking: y for the gap between a base unit and the wall unit above it, x for a gap in a row.
- Recipes (own vector of the placed root -> vector of the new root):
  row to the right: A -> B RightBottom -> LeftBottom, then B -> C the same way. row to the left: A -> B LeftBottom -> RightBottom.
  wall unit W above base unit A: A -> W LeftTop -> LeftBottom, offset [0, <gap between the top of A and the bottom of W>, 0].
  narrow wall unit right-aligned above a wide base unit: A -> W BackTop -> BackBottom, mode EndEnd, offset [0, <gap>, 0].
  worktop or any part lying directly on a unit: A -> T LeftTop -> LeftBottom, no offset.
  island: front unit A -> back unit B BackBottom -> BackBottom, no mode.
  room corner (an L-shaped kitchen, "in the corner"): start the group with a corner article C (cornerArticle true in the catalog), give the group a placement with the room corner point as posGroup and the rotation from the corner rules, and continue one row from C's RightBottom and the other row from C's LeftBottom like from any other unit - the complete payload is example 3. Prefer a corner article over butting two straight units together in a corner.
- placement: { posGroup: [x, y, z], posRotationY, rootId? } positions a new group. posGroup is the room point of the group's back left bottom corner, in millimetres (y up, y = 0 on the floor; for a group of wall units only, their mounting height) - against a wall the wall's end (flush into the corner at the wall's end) or a point from end towards start, in a room corner the corner point. posRotationY is the rotation of the group in degrees, counter-clockwise as seen from above (in the top-view image) - against a wall the wall's facingRotationY; posRotationY is required, state 0 explicitly for no rotation. rootId is optional: with two corner articles in the group, set it to the corner article that goes into the corner posGroup names. Applied exactly once, when the group is created; a placement on a group that is already in the plan is rejected (move it with place-group), and groups returned by get-plan-context never carry this field.
- Take posGroup and posRotationY from the walls instead of computing them. Every room of get-plan-context carries a walls array - per wall start and end (points [x, 0, z] on the floor, in the coordinates of posGroup), lengthMm, type and facingRotationY; use the walls of type wall. Against a wall: posRotationY = the wall's facingRotationY (the group's back faces the wall), and posGroup = end puts the group flush into the corner at the wall's end, the row running towards start. Along the wall: posGroup = end + d * (start - end) / lengthMm - centred: d = (lengthMm - group width) / 2; right end flush into the corner at the wall's start: d = lengthMm - group width; the group width is the sum of the unit widths of the row plus any x docking offsets (gaps) between them - dimensions in the catalog; position.footprint.widthMm of a loaded group already includes the gaps. A room corner is the point two walls share. Anywhere else (an island, the middle of the room, next to a door): any free point on the floor as posGroup, any posRotationY.
- Corners of a rectangular room (back = top, front = bottom in the top-view image), with the corner article in the corner: left back corner posRotationY 0 - the RightBottom row runs along the back wall to the right, the LeftBottom row along the left wall to the front. left front 90 - RightBottom along the left wall to the back, LeftBottom along the front wall to the right. right front 180 - RightBottom along the front wall to the left, LeftBottom along the right wall to the back. right back 270 - RightBottom along the right wall to the front, LeftBottom along the back wall to the left. Straight walls: back 0, left 90, front 180, right 270.
- Extending a kitchen: units next to an existing group are roots of that group, never a new group. Dock each new unit to a free docking vector of the root it continues (freeDockingVectors per root: a free LeftBottom takes the new root's RightBottom, a free RightBottom takes LeftBottom, a free Top vector takes the new root's Bottom vector) - one unit with merge-article-into-group, several at once by adding the picks to the group from get-plan-context and resubmitting it with its id. A new group is only for a free stretch of wall or a free spot in the room - never position a new group against an existing one.
- To move an existing group against a wall or into a room corner, call place-group: the wall by side label or index, alignment start, center or end, or the side label of the adjoining wall to sit flush in that corner (wall right + alignment top is the back right corner), offsetMm along the wall. The group keeps its roots and docking.
- To change an existing group, use the command tools: merge-article-into-group docks one more unit to a free docking vector of a root, exchange-root-module replaces a unit and keeps its docking, delete-root-module removes a unit (units no longer docked together become separate groups where they stand), delete-group removes a group, change-module-attribute and change-group-attribute set attributes, merge-groups joins groups where they stand (nothing is moved, no docking is added). Every command keeps the group's position and returns the changed groups. To rebuild a group, take it from get-plan-context, change it, and resubmit it with its id and without placement via create-or-replace-groups - it keeps its position; keep the ids of the root modules you keep.
- Verify results numerically: the returned groups carry position (pos, rotationY, footprint) and per root the dockingVectors, the input attributes and the docking; logMessages entries with category Error mean the input is wrong (typically a bad articleId or attribute value). Do not judge a position from a rendering alone.

Example 1 - "a row of three tall units along the right wall, from the back right corner" is ONE call, create-or-replace-groups. posGroup is the right wall's end point (the back right corner), posRotationY its facingRotationY (270 in a rectangular room):
{ "posGroups": [{ "libraryId": "<libraryId>", "placement": { "posGroup": [<end x of the right wall>, 0, <end z of the right wall>], "posRotationY": 270 }, "roots": [
  { "id": "u1", "articleId": "<articleId from the catalog>", "contextData": { "dockedRoots": [{ "ownDockingVector": "RightBottom", "dockedRoots": [{ "id": "u2", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }] }] } },
  { "id": "u2", "articleId": "<articleId>", "contextData": { "dockedRoots": [{ "ownDockingVector": "RightBottom", "dockedRoots": [{ "id": "u3", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }] }] } },
  { "id": "u3", "articleId": "<articleId>" }
] }] }

Example 2 - "two base units with a wall unit above each" is the same call with these roots (600 is the gap between the top of the base units and the bottom of the wall units):
  { "id": "b1", "articleId": "<base unit>", "contextData": { "dockedRoots": [
    { "ownDockingVector": "RightBottom", "dockedRoots": [{ "id": "b2", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }] },
    { "ownDockingVector": "LeftTop", "dockedRoots": [{ "id": "w1", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 600, 0] }] } ] } },
  { "id": "b2", "articleId": "<base unit>", "contextData": { "dockedRoots": [{ "ownDockingVector": "LeftTop", "dockedRoots": [{ "id": "w2", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 600, 0] }] }] } },
  { "id": "w1", "articleId": "<wall unit>" },
  { "id": "w2", "articleId": "<wall unit>" }

Example 3 - "an L-shaped kitchen in the back right corner" (back = top in the top view) is ONE group starting with the corner article c1: posGroup is the room corner point (the shared point of the right and the back wall, taken from the walls array), posRotationY 270; the row on c1's RightBottom runs along the right wall, the row on its LeftBottom along the back wall (see the corner rules above):
{ "posGroups": [{ "libraryId": "<libraryId>", "placement": { "posGroup": [<corner x>, 0, <corner z>], "posRotationY": 270 }, "roots": [
  { "id": "c1", "articleId": "<corner article, cornerArticle true>", "contextData": { "dockedRoots": [
    { "ownDockingVector": "RightBottom", "dockedRoots": [{ "id": "r1", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }] },
    { "ownDockingVector": "LeftBottom", "dockedRoots": [{ "id": "l1", "dockingVector": "RightBottom", "mode": "StartStart", "offset": [0, 0, 0] }] } ] } },
  { "id": "r1", "articleId": "<base unit>", "contextData": { "dockedRoots": [{ "ownDockingVector": "RightBottom", "dockedRoots": [{ "id": "r2", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }] }] } },
  { "id": "r2", "articleId": "<base unit>" },
  { "id": "l1", "articleId": "<base unit>", "contextData": { "dockedRoots": [{ "ownDockingVector": "LeftBottom", "dockedRoots": [{ "id": "l2", "dockingVector": "RightBottom", "mode": "StartStart", "offset": [0, 0, 0] }] }] } },
  { "id": "l2", "articleId": "<base unit>" }
] }] }

Example 4 - "the row centred on the back wall": posRotationY 0 (the facingRotationY of the back wall) and posGroup = end + d * (start - end) / lengthMm of the back wall, with d = (lengthMm - <group width>) / 2.

Example 5 - "add a unit to the right of the existing cabinets" extends that group, never a new group: take the group from get-plan-context, find the root with a free RightBottom (freeDockingVectors) and call merge-article-into-group { "groupId": "<group id>", "articleId": "<unit>", "dockTo": { "rootId": "<that root>", "ownDockingVector": "RightBottom", "dockingVector": "LeftBottom" } } - the group keeps its position.`;

const INSTRUCTIONS = `This server orchestrates HOMAG Intelligence (HI) object groups in a live Roomle room-planner session (proof of concept).

Typical workflow:
1. get-plan-context: fetch the rooms (each with a derived walls array), the article catalog (desc, category, dimensions, docking vector names, sub-modules per article) and the groups currently in the plan. Add masterData to include for the attribute vocabulary, or look an attribute up with find-attributes.
2. create-or-replace-groups: author the whole kitchen as ONE group - article picks plus docking (every unit beside, above or back to back is docked to its neighbour; the placed root lists the new root) plus one placement for the new group ({ posGroup, posRotationY }: the room point of the group's back left corner and its rotation, taken from the walls array - a wall's end point and facingRotationY, or a room corner point with the rotation from the corner rules; a plan into a room corner starts with a corner article, cornerArticle true in the catalog). One call creates, docks and positions the group; never author root positions and never split a kitchen into several groups. A group whose id matches an existing group in the plan completely replaces that group and keeps its position; all other groups are created. Units next to an existing group are added to that group, docked to a free docking vector of the root they continue - a new group is only for a free stretch of wall. The payload format, the docking pairs, the corner rules and complete examples are returned by get-authoring-rules.
3. Edit an existing group with the command tools: merge-article-into-group (dock one more unit), exchange-root-module (replace a unit), delete-root-module and delete-group, change-module-attribute and change-group-attribute (attributes, e.g. the front colour of the whole kitchen), merge-groups (join groups that stand next to each other); place-group moves a group to another wall or into a room corner. Resubmit a whole group with create-or-replace-groups only to rebuild it.
4. Check the result with get-price or get-order-data, and inspect it with get-plan-images.

${AUTHORING_RULES}`;

const textResult = (result: unknown) => ({
  content: [
    { type: 'text' as const, text: JSON.stringify(result ?? null, null, 2) },
  ],
});

const stripDataUrlPrefix = (image: string): string =>
  image.replace(/^data:image\/\w+;base64,/, '');

export const createHiMcpServer = (plannerApi: PlannerApi): McpServer => {
  const server = new McpServer(
    { name: 'hi-group-orchestrator', version: '0.1.0' },
    { instructions: INSTRUCTIONS },
  );

  const runTool = (tool: string, args: Record<string, unknown>) => {
    console.log(`[hi-mcp] tool ${tool}`);
    return toolExecutors[tool](plannerApi, args);
  };

  server.registerTool(
    'get-plan-context',
    {
      description:
        'Returns a snapshot of the HI planning session, agent-ready as the planner API provides it - one coordinate ' +
        'system throughout: 3D, right-handed, Y up (group pos and room contours use pos: [x, level, -y]). Default ' +
        'sections: rooms (every room carries its contour levels with 3D segments and a derived walls array - per ' +
        'wall: a side label (left/right/top/bottom as seen in the top-view image), start/end [x, 0, z] in millimetres ' +
        '(the 3D contour points on the floor), lengthMm, type, heightMm, thicknessMm and facingRotationY - the ' +
        'posRotationY of a group standing with its back against that wall), articles (compact catalog: articleId, ' +
        'name, desc, category, image, and per root module its master-data module, dimensions, main attribute values, ' +
        'docking vector names, insert levels and sub-modules, plus cornerArticle ' +
        'for articles made for a room corner) and groups (the groups currently in the plan: position with pos, rotationY and footprint, and ' +
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
      textResult(await runTool('get-plan-context', { include })),
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
      textResult(await runTool('find-attributes', { text, libraryId })),
  );

  server.registerTool(
    'get-authoring-rules',
    {
      description:
        'Returns the authoring rules for pos groups: the payload format of create-or-replace-groups, the root ' +
        'module fields, how to position a new group with a placement and move an existing one with place-group, ' +
        'the docking vectors with their valid ' +
        'pairs, mode and offset, and complete examples for a row against a wall, wall units above base units, ' +
        'an L-shaped corner kitchen and extending a group. Fetch this before authoring pos groups.',
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
        'are in the catalog as dockingVectors; the placed root lists the new root); never author root ' +
        'positions. Author one kitchen as ONE group: units beside, above or back to back with each other are ' +
        'docked roots of the same group, never separately positioned groups. Position a new group in the same ' +
        "call with placement ({ posGroup, posRotationY }: the room point of the group's back left corner and " +
        'its rotation; take them from a wall of get-plan-context: its end point and its facingRotationY put the ' +
        "group flush into the corner at the wall's end, a room corner point with the rotation from the corner " +
        'rules puts a corner kitchen into that corner). A group whose id matches an existing group completely ' +
        'replaces that group and keeps its position (root modules keep their ids when they already exist in ' +
        'the replaced group; a placement on it is rejected); all other groups are created with regenerated ids. Returns the loaded object ids and the resulting groups - ' +
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
      textResult(await runTool('create-or-replace-groups', { posGroups })),
  );

  server.registerTool(
    'place-group',
    {
      description:
        'Moves an existing group against a wall of a room or into a room corner and reloads it there: the ' +
        "server computes the position from the wall, the alignment and the group's calculated footprint; a " +
        'group with a corner article goes into the corner when the alignment names the adjoining wall. A ' +
        'target that meets another group is rejected and the group is not moved. Name the wall by its side ' +
        'label (left/right/top/bottom as seen in the top-view image) or its index in the walls array of ' +
        'get-plan-context. Use it to move a group, or to position a group created without placement, against ' +
        'a wall or into a corner - never compute wall points for this yourself. Returns placedIn (corner or ' +
        'wall), the wall and the resulting group.',
      inputSchema: {
        groupId: z
          .string()
          .describe('The id of the group to move. A unique id prefix is accepted.'),
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
        await runTool('place-group', {
          groupId,
          wall,
          roomIndex,
          alignment,
          offsetMm,
        }),
      ),
  );

  server.registerTool(
    'change-module-attribute',
    {
      description:
        'Sets one attribute of a root module of a group in the plan, or of one of its sub modules, and ' +
        'recalculates the group. The ids are the ones get-plan-context shows (a sub module by its id in ' +
        'subModules); attribute ids and allowed values come from the masterData section of get-plan-context ' +
        'or from find-attributes. Returns the changed group.',
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
    async (args) => textResult(await runTool('change-module-attribute', args)),
  );

  server.registerTool(
    'change-group-attribute',
    {
      description:
        'Sets one attribute on every module of a group that has it - the root modules and their sub ' +
        'modules, e.g. the front colour of a whole kitchen - in one recalculation. Returns the changed ' +
        'group and the ids of the changed modules.',
      inputSchema: {
        groupId: z
          .string()
          .describe('The id of the group. A unique id prefix is accepted.'),
        attributeId: z.string().describe('The id of the attribute.'),
        value: z
          .union([z.string(), z.boolean()])
          .describe('The new value. Numbers are passed as strings.'),
      },
    },
    async (args) => textResult(await runTool('change-group-attribute', args)),
  );

  server.registerTool(
    'delete-group',
    {
      description:
        'Removes a group with all its units from the plan. Returns the id of the removed group.',
      inputSchema: {
        groupId: z
          .string()
          .describe('The id of the group. A unique id prefix is accepted.'),
      },
    },
    async (args) => textResult(await runTool('delete-group', args)),
  );

  server.registerTool(
    'delete-root-module',
    {
      description:
        'Removes one root module (one unit) from its group. Units that are no longer docked together ' +
        'afterwards become separate groups where they stand; removing the only unit removes the group. ' +
        'Generated roots (worktop, toe kick) cannot be removed - the library regenerates them. Returns the ' +
        'remaining groups.',
      inputSchema: {
        rootModuleId: z.string().describe('The id of the root module.'),
      },
    },
    async (args) => textResult(await runTool('delete-root-module', args)),
  );

  server.registerTool(
    'merge-article-into-group',
    {
      description:
        'Adds one unit to an existing group: docks a new root module of an article from the catalog to a ' +
        'free docking vector of a root of the group, the way the authoring rules describe docking. dockTo ' +
        'names the root the unit continues, that root\'s free vector (one of its freeDockingVectors in ' +
        "get-plan-context) and the new unit's vector: RightBottom -> LeftBottom puts it to the right, " +
        'LeftBottom -> RightBottom to the left, LeftTop -> LeftBottom with offset [0, <gap>, 0] above. The ' +
        'group keeps its position. Returns the changed group.',
      inputSchema: {
        groupId: z
          .string()
          .describe('The id of the group. A unique id prefix is accepted.'),
        articleId: z.string().describe('The article id from the catalog.'),
        attributes: z
          .array(
            z.object({
              id: z.string(),
              value: z.union([z.string(), z.number(), z.boolean()]),
            }),
          )
          .optional()
          .describe('Attribute overrides of the new unit: [{ id, value }].'),
        dockTo: z
          .object({
            rootId: z
              .string()
              .describe('The id of the root of the group the new unit docks to.'),
            ownDockingVector: z
              .string()
              .describe("That root's free docking vector, e.g. RightBottom."),
            dockingVector: z
              .string()
              .describe("The new unit's docking vector that meets it, e.g. LeftBottom."),
            mode: z
              .enum(['StartStart', 'EndEnd', 'StartEnd', 'EndStart'])
              .optional()
              .describe('Which endpoints of the two vectors coincide. Default StartStart.'),
            offset: z
              .tuple([z.number(), z.number(), z.number()])
              .optional()
              .describe(
                '[x, y, z] in millimetres added after docking, e.g. [0, 600, 0] for a wall unit above. Default [0, 0, 0].',
              ),
          })
          .describe('Where the new unit docks.'),
      },
    },
    async (args) => textResult(await runTool('merge-article-into-group', args)),
  );

  server.registerTool(
    'exchange-root-module',
    {
      description:
        'Replaces one root module (one unit) of a group with an article from the catalog that has one root ' +
        'module, e.g. a base unit with a drawer unit; the new unit takes over the position and the docking ' +
        'of the replaced one. Returns the changed group.',
      inputSchema: {
        groupId: z
          .string()
          .describe('The id of the group. A unique id prefix is accepted.'),
        rootModuleId: z
          .string()
          .describe('The id of the root module to replace.'),
        articleId: z.string().describe('The article id from the catalog.'),
      },
    },
    async (args) => textResult(await runTool('exchange-root-module', args)),
  );

  server.registerTool(
    'merge-groups',
    {
      description:
        'Joins groups into one: the groups in groupIds are merged into the target group where they stand, ' +
        'like the merge action of the planner - nothing is moved and no docking is added, so merge groups ' +
        'that already stand next to each other. Groups of different libraries cannot be merged. To add a unit ' +
        'next to a group, use merge-article-into-group instead. Returns the merged group and the ids of the ' +
        'groups merged into it.',
      inputSchema: {
        targetGroupId: z
          .string()
          .describe('The id of the group the others are merged into. A unique id prefix is accepted.'),
        groupIds: z
          .array(z.string())
          .min(1)
          .describe('The ids of the groups to merge into the target group.'),
      },
    },
    async (args) => textResult(await runTool('merge-groups', args)),
  );

  server.registerTool(
    'get-price',
    {
      description:
        'Calculates and returns the price/order data of the current planning situation.',
      inputSchema: {},
    },
    async () => textResult(await runTool('get-price', {})),
  );

  server.registerTool(
    'get-order-data',
    {
      description:
        'Returns the order data of the current planning situation without placing an order.',
      inputSchema: {},
    },
    async () => textResult(await runTool('get-order-data', {})),
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
      const images = (await runTool('get-plan-images', {})) as {
        perspectiveImage?: string;
        topImage?: string;
      };
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
