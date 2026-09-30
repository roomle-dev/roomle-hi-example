# HI MCP Testing Skill

**Load this skill when the task involves:** testing the HI MCP server end to end with a real model
and a real planner — running a prompt through the chat, checking the plan a prompt produces,
comparing prompts or models.

## Run one prompt

```bash
node .agents/scripts/run-hi-mcp-prompt.js <provider> <api-key> "<prompt>" [--dev] [--headed]
```

| Argument | Meaning |
|---|---|
| `<provider>` | a chat provider of the launcher, passed through unchanged (`mistral`, `mistral-medium`, `claude`, `gpt-5-mini`, … — see [ai-chat.md](../../minimal-hi-example/docs/ai-chat.md)) |
| `<api-key>` | the provider's API key, e.g. `"$MISTRAL_API_KEY"` |
| `"<prompt>"` | the user message, sent as a single turn — prompts to start from are in [testing-prompts.md](../../docs/testing-prompts.md) |
| `--dev` | the planner from the local Rubens UI dev server (`npm run dev` in roomle-ui, :5173) |
| `--headed` | shows the browser window |

The script:

1. starts the launcher (`minimal-hi-example/start.mjs <provider> <api-key> --no-open`) with the MCP
   server on port **3110**, not 3100 — example tabs of an interactive session reconnect to 3100 and
   would take the bridge away from the run's page;
2. opens the example URL the launcher prints in Playwright Chromium, a fresh browser each run, so
   every run starts from the preset plan (no IndexedDB state);
3. waits until the MCP tool `get-plan-context` lists articles (server up, page connected, HI library
   loaded);
4. sends the prompt to the chat backend (`POST /chat`, the chat window's system prompt and tools)
   and waits for the end of the stream;
5. reads `window.instance.extended.getExternalObjectSnapshot()` in the page and stores the result;
6. stops the browser and every server process, also after an error or Ctrl+C.

## The result

`.temp/result/<UTC timestamp>-<provider>/`, e.g. `.temp/result/2026-09-30T14-05-12-mistral/`:

| File | Content |
|---|---|
| `run.json` | provider, prompt, the model's answer, the tools it called in order, errors, example URL, start time, durations (ready, chat, snapshot) |
| `snapshot.json` | the return value of `getExternalObjectSnapshot()`, unchanged |
| `order-data.json` | `orderData` of the snapshot — the groups with their articles and attributes |
| `top-image.png`, `perspective-image.png` | the whole plan rendered |
| `top-object-image.png`, `perspective-object-image.png` | the HI objects only (missing when the plan has no groups) |
| `object.glb` | the HI objects as GLB (missing when the plan has no groups) |
| `plan.xml` | the plan XML |

Inspect a run by reading `top-image.png` (where the group stands), `run.json` (which tools the model
used, what it answered, `errors`) and `order-data.json` (which articles and attributes).

Exit code 0 when the chat reported no error; 1 when it did — the result directory is written in both
cases, after an error the snapshot shows the plan as the model left it. A run that fails before the
prompt (launcher, readiness timeout) writes no result directory, and neither does a stopped run
(Ctrl+C: exit 130, SIGTERM: 143) — it only stops the browser and the servers.

A run takes about 10 s until the page is ready, the model's time for the chat (Mistral Large: 40 s
to 2 min for one group) and about 15 s for the snapshot.

## Prerequisites

- Node 20+
- `npm install` in `.agents/scripts` (Playwright 1.55.0 — the version roomle-ui uses, so its cached
  Chromium is reused; on a machine without it: `npx playwright install chromium` in `.agents/scripts`)
- ports 3000, 3110 and 3200 free — stop an interactive `npm start` first; one run at a time
- to stop a run, press Ctrl+C in its terminal. With Volta, `node` is a shim that does not pass
  signals on: a `kill -INT <pid>` from another shell reaches the shim, not the script — send it to
  the real Node process (started via `$(node -p process.execPath)`) instead
- `--dev` only: the roomle-ui dev server running on :5173

## When a run fails

| Symptom | Cause |
|---|---|
| `the launcher exited with code 1` right after the start | unknown provider, a missing key, a busy port or a failed typecheck — the launcher's message is printed above |
| `timed out … waiting for the page and the HI library` | the page did not connect or the HI library did not load — run with `--headed` and look at the page |
| `errors` in `run.json` with the provider's message | invalid key or a provider failure; the snapshot is still stored |
| `Prompt … > 262144 maximum context length` in `errors` | the model called `get-plan-images`; the images in the tool result exceed the model's context (seen with Mistral Large) |
| `chat request failed: … aborted` | the chat took longer than 10 minutes |

## See also

- [hi-mcp-tools.md](./hi-mcp-tools.md) — the tools the model calls
- [ai-chat.md](../../minimal-hi-example/docs/ai-chat.md) — the chat backend and its providers
- [Feature analysis of the script](../feature-analysis/hi-mcp-prompt-run-script.md)
