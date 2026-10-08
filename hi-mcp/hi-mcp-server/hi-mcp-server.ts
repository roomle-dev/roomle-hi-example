import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PlannerApi } from './planner-api';
import { toolExecutors } from './tool-executors';

const AUTHORING_RULES = `Authoring rules for pos groups:
- Words: the catalog offers articles - cabinets, wardrobes, appliances, panels. A group is one piece of furniture made of articles: a kitchen, a wardrobe, a sideboard, a utility room, a row of cabinets. An article placed in a group is a root module (root for short); the user may call it a cabinet, a unit or a module. The kind of an article follows the catalog's category and dimensions: a high or tall cabinet or a wardrobe is about 2000 mm high, a low cabinet or base cabinet about 720 mm high and stands on the floor, a wall cabinet hangs on the wall. The user decides which articles stand next to each other: a low cabinet between two high cabinets is an order like any other. When the user names a kind, not an article, take the article of that kind from the category of its neighbours where that category has one (a kitchen cabinet into a kitchen, a wardrobe into a wardrobe), else the closest kind of another category.
- A group is { id?, libraryId?, placement?, roots: [...] }. A root module is an article pick and nothing else: { id, articleId, attributes? } plus one relation that names its neighbour (rightOf, leftOf, onTop, above or behind - see Relations below). The server ignores every other field - a position on a root or a group included - and drops roots marked isGenerated (worktop, toe kick - the library regenerates them). Every root position comes from its relation; the position of a new group comes from its placement. Groups returned by get-plan-context carry their docking as contextData instead - resubmit them as they are. Use a unique id of your choice for new roots (the planner regenerates it and remaps your docking references); keep the real ids of roots that already exist in a replaced group. Choose the articleId from the article catalog of get-plan-context: desc and category say what an article is and what it is for, dimensions give its size (per size attribute its id, its name - e.g. Width, Depth, Height - and its value in millimetres; a root in groups carries the same attribute ids among its attributes, and change-module-attribute with that attribute id, never its name, changes the size of a root module; an article of another size - "a 900 mm cabinet" - is the same article with that attribute set, which merge-article-into-group, insert-article-into-group and exchange-root-module take in their attributes), dockingVectors the names of its docking vectors, subModules its fronts and appliances, cornerArticle true marks an article made for a room corner. Sub-modules come with the article - you author articles, their attributes and their relations, nothing else. attributes is an optional list of { id, value } overrides of that root module; a material for the whole group - the fronts, the worktop, the carcase - goes into the group's attributes ({ id, value } entries beside roots), and the server sets it on every root module and on the worktop. Attribute ids and allowed values come from the masterData section (request it with include) or from find-attributes. Everything else the calculation needs is completed automatically from the article template.
- Every desc - of an article, a root, a module, an attribute and an attribute value - is authoritative: trust it for what that article, module or value is, and trust dimensions for how big an article is. A colour code in the desc of an attribute value - Cloudy blue (#506080) - is the colour of that value: take it as it is, and tell light from dark and one hue from another by it, not by the name. All of them are authoritative over the catalog images of the master data (imageUrl): never take the kind or the size of an article, or the colour of a value, from a catalog image. A desc says what an article is, not where the user may put it.
- One piece of furniture is one group. Every article standing beside, above or back to back with another article is a root module of the SAME group, related to it; a new group carries one placement, and the planner derives every root position from the relations. Never create a second group to put articles next to existing ones - articles that belong together are related.
- Never author a position: roots are positioned by their relation only, a new group with placement only; a position on a root or a group is ignored.
- Relations: every root after the first names one neighbour of the same group by its id, with exactly one of these fields - the server builds the docking from it:
  rightOf: "<id>" - the article stands right of that root module; leftOf: "<id>" - left of it (right and left as seen from the front). A row is each root module rightOf the one before.
  onTop: "<id>" - the article stands on top of that root module (stacking on a tall unit or a wall unit, also several levels); align: "left" (default), "right" or "back" says which edges line up, gapMm lifts it.
  above: "<id>" - a wall unit hanging above that floor-standing root module, at the height of the wall units; gapMm sets the gap below the wall unit instead.
  behind: "<id>" - back to back with that root module, turned by 180 degrees (an island).
  A wall unit rightOf or leftOf a tall unit hangs beside it with the tops flush, on the side of the base units (leftOf a tall unit that ends the row on the right); further wall units and the range hood continue rightOf or leftOf each other. Without a tall unit, the first wall unit hangs above a floor unit and the next ones continue rightOf or leftOf it; a range hood without wall units hangs above the hob unit.
  A room corner (an L-shaped kitchen, "in the corner"): start the group with a corner article (cornerArticle true in the catalog), give the group a placement at one wall of that corner with the other wall as alignment (the back right corner: wall right, alignment back), and continue one row rightOf the corner article and the other row leftOf it - the complete payload is example 3. The wall units of each leg hang above the floor units of that leg: the first one above a floor unit of the leg, the next ones rightOf or leftOf it; never put a wall unit on or above the corner article. Prefer a corner article over butting two straight articles together in a corner; a U-shaped kitchen continues a row with a second corner article.
  A root without a relation continues the row of its kind: right of the previous floor-standing root module or wall unit in the list; corrections says so.
- Docking vectors: groups from get-plan-context show their docking as contextData - per root its ownDockingVector and the dockingVector of each root it names. RightBottom -> LeftBottom puts that root to the right, LeftBottom -> RightBottom to the left, a Top vector -> a Bottom vector on top, BackBottom -> BackBottom back to back. Two root modules that name each other with RightBottom -> LeftBottom stand side by side. freeDockingVectors are the vectors a new root module can dock to; merge-article-into-group names them in dockTo.
- placement positions a new group, in one of two forms. At a wall or in a room corner: { wall, alignment?, offsetMm?, roomIndex? } - wall a side label (left, right, back, front; back = top, front = bottom in the top-view image) or the index of a wall in the walls array; alignment center (the default), the side label of the adjoining wall to stand flush in the corner the two walls share (wall back with alignment right: the back right corner; with two corner articles the first one in roots goes into the corner), or end; offsetMm moves the group along the wall away from that corner or from the wall's end; roomIndex the room, 0 by default. The server computes the point and the rotation from the calculated group, as place-group does; a group that would overlap another group moves along the wall to the nearest free place, and corrections say so. Anywhere else - an island, the middle of the room - and for a group of wall units only: { posGroup: [x, y, z], posRotationY, rootId? } - posGroup the room point of the group's back left bottom corner in millimetres (y up, y = 0 on the floor; for a group of wall units only, their mounting height), posRotationY its rotation in degrees, counter-clockwise as seen from above (in the top-view image), required, 0 for no rotation; rootId optional: with two corner articles, the one that goes into the corner posGroup names. A placement is applied exactly once, when the group is created; a placement on a group that is already in the plan is not used (move it with place-group), and groups returned by get-plan-context never carry this field.
- Walls: every room of get-plan-context carries a walls array - per wall its index, side, name (back wall, front wall, left wall, right wall), start and end (points [x, 0, z] on the floor, in the coordinates of posGroup), lengthMm, type and facingRotationY, the posRotationY of a group with its back against that wall (back 0, left 90, front 180, right 270 in a rectangular room); use the walls of type wall (an entry of type opening is a door). For a group anywhere else (an island, the middle of the room, next to a door): any point on the floor that obstacles leaves free as posGroup, any posRotationY.
- Room corners: every room of get-plan-context carries a corners list - per corner its name (back left, back right, front left, front right; back = top, front = bottom in the top-view image) and its point. A group in a room corner names one of the two walls as wall and the other as alignment; a corner article first in the group goes into the corner. Looking into the corner from the room, the root modules rightOf the corner article run along the wall on the right, the root modules leftOf it along the wall on the left (the back right corner: rightOf along the right wall, leftOf along the back wall). This holds for both hands of corner article.
- Obstacles: the obstacles section of get-plan-context lists what stands in the room, in the coordinates of the walls - objects (doors, windows, other furniture) with kind, outline (floor points [x, 0, z]) and bottomMm to topMm, a door or a window also with roomIndex, wall (its index in the walls array) and fromEndMm, its span along that wall measured from the wall's end -, and per group its root modules with id, outline and bottomMm to topMm. Put a new group on a stretch of wall or a spot that obstacles leaves free: fromEndMm is measured from the wall's end, so a placement with that wall, alignment end and offsetMm = the start of a free stretch puts the group on it; base units lower than a window's bottomMm fit below it. The result's hint names every root module that overlaps an object or another group or stands in front of a door or a window, with the free stretches of its wall.
- Extending a group: articles next to an existing group are root modules of that group, never a new group. Dock each new article to a free docking vector of the root module it continues (freeDockingVectors per root: a free LeftBottom takes the new root's RightBottom, a free RightBottom takes LeftBottom, a free Top vector takes the new root's Bottom vector) - one article with merge-article-into-group, several at once by adding the picks, each with its relation, to the group from get-plan-context and resubmitting it with its id; an article between two root modules with insert-article-into-group. A new root module inherits the attributes the library passes on between neighbours - fronts, handles, carcase - from the root module it is docked to (insert-article-into-group: the first of between), as in the planner; its attributes override them. A new group is only for a free stretch of wall or a free spot in the room (obstacles shows what is taken) - never position a new group against an existing one.
- To move an existing group against a wall or into a room corner, call place-group with wall, alignment and offsetMm as in a placement. The group keeps its roots and docking.
- To change an existing group, use the command tools: merge-article-into-group adds an article at a free end of a row, insert-article-into-group inserts an article between two root modules, delete-article-and-compact deletes an article and closes the gap, delete-article-in-place deletes an article and leaves the gap (root modules no longer docked together become separate groups where they stand), exchange-root-module replaces a root module - with attributes also by an article of another width -, swap-root-modules lets two root modules change places, delete-group deletes a group, change-module-attribute and change-group-attribute set attributes, merge-groups joins groups where they stand (nothing is moved, no docking is added). Delete and remove mean the same: delete-article-in-place, unless the user asks to close the gap - then delete-article-and-compact. In an insert, a delete that closes the gap, an exchange or a swap the root modules at a wall or in a corner keep their place and the others move; wall units and the range hood move with the root module they hang from. Every command returns the changed groups. To rebuild a group, take it from get-plan-context, change it, and resubmit it with its id and without placement via create-or-replace-groups - it keeps its position; keep the ids of the root modules you keep.
- Verify results numerically: the returned groups carry position (pos, rotationY, footprint) and per root the dockingVectors, the input attributes and the docking; the hint names a root module that stands on an obstacle. Do not judge a position from a rendering alone.
- Undo a wrong result: when a result is not what was asked - the wrong wall, a root module missing or replaced by mistake, a merge or a delete that went wrong - call undo and send the corrected call, instead of correcting the wrong plan piece by piece; one undo reverts one tool call. A group that only needs a change is edited with the command tools. undo and redo also serve the user who asks for them.
- Read corrections, notLoaded and hint in a result: corrections lists what the server changed in your input and has already applied; notLoaded lists the groups and the roots it could not build, with what to send instead; hint names something to check that stopped nothing - a root module on an obstacle, with the free stretches of its wall.

Example 1 - "a row of three tall units along the right wall, from the back right corner" is ONE call, create-or-replace-groups, placed at the right wall, flush into its corner with the back wall:
{ "posGroups": [{ "libraryId": "<libraryId>", "placement": { "wall": "right", "alignment": "back" }, "roots": [
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

Example 3 - "an L-shaped kitchen in the back right corner" (back = top in the top view) is ONE group starting with the corner article c1, placed at the right wall with the back wall as alignment; looking into the corner from the room, the root modules rightOf c1 run along the right wall, the root modules leftOf it along the back wall (see the corner rules above), and the wall units hang above the floor units of their leg:
{ "posGroups": [{ "libraryId": "<libraryId>", "placement": { "wall": "right", "alignment": "back" }, "roots": [
  { "id": "c1", "articleId": "<corner article, cornerArticle true>" },
  { "id": "r1", "articleId": "<base unit>", "rightOf": "c1" },
  { "id": "r2", "articleId": "<base unit>", "rightOf": "r1" },
  { "id": "l1", "articleId": "<base unit>", "leftOf": "c1" },
  { "id": "l2", "articleId": "<base unit>", "leftOf": "l1" },
  { "id": "w1", "articleId": "<wall unit>", "above": "r1" },
  { "id": "w2", "articleId": "<wall unit>", "above": "l1" }
] }] }

Example 4 - "the row centred on the back wall" is "placement": { "wall": "back" } - centred is the default.

Example 5 - "add a cabinet to the right of the existing cabinets" extends that group, never a new group: take the group from get-plan-context, find the root module with a free RightBottom (freeDockingVectors) and call merge-article-into-group { "groupId": "<group id>", "articleId": "<article>", "dockTo": { "rootId": "<that root module>", "ownDockingVector": "RightBottom", "dockingVector": "LeftBottom" } } - the group keeps its position.

Example 6 - "insert a low cabinet between the high cabinets" is insert-article-into-group { "groupId": "<group id>", "articleId": "<a base cabinet from the catalog>", "between": ["<first root module>", "<second root module>"] }: the high cabinets are the two root modules of the group that stand side by side - whatever the group is, a wardrobe too -, the low cabinet an article about 720 mm high; the root modules on the side away from the wall move by the article's width, the ones at the wall keep their place.`;

const INSTRUCTIONS = `This server orchestrates HOMAG Intelligence (HI) object groups in a live Roomle room-planner session (proof of concept). Everything is made of articles: the catalog offers articles (cabinets, wardrobes, appliances, panels), a group is one piece of furniture made of articles (a kitchen, a wardrobe, a sideboard, a utility room), and an article placed in a group is a root module.

Typical workflow:
1. get-plan-context: fetch the rooms (each with a derived walls array), the article catalog (desc, category, dimensions, docking vector names, sub-modules per article), the groups currently in the plan and the obstacles (doors, windows, other furniture and the root modules of the groups, where they stand). Add masterData to include for the attribute vocabulary, or look an attribute up with find-attributes.
2. create-or-replace-groups: author the whole piece of furniture as ONE group - article picks, each article after the first naming its neighbour with one relation (rightOf, leftOf, onTop, above or behind), a material for the whole group in the group's attributes, plus one placement for the new group ({ wall, alignment?, offsetMm? } at a wall or in a room corner - the server computes the point -, { posGroup, posRotationY } anywhere else; a plan into a room corner starts with a corner article, cornerArticle true in the catalog). One call creates, relates and positions the group; never author root positions and never split one piece of furniture into several groups. A group whose id matches an existing group in the plan completely replaces that group and keeps its position; all other groups are created. Articles next to an existing group are added to that group, docked to a free docking vector of the root module they continue - a new group is only for a free stretch of wall. The payload format, the relations, the corner rules and complete examples are returned by get-authoring-rules.
3. Edit an existing group with the command tools: merge-article-into-group (dock one more article at the end of a row), insert-article-into-group (an article between two root modules), delete-article-and-compact (delete an article and close the gap), delete-article-in-place (delete an article, the gap stays) and delete-group, exchange-root-module (replace a root module), swap-root-modules (two root modules change places), change-module-attribute and change-group-attribute (attributes, e.g. the front colour of the whole group), merge-groups (join groups that stand next to each other); place-group moves a group to another wall or into a room corner. Resubmit a whole group with create-or-replace-groups only to rebuild it. undo reverts the last tool call that changed the plan, redo brings it back.
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
  'delete-article-in-place',
  'delete-article-and-compact',
  'merge-article-into-group',
  'insert-article-into-group',
  'exchange-root-module',
  'swap-root-modules',
  'merge-groups',
  'undo',
  'redo',
];

const ATTRIBUTE_OVERRIDES = z.array(
  z.object({
    id: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
  })
);

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
        "for articles made for a room corner), groups (the groups currently in the plan: position with pos - the room point of the group's back left bottom corner, as a placement names it - rotationY, rootId (only with two corner articles: the one pos belongs to) and footprint, and " +
        'per root the article pick with input attributes, docking, docking vector names and the free docking vectors ' +
        'a new root can dock to, plus its desc - no root positions, ' +
        'no geometry; a returned group is a valid create-or-replace-groups payload) and obstacles (what stands in the ' +
        'room, in the coordinates of the walls: objects - doors, windows, other furniture - with kind, outline ' +
        "(floor points [x, 0, z]) and bottomMm/topMm, a door or a window also with roomIndex, wall and fromEndMm (its span along that wall from the wall's end); " +
        'and per group its root modules with id, outline and bottomMm/topMm). masterData (per library the root ' +
        'modules and the customer-facing attributes with their allowed values; modules, attributes and values carry ' +
        'their desc) is returned only when included ' +
        'explicitly; the same compacted attribute vocabulary is searched by find-attributes. Every desc is ' +
        'authoritative and dimensions give the size - trust them over the catalog images (imageUrl); a colour ' +
        'code in the desc of an attribute value (#rrggbb) is the colour of that value. Use it before ' +
        'authoring or modifying groups.',
      inputSchema: {
        include: z
          .array(z.string())
          .optional()
          .describe(
            'The sections to include: masterData, rooms, articles, groups, obstacles. Default: rooms, articles, groups and obstacles. ' +
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
        'for a requested property, e.g. the front colour, and the value to set. The desc of a value carries ' +
        'its colour code where the library gives one - Cloudy blue (#506080) -, the colour of that value: ' +
        'pick a dark, a light or a blue value by its code.',
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
        'a group around a room corner and extending a group. Fetch this before authoring pos groups.',
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
        'positions. Author one piece of furniture as ONE group: articles beside, above or back to back with each other are ' +
        "related root modules of the same group, never separately positioned groups; a material for the whole group goes into the group's attributes. Position a new group in the same " +
        'call with placement. At a wall or in a room corner: { wall, alignment?, offsetMm? } - wall a side label ' +
        '(left, right, back, front) or a wall index; alignment center (the default) or the side label of the ' +
        'adjoining wall, which puts the group flush into that corner (wall back with alignment right: the back ' +
        'right corner), a group that starts with a corner article into the corner; offsetMm moves it along the ' +
        'wall away from that corner. The server computes the point and the rotation. Anywhere else, an island or ' +
        "a free spot: { posGroup, posRotationY }, the room point of the group's back left corner and its " +
        'rotation. A group whose id matches an existing group completely ' +
        'replaces that group and keeps its position (root modules keep their ids when they already exist in ' +
        'the replaced group; a placement on it is not used; a root module the replace adds inherits ' +
        'the attributes the library passes on between neighbours - fronts, handles, carcase - from the root module it is docked to, and its attributes override them); ' +
        'all other groups are created with regenerated ids. Returns the loaded object ids and the resulting groups - ' +
        'check their pos and footprint - plus corrections (what the server changed in the input), notLoaded (the groups it ' +
        'could not build, with what to send instead) and hint (a root module on an obstacle, in another group or in front of ' +
        'a door or a window, with the free stretches of its wall). The payload format is returned by get-authoring-rules.',
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
        'get-plan-context. Use it to move a group that is already in the plan; a new group takes the same ' +
        'wall, alignment and offsetMm in its placement in create-or-replace-groups. Returns placedIn (corner or ' +
        'wall), the wall, the resulting group and a hint when a root module stands on an object or in front of ' +
        'a door or a window.',
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
        'Sets one attribute of a root module of a group in the plan and of its sub modules that carry it - ' +
        'the front colour of a root module reaches its fronts -, or with moduleId of that one sub module only, ' +
        'and recalculates the group. The ids are the ones get-plan-context shows (a sub module by its id in ' +
        'subModules); attribute ids and allowed values come from the masterData section of get-plan-context ' +
        'or from find-attributes. Returns the changed group and the ids of the changed modules.',
      inputSchema: {
        rootModuleId: z.string().describe('The id of the root module.'),
        moduleId: z
          .string()
          .optional()
          .describe(
            'The id of the sub module. Omit to change the root module and its sub modules that carry the attribute.'
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
        'modules, e.g. the front colour of a whole group - in one recalculation. Returns the changed ' +
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
        'Deletes a group with all its root modules from the plan. Returns the id of the deleted group.',
      inputSchema: {
        groupId: z
          .string()
          .describe('The id of the group. A unique id prefix is accepted.'),
      },
    },
    async (args) => textResult(await runTool('delete-group', args))
  );

  server.registerTool(
    'delete-article-in-place',
    {
      description:
        'Deletes an article from its group and leaves the gap - the tool for "delete" or "remove" when the user does ' +
        'not ask to close the gap: every other root module keeps its place; root modules that are no longer ' +
        'docked together afterwards become separate groups where they stand, and deleting the only root module deletes ' +
        'the group. To close the gap, use delete-article-and-compact. Generated roots (worktop, toe kick) ' +
        'cannot be deleted - the library regenerates them. Returns the remaining groups.',
      inputSchema: {
        rootModuleId: z.string().describe('The id of the root module.'),
      },
    },
    async (args) => textResult(await runTool('delete-article-in-place', args))
  );

  server.registerTool(
    'delete-article-and-compact',
    {
      description:
        'Deletes an article from its group and closes the gap - the tool when the user asks to close the gap (move ' +
        'the others up, keep the row together): the root modules beside it are docked together, and the ' +
        'root modules at a wall or in a corner keep their place. A wall unit or a range hood that hung from the ' +
        'deleted root module hangs from the one that moves into the gap. A root module with a neighbour on one side only is deleted and ' +
        'nothing else moves. Deleting a corner article between two legs closes the gap as well: one leg turns by 90 ' +
        'degrees, with the units above it, and is docked to the other, so the legs form one straight row - the result ' +
        'names the leg that turned. Deleting the only root module deletes the group. To leave the gap, ' +
        'use delete-article-in-place. Generated roots ' +
        '(worktop, toe kick) cannot be deleted - the library regenerates them. Returns the changed group.',
      inputSchema: {
        groupId: z
          .string()
          .optional()
          .describe(
            'The id of the group, optional - left out, the server takes the group of the root module. ' +
              'A unique id prefix is accepted.'
          ),
        rootModuleId: z.string().describe('The id of the root module.'),
      },
    },
    async (args) =>
      textResult(await runTool('delete-article-and-compact', args))
  );

  server.registerTool(
    'merge-article-into-group',
    {
      description:
        'Adds one article to an existing group as a new root module: docks it to a ' +
        'free docking vector of a root module of the group, the way the authoring rules describe docking. dockTo ' +
        "names the root module the article continues, that root module's free vector (one of its freeDockingVectors in " +
        "get-plan-context) and the new root module's vector: RightBottom -> LeftBottom puts it to the right, " +
        'LeftBottom -> RightBottom to the left, LeftTop -> LeftBottom hangs a wall unit or a range hood above ' +
        'a floor-standing root module at the height of the wall units (the server sets the gap). The new root module inherits ' +
        'the attributes the library passes on between neighbours - fronts, handles, carcase - from the root module of dockTo, as in the planner; attributes override them. ' +
        'To put an article between two root modules, use insert-article-into-group. The group keeps its position. Returns the changed group.',
      inputSchema: {
        groupId: z
          .string()
          .describe('The id of the group. A unique id prefix is accepted.'),
        articleId: z.string().describe('The article id from the catalog.'),
        attributes: ATTRIBUTE_OVERRIDES.optional().describe(
          'Attribute overrides of the new root module: [{ id, value }].'
        ),
        dockTo: z
          .object({
            rootId: z
              .string()
              .describe(
                'The id of the root module of the group the new article docks to.'
              ),
            ownDockingVector: z
              .string()
              .describe(
                "That root module's free docking vector, e.g. RightBottom."
              ),
            dockingVector: z
              .string()
              .describe(
                "The new root module's docking vector that meets it, e.g. LeftBottom."
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
                '[x, y, z] in millimetres added after docking; a wall unit above a floor-standing root module gets its hang gap from the server when y is 0. Default [0, 0, 0].'
              ),
          })
          .describe('Where the new root module docks.'),
      },
    },
    async (args) => textResult(await runTool('merge-article-into-group', args))
  );

  server.registerTool(
    'insert-article-into-group',
    {
      description:
        'Inserts one article from the catalog between two root modules of an existing group that stand side by side - ' +
        'whatever the group is and whatever the article is: a low cabinet between two high cabinets or wardrobes too; the user ' +
        'decides what stands between what. between names the two root modules, in either order; a group of two root modules ' +
        'has one place to insert: between them. No gap is needed - the tool makes room. The new root module is docked to both; the root modules at a wall or in a ' +
        "corner keep their place, the others move by the article's width. Wall units and the range hood move with the " +
        'root module they hang from. The new root module inherits the attributes the library passes on between neighbours - fronts, handles, carcase - from the first root module of between, ' +
        'as in the planner; attributes override them. To add an article beside the last root module of a row, use merge-article-into-group. ' +
        'Returns the changed group.',
      inputSchema: {
        groupId: z
          .string()
          .describe('The id of the group. A unique id prefix is accepted.'),
        articleId: z.string().describe('The article id from the catalog.'),
        attributes: ATTRIBUTE_OVERRIDES.optional().describe(
          'Attribute overrides of the new root module: [{ id, value }].'
        ),
        between: z
          .tuple([z.string(), z.string()])
          .describe(
            'The ids of the two root modules that stand side by side and take the new article between them, in either order.'
          ),
      },
    },
    async (args) => textResult(await runTool('insert-article-into-group', args))
  );

  server.registerTool(
    'exchange-root-module',
    {
      description:
        'Replaces one root module of a group with an article from the catalog that has one root ' +
        'module, e.g. a base cabinet with a drawer cabinet; the new root module takes over the position, the docking and ' +
        'the attributes the library passes on between neighbours - fronts, handles, carcase - of the replaced one, as in the planner; attributes override them, e.g. mod_Width 900 for an article of ' +
        'another width: the other root modules move by the difference, and the ones at a wall keep their ' +
        'place. A docking the new article cannot take is named in corrections. Returns the changed group.',
      inputSchema: {
        groupId: z
          .string()
          .describe('The id of the group. A unique id prefix is accepted.'),
        rootModuleId: z
          .string()
          .describe('The id of the root module to replace.'),
        articleId: z.string().describe('The article id from the catalog.'),
        attributes: ATTRIBUTE_OVERRIDES.optional().describe(
          'Attribute overrides of the new root module: [{ id, value }].'
        ),
      },
    },
    async (args) => textResult(await runTool('exchange-root-module', args))
  );

  server.registerTool(
    'swap-root-modules',
    {
      description:
        'Lets two root modules of a group change places, neighbours or not. Each keeps its attributes, and the ' +
        'wall units and the range hood hanging from a root module move with it. The group keeps its length, and the root modules ' +
        'at a wall keep their place. Returns the changed group.',
      inputSchema: {
        groupId: z
          .string()
          .describe('The id of the group. A unique id prefix is accepted.'),
        rootModuleIds: z
          .tuple([z.string(), z.string()])
          .describe('The ids of the two root modules that change places.'),
      },
    },
    async (args) => textResult(await runTool('swap-root-modules', args))
  );

  server.registerTool(
    'merge-groups',
    {
      description:
        'Joins groups into one: the groups in groupIds are merged into the target group where they stand, ' +
        'like the merge action of the planner - nothing is moved and no docking is added, so merge groups ' +
        'that already stand next to each other. Groups of different libraries cannot be merged. To add an article ' +
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
    'undo',
    {
      description:
        "Reverts the plan change of the last tool call that changed the plan, as the planner's undo does. " +
        'Use it when that result is not what was asked - the user says it was the wrong article, wall or group, or a ' +
        'merge or delete went wrong - and then send the corrected call; call it again to revert the call before. ' +
        'Returns the reverted tool and every group of the plan now; when there is nothing to undo, the result says so.',
      inputSchema: {},
    },
    async () => textResult(await runTool('undo', {}))
  );

  server.registerTool(
    'redo',
    {
      description:
        'Brings back the tool call the last undo reverted. A new change of the plan ends redo. Returns the ' +
        'restored tool and every group of the plan now; when there is nothing to redo, the result says so.',
      inputSchema: {},
    },
    async () => textResult(await runTool('redo', {}))
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
