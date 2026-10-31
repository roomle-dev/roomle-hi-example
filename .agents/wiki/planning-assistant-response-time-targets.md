# Planning Assistant: response time targets

How fast the Planning Assistant has to plan a kitchen. These are the targets the performance work
is measured against; the targets are reached step by step. The current baselines, on the Azure
deployment, are [baseline-fkwm-az-2026-10-28.md](../benchmarks/baseline-fkwm-az-2026-10-28.md), the
kitchen from a text prompt, and [baseline-iklw-az-2026-10-28.md](../benchmarks/baseline-iklw-az-2026-10-28.md),
the kitchen from an image; all measurements are in [the benchmarks](../benchmarks/README.md).

## The targets

All times run from the moment the user sends the prompt.

**A kitchen from a text prompt**

| Milestone | Target |
|---|---|
| First kitchen in the plan | 10 s |
| Final result | 20–40 s, depending on how complex the kitchen is |

**A kitchen from an image**

| Milestone | Target |
|---|---|
| Image interpreted | 5–10 s, depending on the image; a crowded image takes longer |
| First kitchen in the plan | 15–20 s |
| Final result | 25–50 s, depending on how complex the kitchen is |

The first kitchen from an image is the first kitchen from a text prompt plus the time the agent
needs to interpret the image.

## What the milestones mean

- **Opening response** — the model's first short sentence about the requested action. The
  assistant's `firstTextMs` measures its first emitted text delta from the host callback, which
  does not establish a painted chat frame. The prompt asks for an opening before detailed
  planning; provider latency still applies. It is measured separately from the first kitchen and
  final result, with no numeric response-time target established for it.
  The [opening-response comparison](../benchmarks/planning-assistant-opening-comparison.md)
  records first text separately from completed planning and documents provider-latency limits.
- **First kitchen in the plan** — the planner shows the first kitchen of the turn: the first
  successful `create-or-replace-groups` has completed. The benchmarks report it as "First
  successful kitchen create completed (turn start)"; the reports of "test the mcp" as the
  **First result**, the time until the plan first changes in the planner
  ([test-prompts.md](../../docs/test-prompts.md)).
- **Final result** — the agent's last answer is complete. The benchmarks report it as "Assistant
  turn start → answer complete"; the reports of "test the mcp" as the **Planning time**.
- **Image interpreted** — the agent knows what the image shows and starts to plan the kitchen. No
  marker measures it today: the agent reads the image inside the model calls before the create.

## Where the time of a kitchen goes

The first kitchen is the model calls before the create plus the create call itself:

- **A model round** — a call and the tool calls it makes — costs about 3.5 s even with a short
  answer. The shared reference in front of every call is read from the provider's cache.
- **The create call** reasons before it writes its payload — the largest block of the first
  kitchen, and the model's own — and then streams the payload in a few seconds.
- **The planner** builds the kitchen in 1–2 s. No tool and no planner step is on the path to the
  first kitchen for more than two seconds.

After the first kitchen, the repairs take the time: a whole group sent again is a model step of 20
to 70 s, as long as the first create, and a value the library cannot calculate adds a round to find
and send another one. The served rules send a group again for a wrong layout only and change sizes
and materials with the command tools, and a create sets every group attribute the library can
calculate ([D128](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions)).

The planning assistant supplies the plan state with every turn, and `get-skill` answers a room
skill with its planning reference in one result, so a creation fetches its skill in the first call
and creates in the second. The baselines measure every part. The levers in place — the shared
reference prefix, response chaining within a turn, the plan state per turn, the skill with its
reference in one result, the plan images as JPEG, a render only when it is due, the library read
before the first prompt, the tool named as the model starts its call — are described with their
rejected alternatives in roomle-ui's
[prompt-caching reference](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/prompt-caching.md)
and the [decisions of the HI tools](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions).
A small model that selects the skills of a turn before its first call is
[a backlog item](../backlog/planning-assistant-skill-selector.md).

## Levers that do not shorten it

| Lever | Why not |
|---|---|
| Tool memoization | The read tools answer in milliseconds, the renders in under a second and the create in 1–2 s; no tool is called twice with the same input in a turn, a later turn finds the result in its history, and a memoized live read goes stale |
| Selective retrieval of the catalog (RAG), or the catalog behind a search tool | The library reference is in the shared prefix and read from the cache; a selection per request breaks the shared prefix, and a search per article pick costs a round each. How much of the library every request carries follows the library's structure, not a retrieval step: the attributes section lists the values of the attributes a planning sets at the create, the others are one `find-attributes` call away (D122 of [roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions)) |
| The catalog as an overview, with article details and a category directory on demand | Every request reads about 7,500 input tokens less, from the cache, and the model time does not move with them: the walnut kitchen comes after 21.5 s and the image kitchen after 23.6 s against 24.0 s and 21.4 s, within the provider's spread. The category directory makes the kitchen later, and no library of the HOMAG test proxy is too large for the model's context window (D125 of [roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions)) |
| The skills and rules trained into the model | Fine-tuning teaches how to answer, not which rules to know; the rules change with the library, the region and the skills HOMAG delivers, and every change would mean training, data set and validation again. The price of a round and the reasoning of the create call do not depend on where the rules are |
| A smaller input image | The chat sends the image at most 1568 px on the long side, about 2,000 of the about 77,000 input tokens of a first call; a smaller image saves nothing measurable and loses what the model reads |
| Trimming the tool definitions | They are read from the cache with the prefix: about a tenth of a second per call |
| One calculation and one load of the kitchen in the create, instead of a load at the planner's origin, a reload at the wall and a load for the materials | The create tool takes 1.0 s instead of 3.2 s for the walnut corner kitchen and 0.6 s instead of 2.1 s for the image kitchen, but the turn does not show it: the walnut kitchen comes 1.1 s later and the image turn ends 10.7 s later than the baselines in the mean of two runs — the model calls' waits of 2 to 5 s per call outweigh a saving of 1.5 to 2.2 s (D127 of [roomle-ui `hi-tools-behaviour.md`](https://github.com/roomle-dev/roomle-ui/blob/master/.agents/homag-intelligence/hi-tools-behaviour.md#3-decisions)) |
| A terser create payload | A second or two of streaming, at the price of a tool API change for every client |
| A first partial kitchen — the base row first, the rest in a second call | One more round and a second group that docks onto the first; the first attempt is half a kitchen |
| Streaming the tool input into the planner while the model writes it | A group is laid out from its relations; a partial group cannot be built |
| Resending a call that has no first output after a limit | A resend doubles the cost of a legitimate long reasoning; a stalled call is rare, and its tail needs measuring over more sessions before a limit can be set |
| Keep-alive requests | Paid traffic without a measured need |
