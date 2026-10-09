# Backlog

What is still to be done in and around roomle-hi-example: defects, hardening and follow-ups, one row
per item. The backlog holds open work only. An item leaves it when its fix is in the code.

## Planning by the MCP server

Details, causes, tests and how to reproduce: [mcp-test-open-issues.md](mcp-test-open-issues.md), or
the document a row links.

| Item | To do | Priority |
|---|---|---|
| [62 — A correction names units by their id only](mcp-test-open-issues.md#62-a-correction-names-units-by-their-id-only) | Name the article and the wall of a leg in the corrections and hints | low |
| [63 — The answer does not name the window a placement keeps clear](mcp-test-open-issues.md#63-the-answer-does-not-name-the-window-a-placement-keeps-clear) | Decide whether the answer names it; then one sentence | low |
| [64 — A free-standing wall is missing from the plan context](mcp-test-open-issues.md#64-a-free-standing-wall-is-missing-from-the-plan-context) | roomle-ui: list a free-standing wall in the obstacles | medium |
| [38 — A provider answer the AI SDK cannot process ends the turn without an answer](mcp-test-open-issues.md#38-a-provider-answer-the-ai-sdk-cannot-process-ends-the-turn-without-an-answer) | Read the logged provider answer of the next failure; decide on a retry | low |
| [A relation for a unit under a tabletop](under-relation-for-tabletops.md) | Live-check the inner vectors of a DeMaat tabletop, then compile `under` with the vector index | low |
| [Analyse how Spec Kit can help with the prompting](speckit-for-the-prompting.md) | Compare the prompt sections of Spec Kit (user input, pre-execution checks, guidelines, success criteria, done when) with the served text and the chat prompt; propose what improves the plannings | medium |

## Libraries

What the library data lacks for the agent to plan right; the fix is in the library. Details:
[library-issues.md](library-issues.md).

| Item | To do | Priority |
|---|---|---|
| [60 — The sink top of a sink unit reaches past the row or over the hob](library-issues.md#60-the-sink-top-of-a-sink-unit-reaches-past-the-row-or-over-the-hob) | HOMAG library (reported): the sink unit's description names the width of the sink with its drainer and the side it reaches over | medium |
| [61 — Handleless fronts done with a handle attribute](library-issues.md#61-handleless-fronts-done-with-a-handle-attribute) | HOMAG library: the descs say which one handleless fronts are — the handleless articles or the value "No handle" | medium |

## Planner (roomle-ui, RoomleCore)

| Item | To do | Details |
|---|---|---|
| A group the planner leaves out is not reported | `create-or-replace-groups` treats a non-empty load as success, so a group of the call the planner does not build is not named in `notLoaded`. Needs per-input outcomes from the planner (roomle-ui contract); counting runtime ids is ambiguous with split and generated groups | [planner-load-outcome-per-group.md](planner-load-outcome-per-group.md) |
| Article template geometry in the plan context | Measure the cost of calculating the article templates, then let the plan context carry docking vectors and corner points for every article, and remove the server's probe | [roomle-ui-article-template-geometry.md](roomle-ui-article-template-geometry.md) |
| One planner undo step per tool call | A tool call puts several steps on the planner's undo history, and the commands resolve before their follow-up reload; the server counts the steps and waits up to 2 s. roomle-ui: resolve `externalObjectGroupOperation` after the follow-up, and group a tool call into one step | [one-undo-step-per-tool-call.md](one-undo-step-per-tool-call.md) |
| Open findings about the plan context | A root outline reaches into its neighbour (correct: the sink's geometry — article description, MCP text); a calculation error of a new group reaches the agent through nothing; the kernel's outline of an HI group lies off the group; a changed position height is reported with its old value | [plan-context-open-findings.md](plan-context-open-findings.md) |

## Chat

| Item | To do | Details |
|---|---|---|
| Reasoning effort for the GPT chat models | gpt-5.4-mini plans without reasoning: set an effort per Foundry deployment from the measured data and verify it; further measurement only on request | [reasoning-effort-for-the-gpt-chat-models.md](reasoning-effort-for-the-gpt-chat-models.md) |
| Strict tool schemas for the GPT models | Measure how often a GPT model's tool call fails the schema ("Input validation error") in a "test the mcp" session; only if it costs runs, try strict function calling — the chat backend sets `strict` per tool (the Azure provider sends `strict: false` otherwise). The Azure strict subset needs every field required, `additionalProperties: false` on every object, at most five nesting levels and 100 properties, and no parallel tool calls: the MCP tool schemas with optional fields do not meet it, and a change there reaches every client | [Structured outputs on Azure](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) |
| Paste and pick an image in the chat window | An image reaches the chat only by drop, which the keyboard cannot reach. Add paste from the clipboard and a file picker button, both through `prepareImage` (`minimal-hi-example/index.html`) | [Images in the chat](../../docs/ai-chat.md#images-in-the-chat) |
| The example chat forgets its tool calls between turns | The page keeps only the text of a turn (`conversation`, `minimal-hi-example/index.html`), so a later turn does not see the tool calls and results before it — the ids of the groups it created. The ligna-store chat keeps them (`responseMessages`, ligna-store `hi-mcp/chat.ts`). Keep them in the example too, in the page or in the backend | [The chat window](../../docs/ai-chat.md#the-chat-window) |
| Per-tool status in the chat window | The backend streams plain text with `[tool] <name>` lines; the AI SDK's UI message stream would carry each tool call's input and result to the page, which then needs a parser (the page has no build step) | [The chat window](../../docs/ai-chat.md#the-chat-window) |

## Test infrastructure

Details: [mcp-test-infrastructure-issues.md](mcp-test-infrastructure-issues.md).

| Item | To do | Priority |
|---|---|---|
| [1 — The object-only perspective render draws an empty frame under software GL](mcp-test-infrastructure-issues.md#1-the-object-only-perspective-render-draws-an-empty-frame-under-software-gl) | roomle-ui: find why the frame is dropped under SwiftShader | low |
| [2 — The hint of a tool result is not recorded](mcp-test-infrastructure-issues.md#2-the-hint-of-a-tool-result-is-not-recorded) | Log the `hint` and store it per tool call in `run.json` | medium |
| [3 — A run whose page navigates after the chat stores no snapshot](mcp-test-infrastructure-issues.md#3-a-run-whose-page-navigates-after-the-chat-stores-no-snapshot) | Log the page's navigations; repeat a run without a plan snapshot id once | low |
| [4 — The suite runs only the tests written by hand](mcp-test-infrastructure-issues.md#4-the-suite-runs-only-the-tests-written-by-hand) | Generated and random tests in the temporary test file of "test the mcp" (RML-18027) | low |
| [5 — Saving the plan snapshot fails](mcp-test-infrastructure-issues.md#5-saving-the-plan-snapshot-fails) | Log the response body; check whether the v3 `planSnapshots` `POST` needs a signed request (roomle-ui) | low |

## Deployment, launcher and page sessions

Details: [deployment-and-session-issues.md](deployment-and-session-issues.md).

| Item | To do | Priority |
|---|---|---|
| [1 — A store page opened for an external agent never connects](deployment-and-session-issues.md#1-a-store-page-opened-for-an-external-agent-never-connects) | ligna-store: start the bridge with `mcp_server` alone, the chat window only with `model` and `api_key` as well | high |
| [2 — Per-page isolation is not checked on the live deployment](deployment-and-session-issues.md#2-per-page-isolation-is-not-checked-on-the-live-deployment) | Two store tabs, a shared `mcp_session`, a sixth session against the Cloudflare deployment | medium |
| [3 — The public MCP endpoint has no access control](deployment-and-session-issues.md#3-the-public-mcp-endpoint-has-no-access-control) | Decide session links, roomle.com OAuth or a shared secret before the URL goes beyond a trial | medium |
| [4 — The Cloudflare image installs from a second lockfile](deployment-and-session-issues.md#4-the-cloudflare-image-installs-from-a-second-lockfile) | Build the image from the root lockfile, delete `hi-mcp/package-lock.json` | medium |
| [5 — The root npm scripts swallow the launcher's flags](deployment-and-session-issues.md#5-the-root-npm-scripts-swallow-the-launchers-flags) | Root scripts run `node minimal-hi-example/start.mjs` directly | low |
| [6 — SIGTERM to the launcher leaves the servers running](deployment-and-session-issues.md#6-sigterm-to-the-launcher-leaves-the-servers-running) | Spawn the servers in a process group the launcher ends | low |

## Architecture

| Item | To do | Details |
|---|---|---|
| One page bridge for every host | The page bridge exists three times (reference client, example page, ligna-store), synced by hand. Publish it as a package, then move it into embedding-lib or the Rubens UI as one planner option | [one-page-bridge-for-every-host.md](one-page-bridge-for-every-host.md) |
| A backend-controlled agent loop with browser-executed scene tools | The scene tools stay in the browser; the agent loop, the tool authorization and the provider credentials move to the backend | [backend-agent-loop-with-browser-scene-tools.md](backend-agent-loop-with-browser-scene-tools.md) |

## ligna-store

| Item | To do | Details |
|---|---|---|
| The chat prompt names only kitchens | `hi-mcp/chat.ts` opens with "a planning assistant for a HOMAG Intelligence (HI) kitchen". Take the two sentences of the example chat: every kind of HI furniture, and the closest article of the catalog instead of asking (D44) | D44 in [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md#words-2026-10-06); the example's prompt: `CHAT_SYSTEM_PROMPT`, `hi-mcp/hi-mcp-chat/chat-config.ts` |
| The chat lacks the Mistral image adapter | Wrap `createMistral` with `toolResultFilesAsUserMessages` (`hi-mcp-chat/tool-result-images.ts`), so the images of `get-plan-images` do not reach Mistral as base64 text | [ligna-store-chat-client.md, 1](ligna-store-chat-client.md#1-the-images-of-get-plan-images-reach-mistral-as-base64-text) |
| The chat can end a turn without an answer | `stopWhen: stepCountIs(8)` has no final tool-free step; take the example's step policy (`hi-mcp-chat/chat-steps.ts`) | [ligna-store-chat-client.md, 2](ligna-store-chat-client.md#2-a-turn-can-end-without-an-answer) |
