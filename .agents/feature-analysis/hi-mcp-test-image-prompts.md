# Feature Analysis: Image prompts in "test the mcp"

> **Type**: Feature Analysis
> **Domain**: agent tooling — `.agents/scripts/run-hi-mcp-prompt.js`, `.agents/skills/hi-mcp-testing.md`, `docs/test-prompts.md`
> **Trigger**: RML-18027 ("Run tests with images if possible"), request of 2026-10-02: run the image prompts in "test the mcp"; the kitchen-1 prompt on the left-hand wall; `kitchen-3.jpeg` with "create a planning as to the one shown in the picture on the right-hand wall of the room."; `kitchen-4` with a completely empty prompt; rename `docs/testing-prompts.md` to `docs/test-prompts.md`
> **Date**: 2026-10-02
> **Author**: AI Assistant
> **Status**: Implemented
> **Branch**: `feat/tests-and-plans` (roomle-hi-example)
> **Builds on**: [test the mcp](hi-mcp-test-the-mcp-skill.md), [images in the chat](chat-image-input.md)

## What was asked and why

Every "test the mcp" report listed the image prompts as "2 skipped (image)": the script sent text
only. Since [images in the chat](chat-image-input.md), the chat backend accepts an image on a user
message, so the suite can run them. Two new image prompts join the suite, one of them without any
text — the model decides from the image alone.

## How it works today

- The chat backend takes `images: [<data URL>]` on a user message
  ([chat-config.ts](../../hi-mcp/hi-mcp-chat/chat-config.ts) `parseChatMessages`); an image with an
  empty text becomes "Plan a kitchen like the one in the image." (`toModelMessages`); a model that
  reads no images gets HTTP 400 ([chat-handler.ts](../../hi-mcp/hi-mcp-chat/chat-handler.ts)).
- The chat window redraws a dropped image as JPEG (quality 0.9) on white, EXIF rotation applied,
  long side at most 1568 px (`prepareImage` in
  [index.html](../../minimal-hi-example/index.html)).
- `run-hi-mcp-prompt.js` POSTs `{ role: 'user', content }` per turn — no image.
- The skill skips every prompt with a `*Reference: …*` line.

## Design

- `run-hi-mcp-prompt.js --image <file>`: the image goes along with the **last** prompt (the prompt
  under test; setup turns come first). The script reads the file before it starts anything, so a
  wrong path fails at once, and prepares the image in the run's Playwright page with the chat
  window's steps and constants — the model gets what it would get from a drop.
- The result holds `prompt-image.jpg` (the image as sent) and `run.json` `turns[].image` (the file).
- An empty prompt is `""` — the chat backend gives it its default text, as for a drop without text.
- The skill passes `--image docs/images/<file>` for every prompt with a reference line, runs image
  prompts only for a model that reads images (`readsImages` in `chat-config.ts`), shows the image
  beside the plan in the report and judges the plan against it.
- `docs/test-prompts.md`: kitchen-1 on the left-hand wall, kitchen-3 and kitchen-4 added; an empty
  fenced block is the empty prompt. The images are renamed to `kitchen-3.jpeg` and `kitchen-4.png`
  (kebab-case like `kitchen-1.png`; `kithcen_4.PNG` was misspelled).

## Alternatives

| Alternative | Why not |
|---|---|
| Send the file unchanged | A 4032×3024 photo would reach the model at a size the chat window never sends; results would differ from the chat |
| Drop the file on the chat overlay and read the attached image | Depends on the chat UI's DOM and its capabilities fetch; the script does not use the chat UI otherwise |
| Expose `prepareImage` on `window` | Changes the example page for a test script |
| `--image` per turn | No prompt of the suite needs an image in a setup turn |

## Touched

`.agents/scripts/run-hi-mcp-prompt.js`, `.agents/skills/hi-mcp-testing.md`, `docs/test-prompts.md`
(renamed from `testing-prompts.md`; links updated in `AGENTS.md`, `.github/copilot-instructions.md`,
`.agents/README.md` and the feature analyses), `docs/images/kitchen-3.jpeg`, `docs/images/kitchen-4.png`.

## Close-out (2026-10-02)

Implemented as designed. Smoke run: `gpt-5.4-mini`, empty prompt, `--image docs/images/kitchen-4.png`
— exit 0, `run.json` `turns[0].image` set, `prompt-image.jpg` 896×1195, the model answered "a simple
U-shaped, handleless kitchen inspired by the photo" and created the group (`ps_qphyyjuqikrrfdx3kdh6a147bbltij7`).

Full "test the mcp" run, `gpt-5.4-mini`, `.temp/result/mcp-test-2026-10-02_12-45-24/`:
- all 17 prompts ran, none skipped;
- every image reached the model: kitchen-3 went from 4032×3024 to 1568×1176, and kitchen-1 from
  1858×1512 to 1568×1276;
- all four image prompts fail, on placement (3) and on a server correction (1). The findings went
  to [the open issues](../backlog/mcp-test-open-issues.md) (#1, #6, #12, #14).
