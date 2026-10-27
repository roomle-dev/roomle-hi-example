# Backlog: the skills of a turn selected by a small model before the first call

> **Type**: Backlog item (the planning assistant of the embedding-lib; a second, small model per
> host — taken up with the choice of the models, not before)
> **Domain**: roomle-ui `packages/embedding-lib/src/homag-intelligence/hi-planning-assistant.ts`
> (the turn before its first model call, `PlanningAssistantConfig`), `homag-intelligence/src/hi-agent-prompts.ts`
> (the prompts the planner serves); the model config of the hosts (`minimal-hi-example/start.mjs`,
> ligna-store `hi-mcp/chat-options.ts`)
> **Status**: Open — deferred; the models of the assistant are decided later, and the selector is
> one of them
> **Ticket**: [RML-18303](https://roomle.atlassian.net/browse/RML-18303); the reasoning effort and
> the models in [RML-18043](https://roomle.atlassian.net/browse/RML-18043)
> **Source**: proposal G of the time-to-first-attempt analysis and
> [its analysis](../feature-analysis/planning-assistant-skill-selector.md) while that is open; the
> external document [Kitchen AI Planner: Skill-Architektur und Context Loading](../../docs/external/planning-improvements.md)
> (the router in front of the planning model)

---

## Problem

A turn that plans a room spends its first model call on fetching the skill of the request and
reading the live plan sections; the create is the second call. On the Azure deployment that first
call costs 3.3–4.9 s (benchmark 06, the build of A: 62–79 output tokens, no reasoning). The
external document proposes a router: a small, fast model in front of the planning model that
recognizes the intent and selects the skills and the data, which the planning model then gets with
the request. The planning model would create in its first call.

What the session of 2026-10-27 (gpt-6-astra on Azure, 79 runs, 99 turns) says about the
selection:

| Turns | Count |
|---|---|
| Turns that fetched a `SKILL.md`, every one in its first call, 39 of them with the live sections in the same call | 40 (31 creations, 9 edits) |
| Later turns of a conversation that fetched a skill (the skill of turn 1 stays in the history) | 0 of 20 |
| A word match for kitchen, living room and image that names every skill the model fetched — the selection without a model | 13 of the 40; it misses 27 ("add three base cabinets to the left wall", "add a sideboard of three low cabinets" fetch a room skill without naming the room) and names a skill in 6 turns where none was fetched ("delete the kitchen") |

The selection needs a model: the skill of a request is in the furniture vocabulary and the plan.

## What the selector saves, and what it costs

- **A creation** gains the first call, 3.3–4.9 s, minus the selector's own call (estimated 1–2 s,
  not measured: no retained run has a call of a small model with a short input) and minus the part
  of the first call that moves into the create call as the first call of the turn — the cache
  write of the prefix and the full upload, 3.0–3.5 s to the response headers against 1.9–2.7 s for
  a chained call in benchmark 06. **Expected: 1–3 s of a 26–33 s creation.**
- **An edit** gains nothing from the selector; its read round is taken by the plan state supplied
  per turn (below), which needs no model.
- **Every turn** pays the selector's call, also the turns that need no skill: in the session the 9
  turns without any read and the 10 looks that read first.
- A wrong selection costs a round, as today, where the model fetches the skill itself, or 36 KB
  once per conversation where a skill the model would not have fetched is supplied.

On this evidence the selector is worth its second model, its config in every host and its prompt
only if its measured call is well under the round it replaces; that is the measurement to make
when the models are chosen.

## The design, when it is taken up

- **The selector call** before the first model call of a turn: `generateText` without tools on a
  small model named in the config (`selector` of `PlanningAssistantConfig`: provider, model, key,
  endpoint, reasoning effort), with a limit of a few seconds; the turn's abort signal. Input: the
  planner's selection prompt and the user's text, with a note when the message carries an image.
  Output: free text; the host keeps the names of the planner's skill list found in it. No name,
  an unknown name, a failed or a slow call supply nothing, and the turn runs as today. Without
  `selector` in the config, no call.
- **The selection prompt is served by the planner** with the agent prompts
  (`getExternalObjectAgentPrompts()` gains `skillSelection: { prompt, names }`), so the host holds
  no skill knowledge; library-neutral, it says what the system prompt says: which skill for which
  kind of room, the France skill in France, the image skill for an image, none for a question, a
  look, undo or redo.
- **The supplied skills**: each selected skill the conversation does not hold yet, read through the
  assistant's own `get-skill` tool (the served text with the session preamble and the planning
  reference), as a labelled user-role message before the user's message, retained with it on
  success — so it is in the history of every later turn and not supplied again. What the
  conversation holds is derived from the history (the labels and the model's own `get-skill`
  calls); no state beside it.
- **The plan state supplied per turn** is the selector's precondition: without the live sections —
  rooms, groups, obstacles, installationElements, 5–14 KB, 10–20 ms — in the first request, the
  model reads them in its first call and the create stays the second call, with or without a
  selector. The planning assistant supplies it with every turn (D121 of roomle-ui
  `hi-tools-behaviour.md`, ADR 0016), so the selector's precondition is met.
- **The candidates**: on the Azure resource a small deployment at a low reasoning effort
  (`gpt-5.4-mini`), or the external document's router model if the resource has a deployment of
  it; on direct OpenAI a mini model. The launcher names it with `HI_CHAT_SELECTOR_MODEL`, the
  ligna-store in its chat options, the same resource and key as the planning model.
- **A rule that skips the selector** once the conversation holds a skill, unless an image comes,
  saves its seconds on the later turns of a conversation at the price of a later request for
  another kind of room going unselected; added if the measured cost asks for it.

## To do, when the models are chosen

1. Choose the selector deployment per host, with the reasoning effort of the planning model
   (RML-18043).
2. Implement the selector as designed, with the unit tests of the assistant (the selector asked
   with the planner's prompt; its answer filtered by the planner's list; the selected skills
   supplied before the user message and retained; a held skill not supplied again; no selector in
   the config, no call; a failed, empty or slow selection supplies nothing; the usage record
   carries the selector's time and names) and of the prompts (the selection prompt names every
   skill of the planner).
3. Measure on the Azure deployment with the two creation tests of benchmark 06
   (`image-kitchen-left-wall`, `full-kitchen-walnut-marble-corner`), two repetitions each, on the
   local embedding source, the selector's request told apart in the collector. Accepted when the
   create is the planning model's first call in every run, no call before it fetches a supplied
   skill, the selector's call is shorter than the round it replaces, and the kitchens are those of
   benchmark 06. The selector stays out otherwise.
4. The embedding-lib build after the measurement, asked for; the decision row in roomle-ui
   `hi-tools-behaviour.md` and the living reference of the assistant.
