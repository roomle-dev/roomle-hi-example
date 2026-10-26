# HI MCP benchmark

| Model | Test | Runs | Chat s mean | median | min | max | Steps mean | Input tokens mean |
|---|---|---|---|---|---|---|---|---|

Left out of the per-test and tool tables, because the chat ended with an error: run 1 (The planning assistant failed: Invalid 'prompt_cache_key': string too long. Expected a string with maximum length 64, but got a string with length 77 instead.), run 2 (The planning assistant failed: Invalid 'prompt_cache_key': string too long. Expected a string with maximum length 64, but got a string with length 77 instead.), run 3 (The planning assistant failed: Invalid 'prompt_cache_key': string too long. Expected a string with maximum length 64, but got a string with length 77 instead.), run 4 (The planning assistant failed: Invalid 'prompt_cache_key': string too long. Expected a string with maximum length 64, but got a string with length 77 instead.).

## Runs

| Run | Model | Test | Chat s | Steps | Model s | Tools s | Other s | Input tokens | Output tokens | Reasoning tokens | Plan changes | Corrections | Not loaded | Errors | Left out |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | gpt-6.1-sol | full-kitchen-walnut-marble-corner | 2.0 | 0 | – | – | – | – | null | null | 0 | 0 | 0 | 1 | chat error |
| 2 | gpt-6.1-sol | image-kitchen-left-wall | 1.0 | 0 | – | – | – | – | null | null | 0 | 0 | 0 | 1 | chat error |
| 3 | gpt-6.1-sol | image-only-no-text | 1.0 | 0 | – | – | – | – | null | null | 0 | 0 | 0 | 1 | chat error |
| 4 | gpt-6.1-sol | edit-add-move-delete-subarticle | 0.8 | 0 | – | – | – | – | null | null | 0 | 0 | 0 | 1 | chat error |

## Cache and transport measurements

Coverage is per field and turn. Missing counters are unknown. Cache reads are a subset of input tokens; request bytes still cross the network. SDK model-call timings include any test request pacing, and may overlap tool execution. They do not isolate prefill. First output can be reasoning or a tool call.

| Run | Turn | Cache read / coverage | Cache write / coverage | Request bytes | Reference bytes | First output ms | First visible text ms |
|---|---|---|---|---|---|---|---|
| 1 | 1 | – / unavailable | – / unavailable | 339254 | 295383 | – | – |
| 2 | 1 | – / unavailable | – / unavailable | 604018 | 295383 | – | – |
| 3 | 1 | – / unavailable | – / unavailable | 585078 | 295383 | – | – |
| 4 | 1 | – / unavailable | – / unavailable | 339035 | 295383 | – | – |

## Tools

| Model | Tool | Calls | Calls per run | Total s | Mean ms |
|---|---|---|---|---|---|

## 1 gpt-6.1-sol — full-kitchen-walnut-marble-corner (left out)

`.temp/result/prompt-caching-boundary-1/gpt-6.1-sol/01-full-kitchen-walnut-marble-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|

## 2 gpt-6.1-sol — image-kitchen-left-wall (left out)

`.temp/result/prompt-caching-boundary-1/gpt-6.1-sol/02-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|

## 3 gpt-6.1-sol — image-only-no-text (left out)

`.temp/result/prompt-caching-boundary-1/gpt-6.1-sol/03-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|

## 4 gpt-6.1-sol — edit-add-move-delete-subarticle (left out)

`.temp/result/prompt-caching-boundary-1/gpt-6.1-sol/04-edit-add-move-delete-subarticle`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
