# RML-18187: the agent prompts from the glue logic, and the planning skills they name

> **Type**: Feature analysis and implementation plan (steps 2 and 4 of the [change workflow](../../AGENTS.md#suggested-change-workflow))  
> **Domain**: roomle-ui HI glue logic (a new API), HI MCP server (planning skills, `get-skill`), the AI chats (system prompt, image prompt)  
> **Trigger**: [RML-18187](https://roomle.atlassian.net/browse/RML-18187) "HI MCP - validate skills" — the description of 2026-10-14 16:08, three points  
> **Date**: 2026-10-14  
> **Author**: AI Assistant  
> **Status**: Implemented 2026-10-14 — §7 on the branches below, steps 1–11; beyond the plan, the debug-logging wrapper of the glue logic (`debug-logging.ts`, which implements `GlueLogic` too) forwards and logs `getAgentPrompts`. Unit tests green; the live check and "test the mcp" of §7.4 not run. Branches not merged  
> **Branches**: roomle-hi-example `feat/validate-skills-RML-18187` (from `master`, 58b6839); roomle-ui `feat/hi-agent-prompts-RML-18187` (from `feat/hi-kitchen-from-image-improvements-RML-18164`, 7c4eafda8 — the HI commits of RML-18164 are not on `master` or `release/bo-test` yet)

## Affected repositories

- **roomle-ui** — the glue logic (`packages/web-sdk/packages/homag-intelligence`): the new API
  that returns the agent prompts, exposed on the planner's extended API; its unit tests; the
  embedding documentation. The ticket's "Glue Logic" is this package (`glue-logic.ts`); there is no
  separate glue-logic repository on this machine, so the roomle-ui branch covers it.
- **roomle-hi-example** — the MCP server: a planning skill for images, the served text that names
  it; the chat backend: the prompts come with the request instead of from constants; the example
  page: reads the prompts from the planner and sends them; the test script `run-hi-mcp-prompt.js`;
  the unit tests and the documentation.
- **ligna-store** — not in this task (the ticket names the two repositories above). Its chat keeps
  its own copies of the two constants until it follows: `toUserMessage` and `CHAT_SYSTEM_PROMPT`
  in `hi-mcp/chat.ts`, the window in `hi-mcp/chat-window.ts`, which gets the planner from
  `components/blocks/Planner.vue`. §4.5 says what changes there then.
- **RoomleCore** — no change. The prompts are text of the glue logic; the kernel is not involved.

## 1. What was asked

The ticket asks three things:

1. `DEFAULT_IMAGE_PROMPT` and `CHAT_SYSTEM_PROMPT` are provided by the glue logic (roomle-ui) and
   returned through an API: a JSON object with the system prompt and the image prompt, open for
   more properties later.
2. Handling images is a skill of the MCP server. An image without text still gets a prompt added
   automatically; that empty-image prompt is a property of the new API.
3. The system prompt names the relevant skills, so the agent knows which skills plan kitchens and
   other furniture. For now the glue logic returns this as a default system prompt; later the
   library itself can say what furniture it generates, and the prompt can be derived from that.

## 2. How it works today

**Two constants in two chats.** The system prompt and the empty-image text live in the chat code:

| | roomle-hi-example (`hi-mcp/hi-mcp-chat/chat-config.ts`) | ligna-store (`hi-mcp/chat.ts`) |
|---|---|---|
| system prompt | `CHAT_SYSTEM_PROMPT`, five sentences (what HI plans, call tools, closest article, answer from the last tool results); passed as `instructions` to `streamText` (`chat-stream.ts:129`) | `CHAT_SYSTEM_PROMPT`, three of the five (`chat.ts:16`) |
| empty-image text | `DEFAULT_IMAGE_PROMPT`, applied in `toModelMessages` to a user message with images and blank text (`chat-config.ts:253`) | the same text, applied in `toUserMessage` (`chat.ts:42`) |

Neither prompt names a skill. The behaviour reference describes the five sentences
([§4](../../docs/hi-mcp-behaviour.md#4-how-a-tool-call-runs)) and notes that the chats do not pass
the server's `INSTRUCTIONS` to the model (D75).

**The chats are page-driven, the planner is in the page.** The example page builds the request
body `{ messages, clientId }` and POSTs it to the backend (`minimal-hi-example/index.html:1570`),
in the same scope as `roomDesignerApi` (`startChat`, line 1411, next to
`startMcpBrowserBridge(roomDesignerApi)`, line 1401). The ligna-store chat runs the AI SDK in the
page; the window is started from `Planner.vue:280` beside the bridge, which holds `instance.api`.
The test script `run-hi-mcp-prompt.js` POSTs `{ messages, clientId }` itself (line 390) and
evaluates planner calls in the page it drives (`evaluateInPage`, `window.instance.extended`, line
503).

**The glue logic has no text for agents.** `GlueLogicImplementation` (roomle-ui
`homag-intelligence/src/glue-logic.ts`) serves the agent through `getPlanContext` and
`executeGroupOperation`, which the planner exposes as `getExternalObjectPlanContext` and
`externalObjectGroupOperation` on its extended API (`external-object-api.ts:492-527`,
`roomle-planner.ts:3183-3214`, delegating to `this._homagIntelligence.getGlueLogic()`). The
embedding's `extended` proxy is generic (`embedding-lib/src/connector.ts:46`), so a new public
method of the planner reaches the host page without a list to extend. The extended API is
documented in `embedding-lib/docs/homag-intelligence-embedding.md` (one `####` per method).

**The planning skills are served on demand** (D75, [§5.6](../../docs/hi-mcp-behaviour.md#56-planning-skills-get-skill)):
`kitchen-planning`, `kitchen-planning-fr` and `living-room-planning` in
`hi-mcp/hi-mcp-server/skills/`, listed by name and description in the `get-skill` description and
fetched by the model when it decides to. The description and `INSTRUCTIONS` step 2
(`hi-mcp-server.ts:71, 266-295`) speak of "a room of one kind". No skill covers planning from an
image. The room skills work against an image request: `kitchen-planning/SKILL.md:47` asks for a
measured plan when only a photo is supplied, and the skills optimise the layout, while the image
text asks for fidelity.

**What the agent does with an image today** (`mcp-test-2026-10-14_13-34-58`, gpt-6-astra, one
session, counted from the `[hi-mcp] tool get-skill` lines of every `console.log`): with the kitchen
image and no text, the model fetched `kitchen-planning` and its planning reference in the first two
steps, about 34 KB of text, and planned without asking; the same for the three kitchen images with
text; with the tall-units image it fetched no skill. The current empty-image text already makes a
strong model fetch the room skill; it gives it nothing about planning from an image, and a request
with text ("create a kitchen like the one in the image on the left wall", four of the six image
tests) gets no image guidance at all.

**The library-neutral policy** ([§2.4](../../docs/hi-mcp-behaviour.md#24-instructions)): the
server's served text names no library content; the only source of library information is the
library data. The glue logic is per library by nature, so it is the right home for text that will
one day say what this library generates.

## 3. The gaps

1. The prompts are duplicated in two chats and belong to neither: what HI plans and what the
   skills are is domain knowledge of the planner side, which the glue logic already represents
   (point 1).
2. The empty-image text mixes a **trigger** ("only an image arrived: plan what it shows", which
   only the client can apply, since the MCP server never sees the user's message) with
   **knowledge** (how to plan from an image), which reaches the model only when the text is empty
   (point 2).
3. No prompt names a skill; whether a skill is used is left to the model's reading of the
   `get-skill` description (point 3).

## 4. Proposed design

### 4.1 The API of the glue logic (roomle-ui)

A new method of the glue logic, exposed on the planner's extended API, named like its neighbours.
The implementation that generates the object is a new file of the package; the glue logic
delegates to it, the planner to the glue logic:

```ts
// homag-intelligence/src/hi-agent-prompts.ts (new) - generates the object
export interface HiAgentPrompts {
  systemPrompt: string;   // the system prompt of a chat that plans with the HI tools
  imagePrompt: string;    // the text of a user message that carries an image and no text
}
export const getAgentPrompts = (): HiAgentPrompts => ({ systemPrompt: ..., imagePrompt: ... });

// glue-logic.ts: GlueLogic.getAgentPrompts(): HiAgentPrompts - GlueLogicImplementation delegates to hi-agent-prompts.ts
// external-object-api.ts: getExternalObjectAgentPrompts(): Promise<HiAgentPrompts> in the extended API interface, with its JSDoc
// roomle-planner.ts: getExternalObjectAgentPrompts() delegates to this._homagIntelligence.getGlueLogic().getAgentPrompts(), like getExternalObjectPlanContext; without the HI module it rejects like externalObjectGroupOperation ("HI is not available") - an empty object would be a wrong prompt
```

- The object is the ticket's JSON: two string properties today, extensible — a later property
  (a list of the furniture kinds the library generates, a prompt per client kind) adds a field,
  not a method.
- The texts are constants in `hi-agent-prompts.ts`, with no library data in them yet. The ticket's
  future step — the library says what it generates — then composes `systemPrompt` from the library
  data in the same function, with the method and its callers unchanged.
- `systemPrompt`: the five sentences of today's `CHAT_SYSTEM_PROMPT` plus one that names the
  skills (§4.3). `imagePrompt`: one sentence that asks for the planning and names the image skill
  (§4.2). Proposed wording, to be reviewed:
  - system, added sentence: "Before planning, fetch the planning skill for the request with
    get-skill and follow it: kitchen-planning for a kitchen (kitchen-planning-fr in France),
    living-room-planning for a living room, image-planning when the user sends an image."
  - image: "Plan the furniture in the image as close to it as possible - fetch the planning skill
    image-planning with get-skill and follow it."

### 4.2 Handling images is a skill (roomle-hi-example, MCP server)

A new skill directory `hi-mcp/hi-mcp-server/skills/image-planning/` (name to decide), in the
Agent Skills format like the others, library-neutral. Its description says when: the user sends an
image or photo of furniture, with or without text. Its body says how — a proposal of the content,
for the skills' author to review:

- identify every piece of furniture and plan each as one group; name the kind (a kitchen, a
  wardrobe, a media unit …) before choosing articles;
- count the units per row and per level, read widths from the visible proportions and the usual
  module widths, read fronts, handles and worktop as group attributes from the attribute
  vocabulary;
- read the layout shape (a row, an L, a U, a galley, an island) and map it onto the plan's walls
  and corners when the user names none; the plan's room is not the photographed room: keep the
  sequence and the proportions, fit the length to the wall, keep doors and windows clear;
- take the closest catalog article for what the catalog lacks and say so;
- **precedence**: the image is the brief. Fetch the room skill of the furniture shown for its
  checks and apply its hard constraints (clearances, openings), but report its recommendations as
  notes instead of changing what the image shows, unless the user asks for an improved planning. A
  photo is enough for a concept; do not ask for a measured plan first;
- the answer names what was identified, substituted and adapted to the room.

The skill needs no change of the chats to be used by an image request *with* text: its index
entry in the `get-skill` description reaches every client. For an image *without* text the
trigger stays in the client: `imagePrompt` of the API (§4.1), applied automatically as today's
constant is.

The server's own text admits a skill that is not a room, for the clients without a system prompt
(Claude Desktop, Claude Code, Copilot, Le Chat): the `get-skill` description and `INSTRUCTIONS`
step 2 say "a room of one kind, or a planning from an image" instead of "a room of one kind".

### 4.3 The system prompt names the skills

The skills sentence of §4.1 names the server's skills by their directory names. That is a
contract across two repositories: roomle-ui names what roomle-hi-example serves. It is the ticket's
intent — the planner side knows what can be planned, the server serves how — and it degrades
softly: a name the server does not have answers "Unknown skill … - the skills are …" (G65), and the
model takes one from the list. The contract is recorded in D75's successor decision and checked in
the live test; no unit test can see both repositories.

Rejected: the server inserts its skill index into the prompt — the prompt is the glue logic's by
the ticket, and the chats see the index anyway in the `get-skill` description of the tool list.

### 4.4 How the prompts reach the chats

The consumer of the API is the chat, and in both hosts the chat is driven from the page that owns
the planner (ADR 0003). Two routes:

| Route | What happens | Changes | Trade-off |
|---|---|---|---|
| **P — through the page** (decided) | The page requests `extended.getExternalObjectAgentPrompts()` in advance and hands the prompts to its chat: the example page sends `prompts` in the `/chat` body, the backend uses `prompts.systemPrompt` as `instructions` and `prompts.imagePrompt` in `toModelMessages`; the ligna-store window gets them from `Planner.vue` and passes them to `streamChat` (later) | roomle-ui API; `index.html`, `chat-config.ts`, `chat-handler.ts`, `chat-stream.ts`, `run-hi-mcp-prompt.js` | No new planner method on the bridge allow-lists (ADR 0001, D2, D71: six methods), no chat concern in the MCP server (ADR 0003). Every client of the chat backend sends the prompts: the page, the test script (one `evaluateInPage` more), curl. A missing `prompts` is a 400 that names the fix |
| **M — through the MCP server** | `planner-api.ts` gets a seventh method, relayed over the bridge, and the server serves the prompts to the chats: as an MCP prompt (`registerPrompt`, SDK 1.30; `experimental_getPrompt` in `@ai-sdk/mcp` 2.0.62), as the `instructions` of the initialize result (`mcpClient.instructions` is exposed) for the system prompt only, or on a plain `GET /agent-prompts?client=` | the above plus `planner-api.ts`, both page allow-lists and the ligna-store copy, `planner-api.test.ts`, the server endpoint | The backend's clients stay as they are. Costs a bridge round trip per turn, an allow-list decision, a server endpoint for the chats' sake, and semantics MCP does not have: an MCP prompt is user-invoked, `instructions` is one text per server, not two prompts per client |

Route P, as the chats work now: the prompts reach the chat through the page, only no longer from
the variables `DEFAULT_IMAGE_PROMPT` and `CHAT_SYSTEM_PROMPT` but requested from the API in
advance. The MCP prompt variant of M has one merit worth keeping in mind: an MCP prompt
`plan-from-image` would give Claude Desktop users the image text as a slash command. That is a
separate feature, not this ticket.

**The empty image in route P.** The chat that builds the model messages applies the image text, as
today: the example backend in `toModelMessages` from the request's `prompts.imagePrompt`, the
ligna-store in `toUserMessage` from the prompts the window got. The window shows only the image,
unchanged. The page requests the prompts in advance — when the chat starts, once the planner with
its HI module is ready — and sends them with every request; the test script requests them the same
way in the page it drives, before its first turn.

### 4.5 What stays, what follows

- The chats keep no prompt constants. `DEFAULT_IMAGE_PROMPT` and `CHAT_SYSTEM_PROMPT` leave
  `chat-config.ts`; the test `asks the model to answer from the tool results`
  (`chat-handler.test.ts:91`) moves to roomle-ui against `getAgentPrompts()`.
- The MCP server's `INSTRUCTIONS` and `AUTHORING_RULES` stay the server's own text for every client
  (§2.4, one source); they are not replaced by the glue logic's prompt. The chats keep not passing
  them.
- ligna-store, when it follows: `Planner.vue` passes `instance.api` (or the prompts it read) to
  `startChatWindow`, `streamChat` takes `instructions` from them, `toUserMessage` the image text;
  the two constants and their README sentences go. It needs a planner deployment with the API.

## 5. Alternatives rejected

- **The empty-image text as a skill only, no client text** — with an empty message nothing asks the
  model to do anything, and no server mechanism can detect an empty message; the trigger must stay
  in the client (now: the API's `imagePrompt`).
- **The chat preloads the image skill itself** (`callTool('get-skill')` on an image without text)
  — deterministic, but code in both chats, and the skill text goes along with every later step of
  the conversation. Kept as the fallback if a measured run shows the named skill is still skipped.
- **The prompts in the MCP server's served text** — the library-neutral policy keeps text about
  what a library plans out of the server; the glue logic is per library.
- **One prompt per client kind in the API now** — nothing asks for it; the object is open for it.

## 6. Risks and open points

- **The skill names are a cross-repository contract** (§4.3). A renamed skill breaks the prompt
  silently except for G65's list. The live test of this feature checks the names once; a skills
  change in roomle-hi-example re-reads the prompt in roomle-ui.
- **Token cost.** The image skill adds a fetch on top of the room skill; it says which room-skill
  files it needs. The ligna-store chat runs at most 8 steps (`MAX_CHAT_STEPS`, `chat.ts:14`), the
  example 16; a fetch beside `get-plan-context` in the first step costs no extra step.
- **Who writes the image skill.** The room skills are maintained as their authors deliver them
  (D75). The content of §4.2 comes from the image tests, the planning results and the expectations
  of `docs/test-prompts.json`, and needs the author's review.
- **A client-sent system prompt.** The backend trusts the page's prompts as it trusts the page's
  messages: loopback only, CORS to the page origins, the page is the user's own planner. Noted,
  not a change.
- **Development is local**: roomle-ui on the branch with `npm run dev` (:5173), the example with
  `--dev`.

## 7. Implementation plan

roomle-ui first — the page needs the API —, then roomle-hi-example. Both are developed locally:
roomle-ui on its branch with `npm run dev` (http://localhost:5173/), the example with `--dev`
(`EXAMPLE_PORT=3001 HI_CHAT_PORT=3201` for script runs). Every step names its check.

### 7.1 roomle-ui — the agent prompts API (`feat/hi-agent-prompts-RML-18187`)

**Step 1 — the implementation, `homag-intelligence/src/hi-agent-prompts.ts` (new).**

```ts
export interface HiAgentPrompts {
  // the system prompt of an AI chat that plans with the HI tools
  systemPrompt: string;
  // the text of a user message that carries an image and no text
  imagePrompt: string;
}

export const getAgentPrompts = (): HiAgentPrompts => ({
  systemPrompt: SYSTEM_PROMPT,
  imagePrompt: IMAGE_PROMPT,
});
```

`SYSTEM_PROMPT` is the five sentences of today's `CHAT_SYSTEM_PROMPT` (roomle-hi-example
`chat-config.ts:12-18`) joined with a space, plus the sixth sentence of §4.1 that names the skills;
`IMAGE_PROMPT` the image sentence of §4.1. No library data yet (§4.1); nothing else in the file.

- Test `__tests__/hi-agent-prompts-test.ts` (new): `getAgentPrompts()` returns two non-empty
  strings; the system prompt names what HI plans ("kitchens, wardrobes, living room and utility
  furniture", not "(HI) kitchen"), asks to call tools, to take the closest article and to answer from
  the last tool results (the assertions of roomle-hi-example `chat-handler.test.ts:91-105`, which
  move here), and names `kitchen-planning`, `kitchen-planning-fr`, `living-room-planning` and
  `image-planning` together with `get-skill`; the image prompt asks for a planning "as close to it
  as possible" and names `image-planning`.
- Check: `cd packages/web-sdk && npm run test -- hi-agent-prompts`.

**Step 2 — the glue logic delegates, `glue-logic.ts`.** `GlueLogic` gets
`getAgentPrompts(): HiAgentPrompts;` and `GlueLogicImplementation` the one-line method next to
`getPlanContext` (line 1081): `return getAgentPrompts();` from `hi-agent-prompts.ts`. Nothing else
changes in the glue logic.

- Test `__tests__/glue-logic-test.ts`, `describe('getAgentPrompts')`: `newGlueLogic()` of
  `__mocks__.ts`; `glueLogic.getAgentPrompts()` equals the module's `getAgentPrompts()`.
- Check: `npm run test -- glue-logic -t getAgentPrompts`.

**Step 3 — the planner exposes it, `external-object-api.ts` and `roomle-planner.ts`.** The
`ExternalObjectAPI` interface (`external-object-api.ts:247`) gets, after
`getExternalObjectPlanContext` (line 492), `getExternalObjectAgentPrompts(): Promise<HiAgentPrompts>`
with the JSDoc: returns the prompts of an AI chat that plans with the HI tools — `systemPrompt`
for the chat, `imagePrompt` for a user message with an image and no text —, an object that may
carry more later; rejects without the HI module. `RoomlePlanner` (after line 3192):

```ts
public async getExternalObjectAgentPrompts(): Promise<HiAgentPrompts> {
  const glueLogic = this._homagIntelligence?.getGlueLogic();
  if (!glueLogic) {
    throw new Error('HI is not available');
  }
  return glueLogic.getAgentPrompts();
}
```

- Tests `planner-core/__tests__/roomle-planner.ts`, next to the plan-context delegation tests
  (line 4362): `getExternalObjectAgentPrompts should delegate to the glue logic` (a mock glue logic
  whose `getAgentPrompts` returns an object; the result is that object) and
  `getExternalObjectAgentPrompts should reject without the HI module` ("HI is not available").
- Check: `npm run test -- roomle-planner -t getExternalObjectAgentPrompts`; the embedding's
  `extended` proxy needs no change (`connector.ts:46` is generic) — the live check of §7.4 confirms
  the method on `instance.extended`.

**Step 4 — the documentation.** `embedding-lib/docs/homag-intelligence-embedding.md`: a
`#### getExternalObjectAgentPrompts` after `getExternalObjectPlanContext` (line 1946) with the
signature, the two properties, the rejection and an example. `.agents/homag-intelligence.md`: a
subsection "Agent prompts" after "HI Tool Commands" (line 218): the texts live in
`hi-agent-prompts.ts`, the glue logic delegates, the planner exposes, the skill names are those of
the MCP server's `get-skill`, and the future library-driven text. `.agents/web-sdk/homag-glue-logic.md`:
`hi-agent-prompts.ts` in the package layout.

- Check: `npm run lint` (types, code and docs), `npm run format`.

### 7.2 roomle-hi-example — the image skill and the served text (`feat/validate-skills-RML-18187`)

**Step 5 — the skill `hi-mcp/hi-mcp-server/skills/image-planning/SKILL.md` (new).** Frontmatter
`name: image-planning` and a description that says when: "Plan furniture from an image or photo the
user sends, with or without text: identify the pieces, read the layout, the counts and the sizes,
map it onto the room and the catalog, and report what was substituted and adapted. Use whenever a
user message carries an image." The body follows §4.2 in the sections *Purpose*, *Identify the
furniture*, *Read the layout and the sizes*, *Map it onto the plan*, *Articles and attributes*,
*The room skills* (the precedence rule) and *The answer*. `SKILL.md` only, no references;
library-neutral — no article, category, attribute or value of a library.

- Tests `tests/skills.test.ts`, `describe('the skills of the server')`: the list of line 170 gets
  `image-planning` with `files: ['SKILL.md']` (sorted first — `loadSkills` sorts by name); the
  reference test of line 189 runs over the skills that have references. `tests/hi-mcp-server.test.ts:314`:
  the names list gets `image-planning`, the description and instructions assertions take the new
  sentences of step 6. `tests/hi-mcp-server.test.ts:384` and `tests/tool-executors.test.ts:931`: the
  G65 list becomes "image-planning, kitchen-planning, kitchen-planning-fr, living-room-planning".
- Check: `cd hi-mcp && npm test -- skills hi-mcp-server tool-executors`; the server starts
  (`loadSkills` validates the frontmatter at start).

**Step 6 — the served text admits a planning from an image, `hi-mcp-server.ts`.** The `get-skill`
description (line 271-273): "Returns a planning skill: how to plan a room of one kind, or from an
image the user sends, well - the workflow, the zones, the dimensions and the checks. Before planning
a room of a kind listed here, or from an image, fetch its skill and follow it; fetch the files it
names with file." `INSTRUCTIONS` step 2 (line 71): "For a room of a kind get-skill lists, or for an
image the user sends, fetch that skill first and follow it." The policy test of line 764 exempts the
`get-skill` description already; the index is generated.

- Check: the two assertions of step 5 pass; `npm run typecheck`.

### 7.3 roomle-hi-example — the chat takes the prompts from the page

**Step 7 — the backend, `hi-mcp/hi-mcp-chat`.** `chat-config.ts`: `CHAT_SYSTEM_PROMPT` and
`DEFAULT_IMAGE_PROMPT` are deleted; `export interface ChatPrompts { systemPrompt: string; imagePrompt: string }`
and `parseChatPrompts(body): ChatPrompts`, which throws
`ChatRequestError("Chat request requires prompts - the systemPrompt and imagePrompt of the planner's getExternalObjectAgentPrompts()")`
when `prompts` is missing or either property is not a non-blank string; `toModelMessages(messages, imagePrompt)`
applies `content.trim() || imagePrompt`. `chat-handler.ts`: `const prompts = parseChatPrompts(body)`
after the messages; `streamChat(toModelMessages(messages, prompts.imagePrompt), clientId, prompts.systemPrompt)`;
`StreamChat` gets the third parameter `systemPrompt: string`. `chat-stream.ts`:
`instructions: systemPrompt`, the import of `CHAT_SYSTEM_PROMPT` goes.

- Tests `tests/chat-handler.test.ts`: `asks the model to answer from the tool results` (line 91) is
  removed (step 1 has it); `toModelMessages` (line 332) "gives a user message with images but no
  text the image prompt of the request"; new `describe('parseChatPrompts')`: keeps both prompts,
  rejects a body without `prompts` and one with a blank prompt, naming the fix; every `/chat` body
  of the handler tests carries `prompts`; `streams the assistant answer` (line 509) expects
  `toHaveBeenCalledWith(messages, 'page-one', PROMPTS.systemPrompt)`; new
  `rejects POST /chat without prompts with 400`; `passes the images of a user message to the model as file parts`
  (line 532) with the request's image prompt as the text part. `tests/chat-stream.test.ts`: the two
  `streamChat(...)` calls (lines 74, 196) get a system prompt; `response()` asserts that the model
  received it as the system message where the mock model exposes the prompt.
- Check: `cd hi-mcp && npm test -- chat && npm run typecheck`.

**Step 8 — the page, `minimal-hi-example/index.html`.** In `startChat` (line 1411), right after the
markdown imports: `logApiCall('getExternalObjectAgentPrompts'); const agentPrompts = await roomDesignerApi.extended.getExternalObjectAgentPrompts();`
— in advance, once, when the chat starts; the planner exists, since `startChat()` runs at the end of
the page script (line 1719), after `createPlanner` (line 1090); a rejection ends in the existing
`startChat().catch` ("failed to load: HI is not available"). The request body (line 1573) becomes
`{ messages: conversation, clientId: mcpClientId, prompts: agentPrompts }`. The window keeps showing
only the image for an image-only message. `MCP_PLANNER_METHODS` is untouched.

- Check: the live check of §7.4 — the page's API log shows `getExternalObjectAgentPrompts`, the chat
  turn runs, an image without text is answered with a planning.

**Step 9 — the test script, `.agents/scripts/run-hi-mcp-prompt.js`.** After `waitForLoadedPlanGroups(page)`
(line 573): `const agentPrompts = await evaluateInPage(page, 'getExternalObjectAgentPrompts', 'the agent prompts');`
— named `agentPrompts`, since `options.prompts` are the user prompts of the run. `runConversation`
(line 578) and `sendChat` (line 424) pass it on; `postChat` (line 390) sends
`{ messages, clientId, prompts: agentPrompts }`.

- Check: one run of `image-only-no-text` with the local planner (§7.4); the turn runs — a request
  without prompts is a 400.

**Step 10 — the documentation.** `docs/hi-mcp-behaviour.md`: a decision D80 after D79 — the chat
prompts are the glue logic's: the API, requested by the page in advance and sent with every chat
request, the chats keep no prompt constants; the system prompt names the skills — the skill-name
contract with roomle-ui; the image skill; rejected: through the MCP server (§4.4), in the server's
served text (§5); the §2.4 bullet "Planning skills are served text on demand" and §5.6 take the image
skill ("a room of one kind, or a planning from an image", the new table row, the index sentence);
§4 (line 385) describes the system prompt the page sends instead of the five-sentence constant; G65's
text. `docs/ai-chat.md`: "A chat turn" (line 170) and the images section (line 272-290): the request
body with `prompts`, the image prompt from the planner, the 400. `docs/implementation/pages-chat-and-launcher.md`:
Endpoints (the request, the 400), "A turn" step 4, "Images", "The page side of the chat".
`docs/hi-mcp-server.md:394-404`: the four skills, "or from an image". `docs/user-guide/README.md:59`,
`.agents/skills/hi-mcp-tools.md:17`, `.agents/skills/vercel-ai-sdk-chat.md:15` (the
`DEFAULT_IMAGE_PROMPT` sentence), `AGENTS.md` (the skills line of the tree, "Adding New Tools" stays),
`.agents/backlog/speckit-for-the-prompting.md` (its reference to `CHAT_SYSTEM_PROMPT` becomes the
API).

- Check: `npm run format:check`, `npm run lint`; every changed sentence describes today (no
  "previously", no "was").

**Step 11 — the test prompts, `docs/test-prompts.json`.** `image-only-no-text`: "the chat sends the
image with the planner's image prompt, which names the skill image-planning; the model fetches
image-planning (and the kitchen skill for its checks) and plans the kitchen as close to the image as
possible". `image-only-tall-units`: adds "fetches image-planning". `image-kitchen-left-wall`: an
`expect` that names image-planning beside the kitchen skill.

- Check: a "test the mcp" run of the image tests on request (§7.4), not part of the plan's own checks.

### 7.4 Verification

| What | How |
|---|---|
| Unit tests | roomle-ui: `cd packages/web-sdk && npm run test -- hi-agent-prompts glue-logic roomle-planner`, `npm run lint`. roomle-hi-example: `cd hi-mcp && npm test && npm run typecheck`, then `npm run lint` and `npm run format:check` at the root |
| Live check, local | roomle-ui `npm run dev` on :5173; the example `EXAMPLE_PORT=3001 HI_CHAT_PORT=3201 node minimal-hi-example/start.mjs gpt-6-astra <key> --dev`. In the browser: the page log shows `getExternalObjectAgentPrompts` at chat start, a dropped image without text is planned, the server log shows `tool get-skill` with `image-planning`. With the script: `run-hi-mcp-prompt.js` for `image-only-no-text` and `image-kitchen-left-wall` (gpt-6-astra), the chat log shows the planner's prompts and the `get-skill` calls |
| End to end | "test the mcp" over the image tests and one kitchen test, when asked |

The live check and the test run start only on request.

### 7.5 Commits

- roomle-ui, one commit: `feat: serve the agent prompts of the hi chat from the glue logic` — the
  three source files, the tests, the docs.
- roomle-hi-example, three commits: this analysis and plan (docs); `feat: take the chat prompts
  from the planner and add the image planning skill` — the skill, the served text, the chat, the
  page, the script, the tests, the docs; `docs: expect the image skill in the image test prompts`.
- No pull request without a request.

### 7.6 Outside this task

ligna-store follows later (§4.5); its backlog item "The chat prompt names only kitchens"
(`.agents/backlog/README.md:87`) closes with it.
