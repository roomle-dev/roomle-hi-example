# HI MCP — User Guide

The HI MCP lets an AI assistant plan furniture for you in the Roomle planner. You describe what you
want — "an L-shaped kitchen in the back right corner, walnut fronts, a dark marble worktop" — and
the assistant builds it in the planner while you watch. In the same conversation you can change it:
add a unit, swap two cabinets, change a colour, move the whole kitchen to another wall.

This guide is for everyone who wants to plan with the HI MCP. You need no programming knowledge for
the [store chat](#1-the-store-chat); the example pages need a terminal.

> **A proof of concept.** The HI MCP plans with the HOMAG Intelligence (HI) test backend and one
> furniture library, Furniture_Smith. It is meant for demos and for trying out what AI-assisted
> planning can do.

## Contents

- [What you can do](#what-you-can-do)
- [How it works](#how-it-works)
- [Three ways to use it](#three-ways-to-use-it)
- [Talking to the assistant](#talking-to-the-assistant)
- [Example prompts](#example-prompts)
- [What to expect](#what-to-expect)
- [Limits](#limits)
- [Troubleshooting](#troubleshooting)
- [Words used in this guide](#words-used-in-this-guide)
- [Further reading](#further-reading)

## What you can do

- **Plan new furniture** — straight kitchens and L-shaped kitchens around a corner, with wall
  units, tall units, sink, hob, oven, fridge, dishwasher and range hood; wardrobes and walk-in
  closets; sideboards, lowboards and wall units for the living room; utility rooms.
- **Change what is planned** — add, insert, replace, swap and remove units; change a colour or a
  size of one unit or of a whole group; join two groups; delete a group.
- **Move furniture** — against another wall, into a corner, centred on a wall.
- **Ask questions** — what is in the room, which units the catalog has, which colours a front can
  have, what the plan costs.
- **Work from a picture** — drop a photo of a kitchen into the chat and ask for one like it.
- **Undo and redo** — "undo that" takes back the assistant's last change.

This prompt planned the kitchen below:

> **Use the current Hi-Orchestrator session to create a kitchen with an oven, hob, cooker hood,
> fridge, sink and cabinet with drawers, as well as wall cabinets in the back right corner of the
> room. Arrange the kitchen around the corner. The front of the kitchen should be made of walnut and
> the worktop should be made of dark marble.**

![An L-shaped kitchen in the back right corner of the room, with walnut fronts, a tall unit with an oven, a hob with a range hood above, a sink and wall cabinets](../images/example-1-result.png)

## How it works

```text
you ──> AI assistant ──> HI planning tools ──> your open planner tab
        (chat)           (in the page)          (the kitchen appears here)
```

- The assistant reads the plan first: the rooms with their walls, doors and windows, the furniture
  already planned, and the catalog of the library.
- For a kitchen or a living room it reads a planning skill written by HOMAG first: the work zones,
  the sequence sink, preparation surface, hob, the dishwasher beside the sink with the dishes within
  a turn. It plans with assumptions where the plan does not say — the services, the budget, the
  household — and names them in its answer.
- It never draws furniture itself. It picks units from the catalog, says which unit stands next to,
  on or above which, and against which wall the group goes.
- The planner arranges the units, adds the worktop and the toe kick, and calculates everything — as
  when you plan by hand.
- Every change happens in the planner tab you have open. **Keep that tab open** while you work with
  the assistant.

## Three ways to use it

| Way | You need | Best for |
| --- | -------- | -------- |
| [1. The store chat](#1-the-store-chat) | a browser and an API key for the chat model | trying it out, demos |
| [2. The example page with its chat](#2-the-example-page-with-its-chat) | the repository, Node.js and an API key | developers, demos with other models |
| [3. The sign-in example](#3-the-sign-in-example) | the repository, Node.js, the HI server login and an API key | demos where the login and the model are entered on the page |

Ask the team that runs the HI MCP for the API key of a chat model.

### 1. The store chat

Open the store test page with these parameters:

```text
https://www.roomle.com/t/ligna-store-test/?store.stage=INT&model=<model>&api_key=<key>
```

- `<model>` — any `gpt-*` model such as `gpt-6-astra`, or one of `mistral-large-latest`,
  `mistral-medium-latest`, `mistral-large-4`, `mistral-large-3`
- `<key>` — the API key of that model
- add `&id=<plan id>` to open a saved plan; without it you start planning from the store

The button at the bottom of the planner opens the chat, the **AI Planning Assistant**, at the side
of the planner. Type your request and press Enter. While the assistant works, the status line
shows what it is doing.

### 2. The example page with its chat

In the repository folder:

```bash
npm install
npm start azure:gpt-5.4-mini <api-key>
```

The browser opens `http://localhost:3000` with the planner; the button at the bottom opens the chat.
Instead of `azure:gpt-5.4-mini` you can start any model as `<provider>:<model-id>` with the exact
model id — `azure:gpt-6-astra`, `mistral:mistral-large-4`, `anthropic:claude-sonnet-4-5` and more;
the [README](../../README.md#usage) lists the providers. Without a model (`npm start`) the chat runs
on the model proxy of the HI server when your backend enables it; otherwise the page opens without
a chat. The chat runs in the page.

### 3. The sign-in example

It is published on GitHub Pages — open <https://roomle-dev.github.io/roomle-hi-example/>; you need
only a browser. Or run it in the repository folder:

```bash
npm install
npm run start:sc
```

The browser opens `http://localhost:3300` with a sign-in page. Enter the user and password of the HI
server and, if your login has more than one backend, the backend ID; the library is optional when the
backend has one, and for the chat
select the provider and enter the exact model ID and its API key. **Start planning** opens the planner; the button at the bottom opens the
chat. Without a model, the chat runs on the model proxy of the HI server when your backend enables
the AI planning; otherwise the planner opens without a chat. On the first sign-in the page asks whether
it may store the sign-in data in a cookie; if you allow it, the form is filled in on your next
visit. Each field can also be prefilled by a query parameter of its name, for example
`?backendId=<backend-id>&libraryId=<library>`; other query parameters go to the planner, for example
`id=<plan-id>` for a saved plan or `language=de-DE`. More in the
[README of the example](../../hi-sc-example/README.md).

## Talking to the assistant

Talk to it as you would to a planner colleague: say **what** you want, **where** it goes and **how**
it should look.

### Where: walls and corners

The assistant names the walls as you see the room from above, in the top view:

| You say | Means |
| ------- | ----- |
| back wall | the wall at the top of the top view |
| front wall | the wall at the bottom of the top view |
| left wall / right wall | the walls at the left and the right |
| back left, back right, front left, front right corner | the corner where those two walls meet |

It also knows where the doors and windows are, so you can say "keep the door free" or "low units
below the window". Useful phrases:

- "against the right wall", "centred on the left wall"
- "into the back right corner", "around the back left corner"
- "next to the existing kitchen", "above each base unit"

### What: units

Name the units in plain words: base cabinet, base cabinet with drawers, wall cabinet, tall cabinet,
corner unit, sink unit, hob, oven, fridge, dishwasher, range hood, filler, side panel, wardrobe,
sideboard, lowboard. Most units come in widths of 30, 45, 60 and 90 cm; you can ask for a width.
The [article catalog](../library-information/articles.md) lists every unit of the library with a
picture and its dimensions.

To change a unit that is already planned, point at it the way you see it: "the middle cabinet", "the
last unit on the right wall", "the tall unit next to the fridge".

### How it should look: colours and materials

You can set the colour of the fronts, the worktop and the carcase, for one unit or for a whole
group: "make the fronts snow white", "a dark marble worktop", "walnut fronts". The
[materials list](../library-information/materials.md) shows every colour with a swatch. If you are
not sure what is possible, ask: *"Which colours can the fronts have?"*

### Remove or delete?

The two words do different things:

| You say | The assistant |
| ------- | ------------- |
| "**Remove** the middle cabinet" | takes it out and closes the gap — the neighbours move together |
| "**Delete** the middle cabinet" | takes it out and leaves the gap — the rest becomes two groups |

### Work from a picture

Drop an image onto the chat window — a photo of a kitchen, a catalog page, a sketch — and ask, for
example, *"Create a kitchen like this one in the back right corner."* All chat models of the store
read images; the input field says "drop an image" when the model can read them.

The image alone is enough: without text, the assistant plans the furniture it shows as close to it
as possible. With an image it reads the planning skill for images: it keeps the order of the
cabinets and their proportions, fits the furniture to a wall of the room and keeps the doors and
windows clear, takes the closest article of the catalog where the catalog has nothing alike, and
says what it substituted and adapted.

![A photo of a white L-shaped kitchen with a wooden worktop, given to the assistant as a reference](../images/example-2-reference-kitchen.jpg)

![The kitchen the assistant planned from the photo: white fronts, a wooden worktop, tall units at both ends](../images/example-2-result.png)

## Example prompts

| Task | Prompt |
| ---- | ------ |
| Get to know the plan | "Describe the room and the furniture that is already planned." |
| | "Which units does the library have? Summarize them." |
| Plan something new | "Add a group of three tall units to the right wall." |
| | "Plan an L-shaped kitchen into the back right corner, with a sink, a hob and an oven." |
| | "Put a wall unit above each base unit." |
| | "Plan two wardrobes against the left wall." |
| Move | "Move the kitchen to the back right corner." |
| | "Move the group to the left wall, centred." |
| Change units | "Add a drawer cabinet next to the existing group." |
| | "Insert a low cabinet between the tall cabinets." |
| | "Replace the middle cabinet with a drawer unit." |
| | "Swap the first and the last cabinet." |
| | "Remove the middle cabinet." |
| Change the look | "Make the fronts of the whole kitchen white." |
| | "Make all cabinets in the group 900 mm high." |
| Join and delete | "Join the two groups standing side by side." |
| | "Delete the island." |
| Check the result | "Show me the plan." — the assistant renders the plan and looks at it |
| | "What does the current plan cost?" |
| Take back | "Undo that." / "Redo." |

## What to expect

- **It takes a moment.** A request runs several steps — read the plan, build, check. A simple change
  takes seconds, a whole kitchen can take a minute or more. The status line of the chat shows the
  step the assistant is on.
- **You watch it happen.** The furniture appears and changes in your planner tab.
- **The assistant says what it adjusted.** When it had to correct a detail — a unit that did not
  fit where it was asked, a value of another spelling — it says so in its answer.
- **Models differ.** Some models plan better than others, and the same request can give a different
  result the next time. If a result is not what you wanted, say what to change, or undo it and ask
  again in other words.
- **You can still plan by hand.** Changes you make in the planner are no problem. If the assistant
  seems not to know about them, ask it to read the plan again.

### Tips

- Start with one clear request, check the result, then refine it step by step.
- Name the wall or the corner — "against the back wall" works better than "somewhere". To shift a
  group, say how far: "move it 50 cm further along the wall".
- Ask "show me the plan" when you want the assistant to check its own work.
- For a whole kitchen, list what it must contain: sink, hob, oven, fridge, dishwasher, wall units.

## Limits

- **One library, a test backend.** The assistant plans with the Furniture_Smith library on the HI
  test backend only.
- **No orders.** The assistant can calculate the price and read the order data, but it never places
  an order.
- **Undo covers the assistant's changes.** "Undo that" takes back what the assistant did. For a
  change you made yourself, use the undo button of the planner.
- **Outside the room.** If you ask for furniture outside the room — on a terrace, for example — the
  assistant builds it there. It does not stop you.
- **Colours and materials a unit does not offer.** A colour, program or design a unit does not
  offer is not set on that unit. The assistant is told which values the unit offers and can pick
  one of them. The library does not check every attribute this way, the sizes for example.

## Troubleshooting

| Problem | What to do |
| ------- | ---------- |
| There is no chat button at the bottom of the planner | The planner has no AI Planning Assistant yet — in the example page, start it against a planner that has it (`npm run dev` with the local Rubens UI) |
| A dropped image is not attached | The chosen model cannot read images — start a model that can; if it can, reload the page |
| The result is not what you asked for | Say what to change ("move it 50 cm along the wall", "use the other corner"), or "undo that" and rephrase |
| Price or order data fails | In the example page no preset is selected — choose one in the top bar |

## Words used in this guide

| Word | Meaning |
| ---- | ------- |
| **HI** | HOMAG Intelligence — calculates the furniture: sizes, fronts, worktops, prices |
| **MCP** | Model Context Protocol — the standard way AI assistants use tools; the planning tools follow its shape |
| **Unit** | One piece of furniture from the catalog: a base cabinet, a tall unit, a wardrobe (also called an article) |
| **Group** | Units that stand together and are calculated together: a kitchen row, a corner kitchen, a wall of wardrobes. The worktop and the toe kick belong to the group |
| **Library** | The furniture catalog the assistant plans with — here Furniture_Smith |
| **Plan** | The room or flat in the planner, with everything planned in it |

## Further reading

- [Article catalog](../library-information/articles.md) and [materials](../library-information/materials.md)
  of the Furniture_Smith library
- [AI chat in the example](../ai-chat.md) — the chat window and its models
  in detail
- [Example and tool reference](../../.agents/context/hi-mcp-server.md) — for
  developers: the example page and the tools

## Interior Design

Ask to add a shelf or drawer inside a cabinet, move a specific fitting higher, transfer it within the same furniture group, delete identified fittings, or replace one with an available alternative. The assistant first discovers what the loaded library supports. It may ask which fitting you mean when several are alike. Actual placement and retained settings depend on the library; the tool result reports adjustments and changed instance IDs. A cabinet can show shelves of its own before any fitting is added; the assistant sees them and says when a fitting takes their place. Undo and redo apply to each completed edit. See [the tool contract](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#interior-design-tools).
