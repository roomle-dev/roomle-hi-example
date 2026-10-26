# Direct OpenAI models in the example launcher

> **Type**: Feature analysis
> **Status**: Implemented — published dev build, retained until merge
> **Date**: 2026-10-26

## Affected repositories

- **roomle-hi-example**: parse `openai:<model-id>`, test both launcher modes and document the commands.
- **roomle-ui**: add OpenAI to the embedding-lib's planning-assistant provider loader and its tests/reference.

## Request and current gap

The requested commands are `npm start openai:<model-id> $OPENAI_ASSISTANT_API_KEY` and
`npm run dev openai:<model-id> $OPENAI_ASSISTANT_API_KEY`. Both scripts already forward arguments
to `minimal-hi-example/start.mjs`. Its `planningAssistantConfig` recognises Azure deployments and
other provider aliases, but no OpenAI prefix. The embedding-lib's `loadChatModel` also rejects an
`openai` provider. Changing the launcher alone cannot make the assistant work.

## Decisions

The explicit prefix selects provider `openai`; the suffix is the exact model ID, including case
and any additional colons. An empty suffix is a command error. Azure environment variables and
`HI_CHAT_MODEL` do not replace this explicit model. Existing unprefixed aliases retain their
meaning. The image input is available for this provider; users choose a model supporting the
planning assistant's tool and image inputs.

The embedding-lib loads the pinned `@ai-sdk/openai` adapter and uses its Responses model. This
provides OpenAI's endpoint and Bearer authentication; redirecting the Azure adapter would use
the wrong provider/authentication contract. Azure-only reference breakpoints are not enabled.
The existing loop, tools and token accounting need no changes.

## Validation and release

Launcher integration tests cover normal/dev URLs, exact IDs, environment isolation, hidden keys
and empty-model feedback. Embedding tests cover provider selection and a real adapter request
with a fake HTTP response, including endpoint, model and authorization. No paid model call is
needed. Living references and usage examples change with the code.

The checked-in example loads a published embedding-lib. A new dev version and import update are
required to activate direct OpenAI support. `AGENTS.md` requires separate approval for that one
build/publication; the previous build approval covers only `b626163`.

## Implementation verification

The launcher and embedding provider are implemented. UI commit `2de442370` is on
`feat/hi-mcp-merge`. All six launcher integration tests and all 35 tests in the affected
embedding/provider suites pass. The real OpenAI adapter test verifies the `/v1/responses` URL,
Bearer key, exact model ID and request observation without a paid API call. UI, SDK and embedding
type checks and code lint pass; the full lint pipeline stops at its existing UI TypeDoc warnings.
Example formatting and lint pass.

The user approved the new build. UI commit `2de442370` is pushed on `feat/hi-mcp-merge`, and
[workflow 40318680232](https://github.com/roomle-dev/roomle-ui/actions/runs/40318680232) published
`0.0.0-dev-2de4423`. Both example imports pin that exact package through jsDelivr's npm CDN.
The browser verification loads both published entry points and the real CDN OpenAI adapter,
checks all exports used by the page, and completes an OpenAI Responses request with a mocked
HTTP response and a dummy key. No paid model call is made. Example formatting and lint pass.

The feature is active in the example. This record is retained until merge to the default branch.
