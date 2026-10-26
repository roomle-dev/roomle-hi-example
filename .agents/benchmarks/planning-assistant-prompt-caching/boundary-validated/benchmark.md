# HI MCP benchmark

| Model | Test | Runs | Chat s mean | median | min | max | Steps mean | Input tokens mean |
|---|---|---|---|---|---|---|---|---|
| gpt-6.1-sol | full-kitchen-walnut-marble-corner | 1 (fewer than 2) | 154.9 | 154.9 | 154.9 | 154.9 | 8.0 | 829.8k |
| gpt-6.1-sol | image-kitchen-left-wall | 1 (fewer than 2) | 134.0 | 134.0 | 134.0 | 134.0 | 7.0 | 657.4k |
| gpt-6.1-sol | image-only-no-text | 1 (fewer than 2) | 217.5 | 217.5 | 217.5 | 217.5 | 11.0 | 1049.3k |
| gpt-6.1-sol | edit-add-move-delete-subarticle | 1 (fewer than 2) | 222.8 | 222.8 | 222.8 | 222.8 | 12.0 | 1140.7k |

## Runs

| Run | Model | Test | Chat s | Steps | Model s | Tools s | Other s | Input tokens | Output tokens | Reasoning tokens | Plan changes | Corrections | Not loaded | Errors | Left out |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | gpt-6.1-sol | full-kitchen-walnut-marble-corner | 154.9 | 8 | 148.1 | – | – | 829.8k | 1489 | 379 | 3 | 0 | 0 | 0 |  |
| 2 | gpt-6.1-sol | image-kitchen-left-wall | 134.0 | 7 | 130.7 | – | – | 657.4k | 1434 | 424 | 3 | 2 | 0 | 1 |  |
| 3 | gpt-6.1-sol | image-only-no-text | 217.5 | 11 | 211.3 | – | – | 1049.3k | 2412 | 629 | 8 | 3 | 0 | 4 |  |
| 4 | gpt-6.1-sol | edit-add-move-delete-subarticle | 222.8 | 12 | 222.0 | – | – | 1140.7k | 725 | 25 | 3 | 2 | 0 | 0 |  |

## Cache and transport measurements

Coverage is per field and turn. Missing counters are unknown. Cache reads are a subset of input tokens; request bytes still cross the network. SDK model-call timings include any test request pacing, and may overlap tool execution. They do not isolate prefill. First output can be reasoning or a tool call.

| Run | Turn | Cache read / coverage | Cache write / coverage | Request bytes | Reference bytes | First output ms | First visible text ms |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 696021 / complete | 133804 / complete | 6115609 | 295383 | 3617.4000000059605 | 52955.70000001788 |
| 2 | 1 | 625637 / complete | 31712 / complete | 7446718 | 295383 | 7205.300000011921 | 45504 |
| 3 | 1 | 1013525 / complete | 35789 / complete | 12750640 | 295383 | 4882.5999999940395 | 37632.59999999404 |
| 4 | 1 | 315693 / complete | 15748 / complete | 1467388 | 295383 | 3253.7999999821186 | 64506 |
| 4 | 2 | 373670 / complete | 10405 / complete | 1645355 | 295383 | 20776.29999998212 | 77131.59999999404 |
| 4 | 3 | 415244 / complete | 9934 / complete | 1780472 | 295383 | 19269.69999998808 | 79150.30000001192 |

## Tools

| Model | Tool | Calls | Calls per run | Total s | Mean ms |
|---|---|---|---|---|---|
| gpt-6.1-sol | create-or-replace-groups | 3 | 0.8 | 7.4 | 2452 |
| gpt-6.1-sol | exchange-root-module | 2 | 0.5 | 2.6 | 1323 |
| gpt-6.1-sol | change-module-attribute | 2 | 0.5 | 2.6 | 1313 |
| gpt-6.1-sol | get-plan-images | 3 | 0.8 | 2.5 | 822 |
| gpt-6.1-sol | change-group-attribute | 7 | 1.8 | 2.2 | 310 |
| gpt-6.1-sol | move-interior-fitting | 1 | 0.3 | 0.2 | 221 |
| gpt-6.1-sol | add-interior-fitting | 1 | 0.3 | 0.2 | 186 |
| gpt-6.1-sol | get-plan-context | 15 | 3.8 | 0.2 | 11 |
| gpt-6.1-sol | get-interior-design-options | 3 | 0.8 | 0.2 | 54 |
| gpt-6.1-sol | delete-interior-fittings | 1 | 0.3 | 0.1 | 146 |
| gpt-6.1-sol | get-skill | 8 | 2.0 | 0.0 | 5 |

## 1 gpt-6.1-sol — full-kitchen-walnut-marble-corner

`.temp/result/prompt-caching-boundary-validated-1/gpt-6.1-sol/01-full-kitchen-walnut-marble-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 3.7 | – | 3.7 | 74.9k | 62 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 18.6 | – | 18.6 | 80.5k | 30 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 39.8 | – | 39.8 | 83.6k | 870 | 254 | – |  |
| 4 | 1 | — (tool-calls) | 3.7 | – | 3.7 | 95.7k | 59 | 29 | – |  |
| 5 | 1 | — (tool-calls) | 23.4 | – | 23.4 | 109.5k | 153 | 76 | – |  |
| 6 | 1 | — (tool-calls) | 17.8 | – | 17.8 | 120.5k | 117 | 20 | – |  |
| 7 | 1 | — (tool-calls) | 15.9 | – | 15.9 | 131.4k | 15 | 0 | – |  |
| 8 | 1 | — (stop) | 25.2 | – | 25.2 | 133.8k | 183 | 0 | – |  |

## 2 gpt-6.1-sol — image-kitchen-left-wall

`.temp/result/prompt-caching-boundary-validated-1/gpt-6.1-sol/02-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 7.5 | – | 7.5 | 77.2k | 79 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 22.9 | – | 22.9 | 84.1k | 185 | 153 | – |  |
| 3 | 1 | — (tool-calls) | 22.3 | – | 22.3 | 87.3k | 609 | 50 | – |  |
| 4 | 1 | — (tool-calls) | 11.1 | – | 11.1 | 94.7k | 71 | 41 | – |  |
| 5 | 1 | — (tool-calls) | 24.5 | – | 24.5 | 103.7k | 101 | 44 | – |  |
| 6 | 1 | — (tool-calls) | 15.5 | – | 15.5 | 103.9k | 142 | 49 | – |  |
| 7 | 1 | — (stop) | 26.8 | – | 26.8 | 106.5k | 247 | 87 | – |  |

## 3 gpt-6.1-sol — image-only-no-text

`.temp/result/prompt-caching-boundary-validated-1/gpt-6.1-sol/03-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 5.0 | – | 5.0 | 76.1k | 79 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 37.9 | – | 37.9 | 83.8k | 390 | 275 | – |  |
| 3 | 1 | — (tool-calls) | 11.6 | – | 11.6 | 87.2k | 628 | 0 | – |  |
| 4 | 1 | — (tool-calls) | 21.1 | – | 21.1 | 95.3k | 363 | 32 | – |  |
| 5 | 1 | — (tool-calls) | 10.5 | – | 10.5 | 96.1k | 105 | 24 | – |  |
| 6 | 1 | — (tool-calls) | 21.8 | – | 21.8 | 96.3k | 98 | 0 | – |  |
| 7 | 1 | — (tool-calls) | 16.5 | – | 16.5 | 96.8k | 140 | 18 | – |  |
| 8 | 1 | — (tool-calls) | 19.6 | – | 19.6 | 97.2k | 31 | 14 | – |  |
| 9 | 1 | — (tool-calls) | 23.0 | – | 23.0 | 99.7k | 124 | 94 | – |  |
| 10 | 1 | — (tool-calls) | 18.0 | – | 18.0 | 110.4k | 154 | 62 | – |  |
| 11 | 1 | — (stop) | 26.3 | – | 26.3 | 110.6k | 300 | 110 | – |  |

## 4 gpt-6.1-sol — edit-add-move-delete-subarticle

`.temp/result/prompt-caching-boundary-validated-1/gpt-6.1-sol/04-edit-add-move-delete-subarticle`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 3.8 | – | 3.8 | 74.8k | 28 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 19.5 | – | 19.5 | 79.7k | 67 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 22.0 | – | 22.0 | 86.3k | 165 | 25 | – |  |
| 4 | 1 | — (stop) | 19.5 | – | 19.5 | 90.6k | 41 | 0 | – |  |
| 5 | 2 | — (tool-calls) | 21.4 | – | 21.4 | 90.6k | 28 | 0 | – |  |
| 6 | 2 | — (tool-calls) | 17.1 | – | 17.1 | 95.8k | 77 | 0 | – |  |
| 7 | 2 | — (tool-calls) | 22.7 | – | 22.7 | 96.8k | 80 | 0 | – |  |
| 8 | 2 | — (stop) | 16.4 | – | 16.4 | 101.0k | 28 | 0 | – |  |
| 9 | 3 | — (tool-calls) | 19.6 | – | 19.6 | 101.0k | 28 | 0 | – |  |
| 10 | 3 | — (tool-calls) | 24.8 | – | 24.8 | 106.1k | 79 | 0 | – |  |
| 11 | 3 | — (tool-calls) | 16.1 | – | 16.1 | 107.2k | 71 | 0 | – |  |
| 12 | 3 | — (stop) | 19.1 | – | 19.1 | 110.9k | 33 | 0 | – |  |
