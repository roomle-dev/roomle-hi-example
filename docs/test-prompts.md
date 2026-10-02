# Test Prompts for Roomle HI Example

The test cases for the Roomle HI (HOMAG Intelligence) room planning live in
[test-prompts.json](./test-prompts.json): each starts from one of the plans below, with a prompt, an
image or both. They verify the MCP server tools that create, position and edit kitchen groups in
Roomle sessions.

## Plans

### Default Room

plan snapshot id: `ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv`

![Default Room](./images/default-room.png)

### Living Room

plan snapshot id: `ps_nwzhfk8bjc2gu02gsyocsdragi0rxey`

![Living Room](./images/living-room.png)

### Closets

plan snapshot id: `ps_n9zrz89zsyy46l34mkf5pd52cx2ea2y`

![Closets](./images/closets.png)

### Utility Room

plan snapshot id: `ps_mq3m2wuhq6w23ry742eh50nb2vub5ej`

![Utility Room](./images/utility-room.png)

### Room and Attic

plan snapshot id: `ps_qn012p0tjux6dabt6oym0bzngmqex70u`

![Rooms and Attic](./images/room-and-attic.png)

### Three Tall Units

plan snapshot id: `ps_qply732i7knwtkfjm1z86sa8vrt00ms`

![Three Tall Units](./images/three-tall-units.png)

The Default Room with one group: three `HTB60` along the right wall from the back right corner. The
group editing tests start from it. It was built with `create-or-replace-groups` and saved with
`saveExternalObjectSnapshot()`; the ids survive a reload:

| | id |
|---|---|
| group | `064a7d91-b583-4883-b71b-95c324d3d824` |
| first unit (back corner) | `0010443c-519a-437b-8fe5-364f13887ca4` |
| middle unit | `a7271f1b-50d5-4b50-97ca-7a5bf75f77fa` |
| last unit (front) | `8774cac2-8b83-405d-b88c-f0e5cd2452fb` |

```json
{ "posGroups": [{ "libraryId": "Furniture_Smith",
  "placement": { "posGroup": [4815, 0, -3765], "posRotationY": 270 },
  "roots": [
    { "id": "t1", "articleId": "HTB60", "contextData": { "dockedRoots": [{ "ownDockingVector": "RightBottom",
      "dockedRoots": [{ "id": "t2", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }] }] } },
    { "id": "t2", "articleId": "HTB60", "contextData": { "dockedRoots": [{ "ownDockingVector": "RightBottom",
      "dockedRoots": [{ "id": "t3", "dockingVector": "LeftBottom", "mode": "StartStart", "offset": [0, 0, 0] }] }] } },
    { "id": "t3", "articleId": "HTB60" }
  ] }] }
```

## Test Cases

[test-prompts.json](./test-prompts.json) holds:

| Field | Content |
|---|---|
| `models` | the chat models to test, `{ provider, apiKeyEnv }`: a provider name of the launcher and the environment variable that holds its key — never the key |
| `plans` | the plans above by name: `{ "<name>": "<plan snapshot id>" }` |
| `tests` | `{ id, title, plan, prompt?, image?, operations?, expect? }` — `plan` names the plan the test starts from; `prompt`, `image` (a file under `docs/images/`) or both are sent as one chat message; `operations` are MCP tool calls `{ tool, arguments }` made on the plan before the prompt (e.g. "join groups" deletes the middle unit first); `expect` says what the evaluation checks |

## Testing Guidelines

When testing a prompt by hand with the MCP server:

1. **Start the server** using `npm start` from the repository root
2. **Open the example page** at http://localhost:3000
3. **Connect your MCP client** to http://localhost:3100/mcp
4. **Use the tools** to execute the prompts:
   - `get-plan-context` - Retrieve current room and article information
   - `create-or-replace-groups` - Create new kitchen groups with specified articles
   - `place-group` - Position groups against walls or in corners
   - the command tools - Edit an existing group (the tests on the Three Tall Units plan)

5. **Verify results** by checking:
   - Groups are created with correct articles
   - Groups are positioned at the specified locations (right wall, back wall, back right corner)
   - Material specifications are applied correctly
   - Docking relationships between modules are valid

To run every test for every model and keep the results, use the runner; ask an agent to **"test the
mcp"** ([HI MCP testing skill](../.agents/skills/hi-mcp-testing.md)) for an evaluated report:

```bash
node .agents/scripts/run-hi-mcp-tests.js                     # docs/test-prompts.json, every model
node .agents/scripts/run-hi-mcp-prompt.js gpt-5-mini "$AZURE_GPT_KEY" "add a group of three tall units to the wall on the right" --plan ps_qn0wlxn7pdq5ki9mj999yrpefclmvtv
```

The runner stores each run in `.temp/result/mcp-test-<time>/<model>/<NN>-<test id>/`; the second line
runs a single prompt the same way.

## Related Documentation

- [HI MCP Server Documentation](./hi-mcp-server.md)
- [HI MCP Tools Reference](../.agents/skills/hi-mcp-tools.md)
- [Roomle HI Concepts](../.agents/skills/roomle-hi-concepts.md)
- [Article Catalog](../.agents/skills/hi-authoring-rules.md)
