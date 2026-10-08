# HI MCP Benchmarking Skill

**Load this skill when:** the user asks to **benchmark** the HI agent or the MCP server, to
**measure the performance**, to find **where the time goes** or why the agent is slow, or to compare
the speed of the agent before and after a change.

A benchmark breaks the chat time of test runs down per model step — tokens, model time, tool time,
planner calls — names what costs the time, traces it to the served text, a tool result, the tool
API or the library data, and keeps the numbers as the baseline for the next measurement. Benchmarks
and their analyses live in [`.agents/benchmarks/`](../benchmarks/README.md).

## Rules

- **No model run without a go.** A benchmark reads runs of "test the mcp"
  ([hi-mcp-testing.md](./hi-mcp-testing.md)). Use the runs that exist first. When new runs are
  needed, name the tests, models and repetitions, the wall-clock time and the input tokens, offer a
  smaller variant, and wait until the user asks for the run in their own message.
- **Compare like with like.** Same tests, plan, models, reasoning effort and planner (bo-test or
  `--dev`) before and after; name the commit each run used.
- **At least two runs per test and model.** The same prompt and image take 60 s in one run and
  137 s in the next; one run is no baseline.
- **Leave out runs a provider error ended** (`errors` in `run.json`, e.g. "Failed to process
  successful response"), and say which. A failed snapshot save after the chat does not touch the chat
  time.
- **Trace every finding to its cause** in the served text, a tool result, the tool API or the
  library data, with the run and the step that show it — the model's own choice is never the root
  cause ([Guards Are a Last Resort](../../AGENTS.md#guards-are-a-last-resort)).
- **Say what is inferred.** Where the data does not show a cause, name it a hypothesis and the gap
  that hides it.

## 1. The runs

Existing runs: `.temp/result/<session>/<model>/<NN>-<test id>/`. A run is usable when its
`console.log` has `[hi-chat] step` lines:

```bash
for d in .temp/result/*/*/*-<test id>; do echo "$d $(grep -c '\[hi-chat\] step' $d/console.log) steps"; done
```

New runs, after the go: [Test the MCP](./hi-mcp-testing.md#test-the-mcp) steps 1, 2 and 4 with a
test file of the chosen tests, no random tests, and no evaluation unless asked. One session per
repetition:

```bash
SESSION=".temp/result/benchmark-$(date +%Y-%m-%d_%H-%M-%S)"
mkdir -p "$SESSION"
jq '.randomTests = 0 | .models = [{ "provider": "gpt-6-astra", "apiKey": "$AZURE_GPT_KEY" }]
    | .tests |= map(select(.id | IN("image-kitchen-left-wall", "image-only-no-text")))' \
  docs/test-prompts.json > "$SESSION/tests.json"
node .agents/scripts/run-hi-mcp-tests.js "$SESSION/tests.json" --out "$SESSION" > "$SESSION/runner.log" 2>&1
```

A run takes about 40 s for the launcher, the page and the snapshot, plus the chat (an image kitchen
with gpt-6-astra: 60–140 s), and 0.4–1.4M input tokens.

## 2. The benchmark

```bash
node .agents/scripts/benchmark-hi-mcp-runs.js <dir> [<dir> ...] [--test <id>]... [--out <dir>]
```

| Argument | Meaning |
|---|---|
| `<dir>` | a run directory (it holds `run.json`) or any directory above runs, e.g. a session |
| `--test <id>` | keeps the runs of that test id; repeatable |
| `--out <dir>` | writes `benchmark.md` and `benchmark.json` there; without it, the Markdown goes to stdout |

It reads, per run, `run.json`, `console.log` and `planner-calls.json`, and writes:

| Table | Content |
|---|---|
| per test | runs, chat seconds (mean, min, max), steps and input tokens (mean) per model and test |
| runs | per run: chat s, steps, model s, tools s, other s (the chat time outside the steps), tokens in, out and reasoning, plan changes, corrections, groups not loaded, errors |
| tools | per model and tool: calls, calls per run, total s, mean ms |
| per run | per step: turn, tools, step s, tools s, model s, input, output, reasoning, result tokens, planner calls per method (with their seconds when `planner-calls.json` has `ms`) |

The derived values:

- **Tools s** — the longest tool of the step: the tools of one step run side by side.
- **Model s** — the step without its tools. A tool may start while the model still streams its
  other calls, so it is an upper bound of the tool share.
- **Result tokens** — the next step's input minus this step's input and output: about what the
  step's tool results add to the context, and send again with every later step.

## 3. The analysis

Look at, in this order:

| Question | Where |
|---|---|
| What does a step cost? | fit model s against input and output tokens over all steps (least squares); the median of the steps with little output per input size. With gpt-6-astra: about 4.3 s per step, 11.6 s per 1,000 output tokens, 13 ms per 1,000 input tokens — the number of steps decides the time |
| Which kinds of steps take the time? | group the steps: create, `find-attributes`, other reads, edits after the create, final answer; their share of the chat time |
| What happens after the first create? | the steps and seconds after it: re-reads, edits, undos, rebuilds — each one a step the first create did not make unnecessary |
| What is the context made of? | the first step's result tokens and how many later steps send them again; the result tokens of the later tools |
| What do the tools do? | tool time per call and its planner calls (`[hi-mcp] call N: method` in `console.log`, `ms` in `planner-calls.json`) |
| What did the model get back? | `toolCalls` of `run.json`: `corrections`, `notLoaded`, `error` — and the step that follows them |

The size of what the server serves can be measured without a model: start the launcher on spare
ports (`EXAMPLE_PORT=3001 HI_MCP_PORT=3110 node minimal-hi-example/start.mjs --no-open`), open the
example URL with `&mcp_port=3110&plan_id=<plan snapshot id>` in headless Chromium (Playwright from
`.agents/scripts/node_modules`), call the tools with the MCP SDK client
(`node_modules/@modelcontextprotocol/sdk`) and measure the text of each result and each section.
Stop the processes on both ports afterwards. Details: the live check in
[hi-mcp-testing.md](./hi-mcp-testing.md#run-a-prompt-the-script) starts the same way.

Every improvement names what it changes and what it is expected to save — steps, seconds and input
tokens per run — computed from the step cost.

## 4. The document

`.agents/benchmarks/<slug>.md`, the benchmark beside it in `.agents/benchmarks/<slug>/`
(`--out`). The document, after the header block (type, domain, trigger, date, author, status, data,
how to repeat) and the list of the repositories the improvements change:

1. Executive summary — the mean time and steps, where the time goes, the flaws, the expected saving
2. What was asked
3. How it was measured — the sources, the runs (which are left out and why), the derived values
4. Results — per test, by kind of step, the step cost, the context, the tools
5. Flaws that cost steps and time — each with evidence (run and step) and cause
6. Proposed improvements — what each changes and what it saves; the rejected ones
7. What is open — runs not made, with their time and tokens
8. Measurement gaps
9. The benchmark to repeat

Add the document to [the benchmarks index](../benchmarks/README.md) and to
[`.agents/README.md`](../README.md). For a ticket, post the condensed document as a Jira comment.

After an improvement, run the same tests again, write the new benchmark next to the old one
(`<slug>-<YYYY-MM-DD>/`), and add a before/after table to the document: chat seconds, steps and
input tokens per test.

## Measurement gaps

| Gap | Consequence |
|---|---|
| The inputs of the read tools (`find-attributes`, `get-plan-context`) and the size of each tool result are not logged | which search the model made is inferred from the step's input size and result tokens |
| The `hint` of `create-or-replace-groups` is not in the server's `feedback` log line | `run.json` does not show whether the model got an obstacle hint |
| Models that write no text between steps (gpt-6-astra) | why a model undid or rebuilt a group cannot be read |

## See also

- [hi-mcp-testing.md](./hi-mcp-testing.md) — the runs a benchmark reads
- [vercel-ai-sdk-chat.md](./vercel-ai-sdk-chat.md) — the chat's step loop and its step log
- [hi-mcp-behaviour.md](../../docs/hi-mcp-behaviour.md) — what each tool returns, the corrections
