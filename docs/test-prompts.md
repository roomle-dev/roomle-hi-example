# Testing Prompts for Roomle HI Example

This document provides a collection of prompt examples for testing the Roomle HI (HOMAG Intelligence) room planning capabilities. These prompts can be used to verify the functionality of the MCP server tools when creating and positioning kitchen groups in Roomle sessions.

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

## Basic Group Placement

### Simple Group Additions

- **Add a group of three tall units to the wall on the right**
  ```
  add a group of three tall units to the wall on the right
  ```

- **Add a group of 4 cabinets to the wall in the back**
  ```
  add a group of 4 cabinets to the wall in the back
  ```

## Kitchen Planning

### Corner Kitchen Configurations

- **Plan a kitchen in the back right corner of the room**
  ```
  plan a kitchen in the back right corner of the room
  ```

- **Plan a kitchen with an oven, a range hood, a sink and a fridge in the back right corner of the room**
  ```
  plan a kitchen with an oven, a range hood, a sink and a fridge in the back right corner of the room
  ```

- **Create a kitchen with an oven, a fridge and a sink in the back right corner of the room**
  ```
  create a kitchen with an oven, a fridge and a sink in the back right corner of the room
  ```

## Image-Based Kitchen Creation

### Reference Image Prompts

The reference image goes along with the prompt: drop it into the chat window, or pass it to the
script with `--image`. The model has to read images.

- **Create a kitchen like the one in the image on the left-hand wall of the room**
  ```
  create a kitchen like the one in the image on the left-hand wall of the room
  ```
  *Reference: [kitchen-1.png](./images/kitchen-1.png)*

- **Create a kitchen like the one shown in the image, in the back right corner of the room**
  ```
  create a kitchen like the one shown in the image, in the back right corner of the room
  ```
  *Reference: [kitchen-2.png](./images/kitchen-2.png)*

- **Create a planning as to the one shown in the picture on the right-hand wall of the room**
  ```
  create a planning as to the one shown in the picture on the right-hand wall of the room.
  ```
  *Reference: [kitchen-3.jpeg](./images/kitchen-3.jpeg)*

- **Only an image, no text** — the model decides what to plan; the chat sends the image with its
  default text "Plan a kitchen like the one in the image."
  ```
  ```
  *Reference: [kitchen-4.png](./images/kitchen-4.png)*

## Detailed Kitchen Specifications

### Full Kitchen with Specific Requirements

- **Create a kitchen with an oven, hob, cooker hood, fridge, sink and cabinet with drawers, as well as wall cabinets in the back right corner of the room**
  ```
  create a kitchen with an oven, hob, cooker hood, fridge, sink and cabinet with drawers, as well as wall cabinets in the back right corner of the room. Arrange the kitchen around the corner. The front of the kitchen should be made of walnut and the worktop should be made of dark marble
  ```

  **Specifications:**
  - **Appliances**: oven, hob, cooker hood, fridge, sink
  - **Storage**: cabinet with drawers, wall cabinets
  - **Placement**: back right corner, arranged around the corner
  - **Materials**: walnut front, dark marble worktop

## Group Editing

Start from a plan with a kitchen group, e.g. the three tall units on the right wall above. Each
prompt exercises one command tool; check the result with `get-plan-images`.

- **Add one unit** (`merge-article-into-group`)
  ```
  add a cabinet with drawers to the right of the kitchen
  ```

- **Replace a unit** (`exchange-root-module`)
  ```
  replace the middle unit with a cabinet with drawers
  ```

- **Remove a unit** (`delete-root-module`) — the kitchen splits into two groups
  ```
  remove the middle unit
  ```

- **Change one unit** (`change-module-attribute`)
  ```
  make the first unit 900 mm wide
  ```

- **Change the whole kitchen** (`change-group-attribute`)
  ```
  make the fronts of the whole kitchen white
  ```

- **Join groups** (`merge-groups`) — after removing the middle unit
  ```
  join the two groups on the right wall
  ```

- **Delete a group** (`delete-group`)
  ```
  delete the kitchen
  ```

## Testing Guidelines

When testing these prompts with the MCP server:

1. **Start the server** using `npm start` from the repository root
2. **Open the example page** at http://localhost:3000
3. **Connect your MCP client** to http://localhost:3100/mcp
4. **Use the tools** to execute the prompts:
   - `get-plan-context` - Retrieve current room and article information
   - `create-or-replace-groups` - Create new kitchen groups with specified articles
   - `place-group` - Position groups against walls or in corners
   - the command tools - Edit an existing group (see Group Editing)

5. **Verify results** by checking:
   - Groups are created with correct articles
   - Groups are positioned at the specified locations (right wall, back wall, back right corner)
   - Material specifications are applied correctly
   - Docking relationships between modules are valid

To run every prompt here and get an evaluated report, ask an agent to **"test the mcp"**
([HI MCP testing skill](../.agents/skills/hi-mcp-testing.md)). To run a single prompt without
opening the page yourself and keep the result, use its script:

```bash
node .agents/scripts/run-hi-mcp-prompt.js mistral "$MISTRAL_API_KEY" "add a group of three tall units to the wall on the right"
node .agents/scripts/run-hi-mcp-prompt.js gpt-5.4-mini "$AZURE_GPT_KEY" "create a kitchen like the one in the image on the left-hand wall of the room" --image docs/images/kitchen-1.png
```

It runs the prompt through the chat in a headless browser and stores the snapshot, the images and the
model's answer in `.temp/result/<run>/`.

## Related Documentation

- [HI MCP Server Documentation](./hi-mcp-server.md)
- [HI MCP Tools Reference](../.agents/skills/hi-mcp-tools.md)
- [Roomle HI Concepts](../.agents/skills/roomle-hi-concepts.md)
- [Article Catalog](../.agents/skills/hi-authoring-rules.md)
