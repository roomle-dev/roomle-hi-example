# Bug analysis — the find-attributes answer lists the values without naming the attribute

> **Type**: Bug analysis
> **Status**: Open
> **Date**: 2026-10-22
> **Base**: roomle-hi-example `docs/hi-mcp-improvements-review` (`92e21b3`); roomle-ui
> `feat/hi-mcp-improvements` (`3b8d5fd56`)
> **Backlog**: [item 84](../backlog/mcp-issues.md#84-the-find-attributes-answer-lists-the-values-without-naming-the-attribute)

## Affected repositories

- **roomle-ui** (`feat/hi-mcp-improvements`): the fix. One sentence in the `find-attributes`
  description (`packages/web-sdk/packages/homag-intelligence/src/hi-mcp/hi-mcp-server.ts:377-391`)
  says that the answer names the attribute by its name and its id. A unit test in
  `__tests__/hi-mcp/hi-mcp-server-test.ts` covers the sentence.
- **roomle-hi-example**: the expectation of the test `attributes-find-front-colour` in
  `docs/test-prompts.json` says what "names the attribute" means. The `find-attributes` sections of
  `.agents/context/hi-mcp-behaviour.md` (with D76), `.agents/context/hi-mcp-server.md` and
  `.agents/skills/hi-mcp-tools.md` get the sentence. Backlog item 84 is updated now and removed once
  the fix is implemented.
- **ligna-store, embedding-lib**: unchanged. Both chats get the tool descriptions from the planner
  at their server URL, so no new embedding-lib version is needed. The bo-test runs see the sentence
  once roomle-ui is deployed to bo-test.
- **The chat's system prompt** (roomle-ui `hi-agent-prompts.ts`): unchanged — see
  [Alternatives](#alternatives-considered).

## Symptom and reproduction

**The run.** `mcp-test-2026-10-21_12-49-36`, gpt-6-astra 18 (`attributes-find-front-colour`,
bo-test, plan `three-tall-units`, `ps_s3p5hmscmmsnshopj2tybjwmt7ijy5o`). The prompt is "which front
colours can I choose for the kitchen?". The agent makes one `find-attributes` call, which makes one
planner call (`getExternalObjectPlanContext(['masterData','groups'])`), and changes nothing. The
answer:

> The catalogue offers **21 kitchen front colours and finishes**: Whites and neutrals: Snow white,
> Sunny white, … Wood looks: Oak, Dark oak, … Ponderosa pine. Depending on your chosen front range,
> selecting a finish may also change the front range. No changes have been made to your kitchen.

The values are those of `mod_FrontColor`. The answer names neither the attribute's name
(`Front color`) nor its id. The expectation asks that the answer "names the attribute". The
evaluation is `partial`, model finding.

**Every run of the test kept locally:**

| Session | Model | Tools | Answer names the attribute | Verdict |
|---|---|---|---|---|
| `mcp-test-2026-10-18_08-45-09` | gpt-6.1-sol | `find-attributes` | no — "21 kitchen front colours and finishes" | partial, "never names the attribute `mod_FrontColor`" |
| `mcp-test-2026-10-21_12-49-36` | gpt-6-astra | `find-attributes` | no — the same wording | partial |
| `mcp-test-2026-10-21_16-59-20` | mistral-large-4 | `get-skill`, `find-attributes`, `get-plan-context` | yes — "**Front color** (`mod_FrontColor`, group "Front \| Design")" | pass |

Both GPT models answer in the user's words and drop the attribute. Mistral names it without being
asked to. The run directories do not record the text the agent searched for: `run.json` keeps the
`toolCalls` of plan changes only, and `console.log` keeps the tool name.

**Reproduce.** `attributes-find-front-colour` with gpt-6-astra or gpt-6.1-sol. The answer's wording
comes from the model, so no replay without a model shows it.

## Investigation trace

**1. The tool result carries the name and the id.** The `find-attributes` executor (roomle-ui
`hi-mcp/tool-executors.ts:504-574`) pushes each matching attribute of the master data with every
field of the attribute — `id`, `name`, `desc`, `group`, `type`, `selections` — and adds its
`libraryId`, its `rootModules` and its `subModules` (`:554-559`). So the agent's result holds
`mod_FrontColor` and `Front color`. The tool is not missing anything.

**2. Several attributes match the question, and names repeat.** Every word of the search text has to
be found in one of the attribute's fields (`attributeMatches`, `tool-executors.ts:75-90`), and colour
reads as color. In the Furniture_Smith master data (`docs/library-information/master-data.json`), 13
attributes contain both "front" and "colour":

`mod_PaneltopEdgeFrontColor`, `mod_FrontColor`, `mod_HandleColor`, `mod_FrameFillingColor`,
`mod_FrontSegmentColor`, `mod_CarcaseOutsideColor`, `mod_CarcaseEdgeFrontColor`, `mod_FrontEdgeColor`,
`mod_PushtoopenColor`, `mod_PulloutElementColor`, `mod_FingergripColor`, `mod_BaseboardEdgeFrontColor`,
`mod_CeilingFillerEdgeFrontColor`.

Two of these are named `Front color`: `mod_FrontColor` (group `Front | Design`) and
`mod_CarcaseEdgeFrontColor` (group `Carcase | Design`). Both list 21 values. D64 records another pair:
the worktop and the panel top, both attributes named `Color`. So the name alone does not identify an
attribute, and "front colours" identifies it even less. Only the id is unique.

**3. No served sentence says what the answer of a question about an attribute names.**

- The `find-attributes` description (`hi-mcp-server.ts:377-391`) says what the tool searches and
  returns, when to search, how words match, and how to pick a colour by its code. It says nothing
  about the answer.
- The authoring rules (`hi-mcp-server.ts:19`) say "find-attributes answers a question about one
  attribute". They also say nothing about the answer, and an agent answering a question does not
  fetch them: none of the three runs calls `get-authoring-rules`.
- The chat's system prompt (roomle-ui `hi-agent-prompts.ts:17`) tells the agent to summarise *what it
  changed* — the groups, their roots and attributes. A question changes nothing, so that rule does
  not apply.

Every version of the description since the test was added has no sentence about the answer. This
covers roomle-hi-example's own server before `468abfa3` and roomle-ui's since `12eef7d26`; the
version the run saw differs from today's only in how it words the sub modules.

**4. The agent does not need the id in its answer, but the user does.** The chat keeps the tool
calls and their results for later turns (roomle-ui `hi-planning-assistant.ts:169-170`). A follow-up
such as "make them oak" therefore finds `mod_FrontColor` in the earlier result, whatever the answer
said. The name and the id in the answer are for the reader:

- The name is the attribute as the planner shows it.
- The id tells it apart from the other attribute with the same name, and lets the evaluation check
  that the values belong to the attribute the question asks about.

## Root cause

The `find-attributes` description, roomle-ui `hi-mcp-server.ts:377-391`, is where the agent reads how
to use the tool's result. It says what the result holds but not that the answer names the attribute.
No other served text says so either (trace step 3). A model that writes for the end user puts the
attribute into the user's words ("kitchen front colours") and drops its name and its id. Two GPT
models do this the same way. The test asks for something no instruction asks for, so the answer is
left to the model's style.

## Why the current code produces this result

The result holds the attribute and its values, and the agent answers the question asked: which
colours. Without an instruction, naming the attribute is optional. A model that writes for the end
user leaves the identifier out because the user did not ask for it. The answer is correct but does
not identify the attribute: the reader cannot tell which of the two attributes named `Front color`
the 21 values belong to, and cannot find the attribute in the planner by the answer's wording.

## Proposed fix

**roomle-ui served text** (step 1 of [Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort):
clarify the instructions). Add one sentence to the `find-attributes` description, after "… the
attributes the root modules in the plan and their sub modules carry come first.":

> Your answer names the attribute by its name and its id - several attributes can share a name - with
> the values it lists.

The sentence is library-neutral: it names no attribute, value or group of a library (§2.4 of
[hi-mcp-behaviour.md](../context/hi-mcp-behaviour.md)). Nothing is guarded and nothing is corrected,
because the result already carries everything the answer needs.

**Unit test** (roomle-ui `__tests__/hi-mcp/hi-mcp-server-test.ts`):
`it('tells the agent that the answer names the attribute by its name and its id')`. It checks that
the `find-attributes` description contains "Your answer names the attribute by its name and its id".
It sits beside `it('tells the agent that the attribute vocabulary is in the plan context and that
find-attributes answers a question')` (`:678`).

**Test expectation** (`docs/test-prompts.json`, `attributes-find-front-colour`): "… and names the
attribute by its name and its id (Front color, `mod_FrontColor`)". This replaces the ambiguous
"names the attribute": the gpt-6.1-sol evaluation reads it as the id, the gpt-6-astra one as the name.

**Documentation:**

- `.agents/context/hi-mcp-behaviour.md`: the `find-attributes` section and D76 ("`find-attributes`
  answers a question about one attribute") get the sentence and the new test as its guard.
- `.agents/context/hi-mcp-server.md` and `.agents/skills/hi-mcp-tools.md`: the `find-attributes`
  sections get the same sentence.

**Validation.** Run `attributes-find-front-colour` with gpt-6-astra and gpt-6.1-sol (the two models
that drop the attribute) and with mistral-large-4 (which must keep passing). The runs need a build
that serves the sentence: local roomle-ui with `--dev`, or bo-test after the deployment. They happen
only when the user asks for them.

## Alternatives considered

- **The sentence in the chat's system prompt** (`hi-agent-prompts.ts`). Rejected: only the chat would
  see it, while the tool description reaches every agent of the HI tools. The system prompt also says
  nothing else about individual tools.
- **The sentence in the authoring rules**, beside "find-attributes answers a question about one
  attribute". Rejected: an agent fetches the authoring rules to plan, not to answer a question, and
  none of the three runs fetched them. The tool list, which carries the description, reaches the
  agent in every step.
- **The name only.** Rejected: names repeat (two attributes `Front color`; worktop and panel top both
  `Color`, D64), so the name alone does not identify the attribute.
- **The id only.** Rejected: the id is the library's identifier, while the planner shows the user the
  name.
- **A field in the result that tells the agent what to answer.** Rejected: the result already carries
  the name and the id. What is missing is the instruction, not data, and a field in every match costs
  tokens in every search.
- **Reword the test expectation only and accept "front colours".** Rejected: the answer then does not
  identify the attribute among those that share its name, and two GPT models in two sessions show
  the same gap. It is an instruction gap, not a single model's wording.
