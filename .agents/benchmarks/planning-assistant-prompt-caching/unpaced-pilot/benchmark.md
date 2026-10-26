# HI MCP benchmark

| Model | Test | Runs | Chat s mean | median | min | max | Steps mean | Input tokens mean |
|---|---|---|---|---|---|---|---|---|
| gpt-6.1-sol | full-kitchen-walnut-marble-corner | 1 (fewer than 2) | 39.5 | 39.5 | 39.5 | 39.5 | 6.0 | 456.4k |
| gpt-6.1-sol | edit-add-move-delete-subarticle | 1 (fewer than 2) | 72.9 | 72.9 | 72.9 | 72.9 | 10.0 | 488.9k |

Left out of the per-test and tool tables, because the chat ended with an error: run 2 (The planning assistant failed: Failed after 3 attempts. Last error: AI_APICallError: Your requests to gpt-6.1-sol for gpt-6.1-sol in swedencentral have exceeded token rate limit.), run 3 (The planning assistant failed: Failed after 3 attempts. Last error: AI_APICallError: Your requests to gpt-6.1-sol for gpt-6.1-sol in swedencentral have exceeded token rate limit.), run 4 (The planning assistant failed: Failed after 3 attempts. Last error: AI_APICallError: Your requests to gpt-6.1-sol for gpt-6.1-sol in swedencentral have exceeded token rate limit.), run 5 (The planning assistant failed: Failed after 3 attempts. Last error: AI_APICallError: Your requests to gpt-6.1-sol for gpt-6.1-sol in swedencentral have exceeded token rate limit.), run 6 (The planning assistant failed: Failed to process successful response), run 7 (The planning assistant failed: Failed after 3 attempts. Last error: AI_APICallError: Your requests to gpt-6.1-sol for gpt-6.1-sol in swedencentral have exceeded token rate limit.).

## Runs

| Run | Model | Test | Chat s | Steps | Model s | Tools s | Other s | Input tokens | Output tokens | Reasoning tokens | Plan changes | Corrections | Not loaded | Errors | Left out |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | gpt-6.1-sol | full-kitchen-walnut-marble-corner | 39.5 | 6 | 35.9 | – | – | 456.4k | 969 | 116 | 1 | 1 | 0 | 0 |  |
| 2 | gpt-6.1-sol | image-kitchen-left-wall | 57.7 | 5 | 42.9 | – | – | 364.2k | 2052 | 209 | 3 | 2 | 0 | 2 | chat error |
| 3 | gpt-6.1-sol | image-kitchen-left-wall | 66.3 | 5 | 43.6 | – | – | 373.6k | 1498 | 160 | 3 | 4 | 0 | 1 | chat error |
| 4 | gpt-6.1-sol | image-kitchen-left-wall | 65.7 | 5 | 42.4 | – | – | 369.6k | 1293 | 147 | 3 | 3 | 0 | 1 | chat error |
| 5 | gpt-6.1-sol | image-only-no-text | 89.4 | 7 | 67.7 | – | – | 482.1k | 1987 | 489 | 5 | 6 | 0 | 3 | chat error |
| 6 | gpt-6.1-sol | image-only-no-text | 58.6 | 2 | 8.5 | – | – | 20.0k | 86 | 0 | 0 | 0 | 0 | 1 | chat error |
| 7 | gpt-6.1-sol | image-only-no-text | 89.2 | 9 | 75.8 | – | – | 675.6k | 2426 | 560 | 9 | 4 | 0 | 7 | chat error |
| 8 | gpt-6.1-sol | edit-add-move-delete-subarticle | 72.9 | 10 | 45.9 | – | – | 488.9k | 663 | 19 | 3 | 2 | 0 | 0 |  |

## Cache and transport measurements

Coverage is per field and turn. Missing counters are unknown. Cache reads are a subset of input tokens; request bytes still cross the network. SDK model-call timings include any test request pacing, and may overlap tool execution. They do not isolate prefill. First output can be reasoning or a tool call.

| Run | Turn | Cache read / coverage | Cache write / coverage | Request bytes | Reference bytes | First output ms | First visible text ms |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 359614 / complete | 96777 / complete | 4601423 | – | 3829.699999988079 | 36383.59999999404 |
| 2 | 1 | 353358 / complete | 10842 / complete | 5654629 | – | 5399.299999982119 | 10595.40000000596 |
| 3 | 1 | 285175 / complete | 88433 / complete | 6399804 | – | 4920.5 | 13108.299999982119 |
| 4 | 1 | 359047 / complete | 10585 / complete | 7016791 | – | 5949.800000011921 | 11258.800000011921 |
| 5 | 1 | 467453 / complete | 14580 / complete | 12576753 | – | 2947.5999999940395 | 25697.20000001788 |
| 6 | 1 | 17467 / complete | 2540 / complete | 1206052 | – | 5121.5999999940395 | – |
| 7 | 1 | 660898 / complete | 14685 / complete | 7314467 | – | 3760.0999999940395 | 25218.40000000596 |
| 8 | 1 | 105047 / complete | 43888 / complete | 667812 | – | 3026.300000011921 | 18371.09999999404 |
| 8 | 2 | 157034 / complete | 5278 / complete | 938121 | – | 4452.399999976158 | 15513.09999999404 |
| 8 | 3 | 172838 / complete | 4805 / complete | 2239293 | – | 2028.5 | 34174.90000000596 |

## Tools

| Model | Tool | Calls | Calls per run | Total s | Mean ms |
|---|---|---|---|---|---|
| gpt-6.1-sol | create-or-replace-groups | 1 | 0.5 | 2.9 | 2932 |
| gpt-6.1-sol | get-plan-images | 1 | 0.5 | 0.6 | 567 |
| gpt-6.1-sol | move-interior-fitting | 1 | 0.5 | 0.2 | 208 |
| gpt-6.1-sol | add-interior-fitting | 1 | 0.5 | 0.2 | 175 |
| gpt-6.1-sol | get-interior-design-options | 3 | 1.5 | 0.1 | 50 |
| gpt-6.1-sol | delete-interior-fittings | 1 | 0.5 | 0.1 | 148 |
| gpt-6.1-sol | get-plan-context | 3 | 1.5 | 0.0 | 14 |
| gpt-6.1-sol | get-skill | 2 | 1.0 | 0.0 | 11 |
| gpt-6.1-sol | get-authoring-rules | 1 | 0.5 | 0.0 | 21 |

## 1 gpt-6.1-sol — full-kitchen-walnut-marble-corner

`.temp/result/prompt-caching-baseline-1/gpt-6.1-sol/01-full-kitchen-walnut-marble-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 4.3 | – | 4.3 | 8.2k | 65 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 6.1 | – | 6.1 | 80.4k | 133 | 101 | – |  |
| 3 | 1 | — (tool-calls) | 11.5 | – | 11.5 | 83.5k | 565 | 0 | – |  |
| 4 | 1 | — (tool-calls) | 2.7 | – | 2.7 | 93.2k | 38 | 15 | – |  |
| 5 | 1 | — (tool-calls) | 4.0 | – | 4.0 | 94.3k | 15 | 0 | – |  |
| 6 | 1 | — (stop) | 7.2 | – | 7.2 | 96.8k | 153 | 0 | – |  |

## 2 gpt-6.1-sol — image-kitchen-left-wall (left out)

`.temp/result/prompt-caching-baseline-1/gpt-6.1-sol/02-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 5.6 | – | 5.6 | 10.5k | 82 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 7.4 | – | 7.4 | 83.9k | 194 | 87 | – |  |
| 3 | 1 | — (tool-calls) | 10.9 | – | 10.9 | 87.1k | 727 | 0 | – |  |
| 4 | 1 | — (tool-calls) | 12.3 | – | 12.3 | 88.0k | 785 | 56 | – |  |
| 5 | 1 | — (tool-calls) | 6.8 | – | 6.8 | 94.7k | 264 | 66 | – |  |

## 3 gpt-6.1-sol — image-kitchen-left-wall (left out)

`.temp/result/prompt-caching-baseline-1/gpt-6.1-sol/02-image-kitchen-left-wall.attempt-1`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 5.1 | – | 5.1 | 10.5k | 82 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 10.5 | – | 10.5 | 83.9k | 199 | 101 | – |  |
| 3 | 1 | — (tool-calls) | 15.5 | – | 15.5 | 87.1k | 809 | 0 | – |  |
| 4 | 1 | — (tool-calls) | 7.1 | – | 7.1 | 95.6k | 253 | 42 | – |  |
| 5 | 1 | — (tool-calls) | 5.5 | – | 5.5 | 96.5k | 155 | 17 | – |  |

## 4 gpt-6.1-sol — image-kitchen-left-wall (left out)

`.temp/result/prompt-caching-baseline-1/gpt-6.1-sol/02-image-kitchen-left-wall.attempt-2`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 6.4 | – | 6.4 | 10.5k | 82 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 6.8 | – | 6.8 | 83.9k | 169 | 68 | – |  |
| 3 | 1 | — (tool-calls) | 11.0 | – | 11.0 | 87.1k | 676 | 0 | – |  |
| 4 | 1 | — (tool-calls) | 9.4 | – | 9.4 | 93.7k | 223 | 41 | – |  |
| 5 | 1 | — (tool-calls) | 8.9 | – | 8.9 | 94.5k | 143 | 38 | – |  |

## 5 gpt-6.1-sol — image-only-no-text (left out)

`.temp/result/prompt-caching-baseline-1/gpt-6.1-sol/03-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 3.4 | – | 3.4 | 9.4k | 21 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 4.7 | – | 4.7 | 10.6k | 65 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 19.2 | – | 19.2 | 83.6k | 501 | 384 | – |  |
| 4 | 1 | — (tool-calls) | 15.8 | – | 15.8 | 87.1k | 813 | 0 | – |  |
| 5 | 1 | — (tool-calls) | 11.3 | – | 11.3 | 96.0k | 314 | 28 | – |  |
| 6 | 1 | — (tool-calls) | 7.3 | – | 7.3 | 97.2k | 236 | 57 | – |  |
| 7 | 1 | — (tool-calls) | 6.0 | – | 6.0 | 98.2k | 37 | 20 | – |  |

## 6 gpt-6.1-sol — image-only-no-text (left out)

`.temp/result/prompt-caching-baseline-1/gpt-6.1-sol/03-image-only-no-text.attempt-1`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 5.5 | – | 5.5 | 9.4k | 21 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 3.1 | – | 3.1 | 10.6k | 65 | 0 | – |  |

## 7 gpt-6.1-sol — image-only-no-text (left out)

`.temp/result/prompt-caching-baseline-1/gpt-6.1-sol/03-image-only-no-text.attempt-2`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 4.0 | – | 4.0 | 9.4k | 21 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 4.1 | – | 4.1 | 10.6k | 65 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 19.2 | – | 19.2 | 83.6k | 462 | 356 | – |  |
| 4 | 1 | — (tool-calls) | 14.9 | – | 14.9 | 87.1k | 864 | 108 | – |  |
| 5 | 1 | — (tool-calls) | 7.7 | – | 7.7 | 95.4k | 329 | 20 | – |  |
| 6 | 1 | — (tool-calls) | 6.8 | – | 6.8 | 96.2k | 277 | 16 | – |  |
| 7 | 1 | — (tool-calls) | 10.2 | – | 10.2 | 97.1k | 250 | 49 | – |  |
| 8 | 1 | — (tool-calls) | 5.2 | – | 5.2 | 97.9k | 135 | 11 | – |  |
| 9 | 1 | — (tool-calls) | 3.6 | – | 3.6 | 98.3k | 23 | 0 | – |  |

## 8 gpt-6.1-sol — edit-add-move-delete-subarticle

`.temp/result/prompt-caching-baseline-1/gpt-6.1-sol/04-edit-add-move-delete-subarticle`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 3.4 | – | 3.4 | 8.1k | 22 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 2.5 | – | 2.5 | 41.1k | 67 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 4.1 | – | 4.1 | 47.7k | 162 | 19 | – |  |
| 4 | 1 | — (stop) | 10.9 | – | 10.9 | 52.0k | 45 | 0 | – |  |
| 5 | 2 | — (tool-calls) | 6.5 | – | 6.5 | 52.0k | 77 | 0 | – |  |
| 6 | 2 | — (tool-calls) | 3.3 | – | 3.3 | 53.0k | 80 | 0 | – |  |
| 7 | 2 | — (stop) | 4.2 | – | 4.2 | 57.2k | 27 | 0 | – |  |
| 8 | 3 | — (tool-calls) | 2.9 | – | 2.9 | 57.3k | 79 | 0 | – |  |
| 9 | 3 | — (tool-calls) | 4.1 | – | 4.1 | 58.3k | 71 | 0 | – |  |
| 10 | 3 | — (stop) | 4.0 | – | 4.0 | 62.1k | 33 | 0 | – |  |
