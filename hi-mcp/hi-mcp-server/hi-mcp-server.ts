import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PlannerApi } from './planner-api';
import { toolExecutors } from './tool-executors';

const AUTHORING_RULES = `Authoring rules for pos groups:
- A group is { id?, libraryId?, placement?, roots: [...] }. A root module is an article pick and nothing else: { id, articleId, attributes? } plus one relation that names its neighbour (rightOf, leftOf, onTop, above or behind - see Relations below). The server ignores every other field - a position on a root or a group included - and drops roots marked isGenerated (worktop, toe kick - the library regenerates them). Every root position comes from its relation; the position of a new group comes from its placement. Groups returned by get-plan-context carry their docking as contextData instead - resubmit them as they are. Use a unique id of your choice for new roots (the planner regenerates it and remaps your docking references); keep the real ids of roots that already exist in a replaced group. Choose the articleId from the article catalog of get-plan-context: desc and category say what an article is and what it is for, dimensions give its size (per size attribute its id, its name - e.g. Width, Depth, Height - and its value in millimetres; a root in groups carries the same attribute ids among its attributes, and change-module-attribute with that attribute id, never its name, changes the size of a unit), dockingVectors the names of its docking vectors, subModules its fronts and appliances, cornerArticle true marks an article made for a room corner. Sub-modules come with the article - you author articles, their attributes and their relations, nothing else. attributes is an optional list of { id, value } overrides of that unit; a material for the whole kitchen - the fronts, the worktop, the carcase - goes into the group's attributes ({ id, value } entries beside roots), and the server sets it on every unit and on the worktop. Attribute ids and allowed values come from the masterData section (request it with include) or from find-attributes. Everything else the calculation needs is completed automatically from the article template.
- Every desc - of an article, a root, a module, an attribute and an attribute value - is authoritative: trust it for what that article, module or value is, and trust dimensions for how big an article is. Both are authoritative over the catalog images of the master data (imageUrl): never take the kind or the size of an article from a catalog image.
- One kitchen is one group. Every unit standing beside, above or back to back with another unit is a root of the SAME group, related to it; a new group carries one placement, and the planner derives every root position from the relations. Never create a second group to put units next to existing ones - units that belong together are related.
- Never author a position: roots are positioned by their relation only, a new group with placement only; a position on a root or a group is ignored.
- Relations: every root after the first names one neighbour of the same group by its id, with exactly one of these fields - the server builds the docking from it:
  rightOf: "<id>" - the unit stands right of that unit; leftOf: "<id>" - left of it (right and left as seen from the front of the units). A row is each unit rightOf the one before.
  onTop: "<id>" - the unit stands on top of that unit (stacking on a tall unit or a wall unit, also several levels); align: "left" (default), "right" or "back" says which edges line up, gapMm lifts it.
  above: "<id>" - a wall unit hanging above that floor unit, at the height of the wall units; gapMm sets the gap below the wall unit instead.
  behind: "<id>" - back to back with that unit, turned by 180 degrees (an island).
  A wall unit rightOf or leftOf a tall unit hangs beside it with the tops flush; further wall units and the range hood continue rightOf or leftOf each other. Without a tall unit, the first wall unit hangs above a floor unit and the next ones continue rightOf or leftOf it; a range hood without wall units hangs above the hob unit.
  A room corner (an L-shaped kitchen, "in the corner"): start the group with a corner article (cornerArticle true in the catalog), give the group a placement with the room corner point as posGroup and the rotation from the corner rules, and continue one row rightOf the corner article and the other row leftOf it - the complete payload is example 3. Prefer a corner article over butting two straight units together in a corner; a U-shaped kitchen continues a row with a second corner article.
  A root without a relation continues the row of its kind: right of the previous floor unit or wall unit in the list; corrections says so.
- Docking vectors: groups from get-plan-context show their docking as contextData - per root its ownDockingVector and the dockingVector of each root it names. RightBottom -> LeftBottom puts that root to the right, LeftBottom -> RightBottom to the left, a Top vector -> a Bottom vector on top, BackBottom -> BackBottom back to back. freeDockingVectors are the vectors a new unit can dock to; merge-article-into-group names them in dockTo.
- placement: { posGroup: [x, y, z], posRotationY, rootId? } positions a new group. posGroup is the room point of the group's back left bottom corner, in millimetres (y up, y = 0 on the floor; for a group of wall units only, their mounting height) - against a wall the wall's end (flush into the corner at the wall's end) or a point from end towards start, in a room corner the corner point. posRotationY is the rotation of the group in degrees, counter-clockwise as seen from above (in the top-view image) - against a wall the wall's facingRotationY; posRotationY is required, state 0 explicitly for no rotation. rootId is optional: with two corner articles in the group, set it to the corner article that goes into the corner posGroup names. Applied exactly once, when the group is created; a placement on a group that is already in the plan is not used (move it with place-group), and groups returned by get-plan-context never carry this field.
- Take posGroup and posRotationY from the walls instead of computing them. Every room of get-plan-context carries a walls array - per wall start and end (points [x, 0, z] on the floor, in the coordinates of posGroup), lengthMm, type and facingRotationY; use the walls of type wall. Against a wall: posRotationY = the wall's facingRotationY (the group's back faces the wall), and posGroup = end puts the group flush into the corner at the wall's end, the row running towards start. Along the wall: posGroup = end + d * (start - end) / lengthMm - centred: d = (lengthMm - group width) / 2; right end flush into the corner at the wall's start: d = lengthMm - group width; the group width is the sum of the unit widths of the row - dimensions in the catalog; position.footprint.widthMm of a loaded group gives it. A room corner is the point two walls share. Anywhere else (an island, the middle of the room, next to a door): any free point on the floor as posGroup, any posRotationY.
- Corners of a rectangular room (back = top, front = bottom in the top-view image), with the corner article in the corner: left back corner posRotationY 0 - the units rightOf the corner article run along the back wall to the right, the units leftOf it along the left wall to the front. left front 90 - rightOf along the left wall to the back, leftOf along the front wall to the right. right front 180 - rightOf along the front wall to the left, leftOf along the right wall to the back. right back 270 - rightOf along the right wall to the front, leftOf along the back wall to the left. This holds for both hands of corner article. Straight walls: back 0, left 90, front 180, right 270.
- Extending a kitchen: units next to an existing group are roots of that group, never a new group. Dock each new unit to a free docking vector of the root it continues (freeDockingVectors per root: a free LeftBottom takes the new root's RightBottom, a free RightBottom takes LeftBottom, a free Top vector takes the new root's Bottom vector) - one unit with merge-article-into-group, several at once by adding the picks, each with its relation, to the group from get-plan-context and resubmitting it with its id. A new group is only for a free stretch of wall or a free spot in the room - never position a new group against an existing one.
- To move an existing group against a wall or into a room corner, call place-group: the wall by side label or index, alignment start, center or end, or the side label of the adjoining wall to sit flush in that corner (wall right + alignment top is the back right corner), offsetMm along the wall. The group keeps its roots and docking.
- To change an existing group, use the command tools: merge-article-into-group docks one more unit to a free docking vector of a root, exchange-root-module replaces a unit and keeps its docking, delete-root-module removes a unit (units no longer docked together become separate groups where they stand), delete-group removes a group, change-module-attribute and change-group-attribute set attributes, merge-groups joins groups where they stand (nothing is moved, no docking is added). Every command keeps the group's position and returns the changed groups. To rebuild a group, take it from get-plan-context, change it, and resubmit it with its id and without placement via create-or-replace-groups - it keeps its position; keep the ids of the root modules you keep.
- Verify results numerically: the returned groups carry position (pos, rotationY, footprint) and per root the dockingVectors, the input attributes and the docking. Do not judge a position from a rendering alone.
- Read corrections and notLoaded in a result: corrections lists what the server changed in your input and has already applied; notLoaded lists the groups it could not build, with what to send instead.

Example 1 - "a row of three tall units along the right wall, from the back right corner" is ONE call, create-or-replace-groups. posGroup is the right wall's end point (the back right corner), posRotationY its facingRotationY (270 in a rectangular room):
{ "posGroups": [{ "libraryId": "<libraryId>", "placement": { "posGroup": [<end x of the right wall>, 0, <end z of the right wall>], "posRotationY": 270 }, "roots": [
  { "id": "u1", "articleId": "<articleId from the catalog>" },
  { "id": "u2", "articleId": "<articleId>", "rightOf": "u1" },
  { "id": "u3", "articleId": "<articleId>", "rightOf": "u2" }
] }] }

Example 2 - "a tall unit and two base units with a wall unit above each" is the same call with these roots - the wall units hang beside the tall unit with the tops flush:
  { "id": "t1", "articleId": "<tall unit>" },
  { "id": "b1", "articleId": "<base unit>", "rightOf": "t1" },
  { "id": "b2", "articleId": "<base unit>", "rightOf": "b1" },
  { "id": "w1", "articleId": "<wall unit>", "rightOf": "t1" },
  { "id": "w2", "articleId": "<wall unit>", "rightOf": "w1" }
Without the tall unit, the first wall unit hangs above a base unit: { "id": "w1", "articleId": "<wall unit>", "above": "b1" }.

Example 3 - "an L-shaped kitchen in the back right corner" (back = top in the top view) is ONE group starting with the corner article c1: posGroup is the room corner point (the shared point of the right and the back wall, taken from the walls array), posRotationY 270; the units rightOf c1 run along the right wall, the units leftOf it along the back wall (see the corner rules above):
{ "posGroups": [{ "libraryId": "<libraryId>", "placement": { "posGroup": [<corner x>, 0, <corner z>], "posRotationY": 270 }, "roots": [
  { "id": "c1", "articleId": "<corner article, cornerArticle true>" },
  { "id": "r1", "articleId": "<base unit>", "rightOf": "c1" },
  { "id": "r2", "articleId": "<base unit>", "rightOf": "r1" },
  { "id": "l1", "articleId": "<base unit>", "leftOf": "c1" },
  { "id": "l2", "articleId": "<base unit>", "leftOf": "l1" }
] }] }

Example 4 - "the row centred on the back wall": posRotationY 0 (the facingRotationY of the back wall) and posGroup = end + d * (start - end) / lengthMm of the back wall, with d = (lengthMm - <group width>) / 2.

Example 5 - "add a unit to the right of the existing cabinets" extends that group, never a new group: take the group from get-plan-context, find the root with a free RightBottom (freeDockingVectors) and call merge-article-into-group { "groupId": "<group id>", "articleId": "<unit>", "dockTo": { "rootId": "<that root>", "ownDockingVector": "RightBottom", "dockingVector": "LeftBottom" } } - the group keeps its position.`;

const INSTRUCTIONS = `This server orchestrates HOMAG Intelligence (HI) object groups in a live Roomle room-planner session (proof of concept).

Typical workflow:
1. get-plan-context: fetch the rooms (each with a derived walls array), the article catalog (desc, category, dimensions, docking vector names, sub-modules per article) and the groups currently in the plan. Add masterData to include for the attribute vocabulary, or look an attribute up with find-attributes.
2. create-or-replace-groups: author the whole kitchen as ONE group - article picks, each unit after the first naming its neighbour with one relation (rightOf, leftOf, onTop, above or behind), a material for the whole kitchen in the group's attributes, plus one placement for the new group ({ posGroup, posRotationY }: the room point of the group's back left corner and its rotation, taken from the walls array - a wall's end point and facingRotationY, or a room corner point with the rotation from the corner rules; a plan into a room corner starts with a corner article, cornerArticle true in the catalog). One call creates, relates and positions the group; never author root positions and never split a kitchen into several groups. A group whose id matches an existing group in the plan completely replaces that group and keeps its position; all other groups are created. Units next to an existing group are added to that group, docked to a free docking vector of the root they continue - a new group is only for a free stretch of wall. The payload format, the relations, the corner rules and complete examples are returned by get-authoring-rules.
3. Edit an existing group with the command tools: merge-article-into-group (dock one more unit), exchange-root-module (replace a unit), delete-root-module and delete-group, change-module-attribute and change-group-attribute (attributes, e.g. the front colour of the whole kitchen), merge-groups (join groups that stand next to each other); place-group moves a group to another wall or into a room corner. Resubmit a whole group with create-or-replace-groups only to rebuild it.
4. Check the result with get-price or get-order-data, and inspect it with get-plan-images.

${AUTHORING_RULES}`;

// The plan context carries a signed CDN image URL for every article, module
// and attribute value - three quarters of its tokens, and no agent can open them.
const withoutImageUrls = (key: string, value: unknown) =>
  key === 'imageUrl' ? undefined : value;

const textResult = (result: unknown) => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify(result ?? null, withoutImageUrls),
    },
  ],
});

const PLAN_CHANGING_TOOLS = [
  'create-or-replace-groups',
  'place-group',
  'change-module-attribute',
  'change-group-attribute',
  'delete-group',
  'delete-root-module',
  'merge-article-into-group',
  'exchange-root-module',
  'merge-groups',
];

const stripDataUrlPrefix = (image: string): string =>
  image.replace(/^data:image\/\w+;base64,/, '');

export const createHiMcpServer = (plannerApi: PlannerApi): McpServer => {
  const server = new McpServer(
    { name: 'hi-group-orchestrator', version: '0.1.0' },
    { instructions: INSTRUCTIONS }
  );

  // What the agent sent to a tool that changes the plan, and the feedback it
  // got, go to the log as one JSON line each, so a test run can tell what the
  // agent sent and which corrections and errors it saw. The arguments are
  // copied first: the tools correct their input in place. Every call of a
  // tool that changes the plan ends with one feedback or error line, empty
  // feedback included, so a test run can pair the lines in call order.
  const runTool = async (tool: string, args: Record<string, unknown>) => {
    console.log(`[hi-mcp] tool ${tool}`);
    const sent = structuredClone(args);
    if (PLAN_CHANGING_TOOLS.includes(tool)) {
      console.log(`[hi-mcp] tool ${tool} args ${JSON.stringify(sent)}`);
    }
    try {
      const result = (await toolExecutors[tool](plannerApi, args)) as any;
      const { corrections, notLoaded } = result ?? {};
      if (corrections || notLoaded || PLAN_CHANGING_TOOLS.includes(tool)) {
        console.log(
          `[hi-mcp] tool ${tool} feedback ${JSON.stringify({ corrections, notLoaded })}`
        );
      }
      return result;
    } catch (error) {
      console.log(
        `[hi-mcp] tool ${tool} error ${JSON.stringify({
          message: (error as Error)?.message ?? String(error),
          args: sent,
        })}`
      );
      throw error;
    }
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
        'name, desc, category, and per root module its master-data module, dimensions (the size attributes - ' +
        'e.g. Width, Depth, Height - with their values in millimetres), main attribute values, ' +
        'docking vector names, insert levels and sub-modules, plus cornerArticle ' +
        "for articles made for a room corner) and groups (the groups currently in the plan: position with pos - the room point of the group's back left bottom corner, as a placement names it - rotationY, rootId (only with two corner articles: the one pos belongs to) and footprint, and " +
        'per root the article pick with input attributes, docking, docking vector names and the free docking vectors ' +
        'a new root can dock to, plus its desc - no root positions, ' +
        'no geometry; a returned group is a valid create-or-replace-groups payload). masterData (per library the root ' +
        'modules and the customer-facing attributes with their allowed values; modules, attributes and values carry ' +
        'their desc) is returned only when included ' +
        'explicitly; the same compacted attribute vocabulary is searched by find-attributes. Every desc is ' +
        'authoritative and dimensions give the size - trust them over the catalog images (imageUrl). Use it before ' +
        'authoring or modifying groups.',
      inputSchema: {
        include: z
          .array(z.string())
          .optional()
          .describe(
            'The sections to include: masterData, rooms, articles, groups. Default: rooms, articles and groups. ' +
              'Add masterData for the attribute vocabulary.'
          ),
      },
    },
    async ({ include }) =>
      textResult(await runTool('get-plan-context', { include }))
  );

  server.registerTool(
    'find-attributes',
    {
      description:
        'Searches the attribute vocabulary of the loaded libraries by text (attribute id, name, description, ' +
        'group or selection name) and returns the matching attributes with their allowed values (each with ' +
        'its desc) and the root modules that carry them. The vocabulary is the compacted master data ' +
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
      textResult(await runTool('find-attributes', { text, libraryId }))
  );

  server.registerTool(
    'get-authoring-rules',
    {
      description:
        'Returns the authoring rules for pos groups: the payload format of create-or-replace-groups, the root ' +
        'module fields, how to position a new group with a placement and move an existing one with place-group, ' +
        'the relations a unit names its neighbour with (rightOf, leftOf, onTop, above, behind), the docking vector ' +
        'names of existing groups, and complete examples for a row against a wall, wall units beside a tall unit, ' +
        'an L-shaped corner kitchen and extending a group. Fetch this before authoring pos groups.',
      inputSchema: {},
    },
    async () => ({
      content: [{ type: 'text' as const, text: AUTHORING_RULES }],
    })
  );

  server.registerTool(
    'create-or-replace-groups',
    {
      description:
        'Creates or replaces HI object groups in the plan from an array of pos groups. Roots are article picks ' +
        '({ id, articleId, attributes? }) - the server completes them from the article template -, and every root ' +
        'after the first names its neighbour with one relation: rightOf, leftOf, onTop, above or behind with the ' +
        'id of the neighbour; the server builds the docking from it, and the planner arranges the root modules; never author root ' +
        'positions. Author one kitchen as ONE group: units beside, above or back to back with each other are ' +
        "related roots of the same group, never separately positioned groups; a material for the whole kitchen goes into the group's attributes. Position a new group in the same " +
        "call with placement ({ posGroup, posRotationY }: the room point of the group's back left corner and " +
        'its rotation; take them from a wall of get-plan-context: its end point and its facingRotationY put the ' +
        "group flush into the corner at the wall's end, a room corner point with the rotation from the corner " +
        'rules puts a corner kitchen into that corner). A group whose id matches an existing group completely ' +
        'replaces that group and keeps its position (root modules keep their ids when they already exist in ' +
        'the replaced group; a placement on it is not used); all other groups are created with regenerated ids. Returns the loaded object ids and the resulting groups - ' +
        'check their pos and footprint - plus corrections (what the server changed in the input) and notLoaded (the groups it ' +
        'could not build, with what to send instead). The payload format is returned by get-authoring-rules.',
      inputSchema: {
        posGroups: z
          .array(z.record(z.string(), z.unknown()))
          .min(1)
          .describe(
            'The pos groups to create or replace, following the rules returned by get-authoring-rules.'
          ),
      },
    },
    async ({ posGroups }) =>
      textResult(await runTool('create-or-replace-groups', { posGroups }))
  );

  server.registerTool(
    'place-group',
    {
      description:
        'Moves an existing group against a wall of a room or into a room corner and reloads it there: the ' +
        "server computes the position from the wall, the alignment and the group's calculated footprint; a " +
        'group with a corner article goes into the corner when the alignment names the adjoining wall. A ' +
        'target that overlaps another group moves along the wall to the nearest free position; corrections in ' +
        'the result say so. Name the wall by its side ' +
        'label (left/right/top/bottom as seen in the top-view image) or its index in the walls array of ' +
        'get-plan-context. Use it to move a group, or to position a group created without placement, against ' +
        'a wall or into a corner - never compute wall points for this yourself. Returns placedIn (corner or ' +
        'wall), the wall and the resulting group.',
      inputSchema: {
        groupId: z
          .string()
          .describe(
            'The id of the group to move. A unique id prefix is accepted.'
          ),
        wall: z
          .union([
            z.enum(['left', 'right', 'top', 'bottom', 'back', 'front']),
            z.number().int().min(0),
          ])
          .describe(
            "The target wall: a side label as seen in the top view ('right' places the group " +
              "against the longest wall on the right; 'back' is 'top', 'front' is 'bottom') or a wall " +
              'index from the walls array of get-plan-context.'
          ),
        roomIndex: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('The index of the room in the rooms array. Defaults to 0.'),
        alignment: z
          .enum([
            'start',
            'center',
            'end',
            'left',
            'right',
            'top',
            'bottom',
            'back',
            'front',
          ])
          .optional()
          .describe(
            "Where the group sits along the wall: 'center' (default), 'start'/'end' (the wall's endpoints), " +
              'or the side label of an adjoining wall to sit flush in that corner (e.g. wall "right" + ' +
              'alignment "top" is the back right corner in the top view).'
          ),
        offsetMm: z
          .number()
          .optional()
          .describe(
            'Extra distance in millimetres along the wall from the chosen alignment. Defaults to 0.'
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
        })
      )
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
            'The id of the sub module. Omit to change an attribute of the root module itself.'
          ),
        attributeId: z.string().describe('The id of the attribute.'),
        value: z
          .union([z.string(), z.number(), z.boolean()])
          .describe('The new value: a string, a number or a boolean.'),
      },
    },
    async (args) => textResult(await runTool('change-module-attribute', args))
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
          .union([z.string(), z.number(), z.boolean()])
          .describe('The new value: a string, a number or a boolean.'),
      },
    },
    async (args) => textResult(await runTool('change-group-attribute', args))
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
    async (args) => textResult(await runTool('delete-group', args))
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
    async (args) => textResult(await runTool('delete-root-module', args))
  );

  server.registerTool(
    'merge-article-into-group',
    {
      description:
        'Adds one unit to an existing group: docks a new root module of an article from the catalog to a ' +
        'free docking vector of a root of the group, the way the authoring rules describe docking. dockTo ' +
        "names the root the unit continues, that root's free vector (one of its freeDockingVectors in " +
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
            })
          )
          .optional()
          .describe('Attribute overrides of the new unit: [{ id, value }].'),
        dockTo: z
          .object({
            rootId: z
              .string()
              .describe(
                'The id of the root of the group the new unit docks to.'
              ),
            ownDockingVector: z
              .string()
              .describe("That root's free docking vector, e.g. RightBottom."),
            dockingVector: z
              .string()
              .describe(
                "The new unit's docking vector that meets it, e.g. LeftBottom."
              ),
            mode: z
              .enum(['StartStart', 'EndEnd', 'StartEnd', 'EndStart'])
              .optional()
              .describe(
                'Which endpoints of the two vectors coincide. Default StartStart.'
              ),
            offset: z
              .tuple([z.number(), z.number(), z.number()])
              .optional()
              .describe(
                '[x, y, z] in millimetres added after docking, e.g. [0, 600, 0] for a wall unit above. Default [0, 0, 0].'
              ),
          })
          .describe('Where the new unit docks.'),
      },
    },
    async (args) => textResult(await runTool('merge-article-into-group', args))
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
    async (args) => textResult(await runTool('exchange-root-module', args))
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
          .describe(
            'The id of the group the others are merged into. A unique id prefix is accepted.'
          ),
        groupIds: z
          .array(z.string())
          .min(1)
          .describe('The ids of the groups to merge into the target group.'),
      },
    },
    async (args) => textResult(await runTool('merge-groups', args))
  );

  server.registerTool(
    'get-price',
    {
      description:
        'Calculates and returns the price/order data of the current planning situation.',
      inputSchema: {},
    },
    async () => textResult(await runTool('get-price', {}))
  );

  server.registerTool(
    'get-order-data',
    {
      description:
        'Returns the order data of the current planning situation without placing an order.',
      inputSchema: {},
    },
    async () => textResult(await runTool('get-order-data', {}))
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
    }
  );

  return server;
};
