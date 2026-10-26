# HI MCP benchmark

| Model | Test | Runs | Chat s mean | median | min | max | Steps mean | Input tokens mean |
|---|---|---|---|---|---|---|---|---|
| gpt-6-astra | edit-add-move-delete-subarticle | 1 (fewer than 2) | 115.3 | 115.3 | 115.3 | 115.3 | 12.0 | 1141.6k |
| gpt-6-astra | sink-cabinet-at-water-connection | 1 (fewer than 2) | 36.7 | 36.7 | 36.7 | 36.7 | 5.0 | 412.6k |
| gpt-6-astra | kitchen-oven-hood-sink-fridge-corner | 1 (fewer than 2) | 51.1 | 51.1 | 51.1 | 51.1 | 5.0 | 430.5k |
| gpt-6-astra | kitchen-oven-fridge-sink-corner | 1 (fewer than 2) | 42.0 | 42.0 | 42.0 | 42.0 | 5.0 | 441.8k |
| gpt-6-astra | full-kitchen-walnut-marble-corner | 1 (fewer than 2) | 45.1 | 45.1 | 45.1 | 45.1 | 5.0 | 431.0k |
| gpt-6-astra | kitchen-family-two-kids | 1 (fewer than 2) | 58.5 | 58.5 | 58.5 | 58.5 | 5.0 | 449.5k |
| gpt-6-astra | image-kitchen-left-wall | 1 (fewer than 2) | 47.0 | 47.0 | 47.0 | 47.0 | 7.0 | 632.1k |
| gpt-6-astra | image-kitchen-back-right-corner | 1 (fewer than 2) | 171.1 | 171.1 | 171.1 | 171.1 | 14.0 | 1719.5k |
| gpt-6-astra | image-planning-right-wall | 1 (fewer than 2) | 95.4 | 95.4 | 95.4 | 95.4 | 6.0 | 545.2k |
| gpt-6-astra | image-only-no-text | 1 (fewer than 2) | 216.4 | 216.4 | 216.4 | 216.4 | 16.0 | 1658.1k |

Left out of the per-test and tool tables, because the chat ended with an error: run 2 (The planning assistant failed: Failed after 3 attempts. Last error: AI_APICallError: Your requests to gpt-6-astra for gpt-6-astra in swedencentral have exceeded token rate limit.), run 3 (The planning assistant failed: Failed after 3 attempts. Last error: AI_APICallError: Your requests to gpt-6-astra for gpt-6-astra in swedencentral have exceeded token rate limit.), run 9 (The planning assistant failed: Failed after 3 attempts. Last error: AI_APICallError: Your requests to gpt-6-astra for gpt-6-astra in swedencentral have exceeded token rate limit.).

## Runs

| Run | Model | Test | Chat s | Steps | Model s | Tools s | Other s | Input tokens | Output tokens | Reasoning tokens | Plan changes | Corrections | Not loaded | Errors | Left out |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | gpt-6-astra | edit-add-move-delete-subarticle | 115.3 | 12 | 48.1 | – | – | 1141.6k | 739 | 51 | 3 | 2 | 0 | 0 |  |
| 2 | gpt-6-astra | edit-add-move-delete-subarticle | 51.7 | 8 | 27.1 | – | – | 715.8k | 531 | 53 | 2 | 1 | 0 | 1 | chat error |
| 3 | gpt-6-astra | edit-add-move-delete-subarticle | 8.5 | 0 | – | – | – | – | null | null | 0 | 0 | 0 | 1 | chat error |
| 4 | gpt-6-astra | sink-cabinet-at-water-connection | 36.7 | 5 | 24.0 | – | – | 412.6k | 655 | 172 | 2 | 0 | 0 | 0 |  |
| 5 | gpt-6-astra | kitchen-oven-hood-sink-fridge-corner | 51.1 | 5 | 45.4 | – | – | 430.5k | 1291 | 429 | 1 | 2 | 0 | 0 |  |
| 6 | gpt-6-astra | kitchen-oven-fridge-sink-corner | 42.0 | 5 | 38.7 | – | – | 441.8k | 1274 | 363 | 1 | 2 | 0 | 0 |  |
| 7 | gpt-6-astra | full-kitchen-walnut-marble-corner | 45.1 | 5 | 41.6 | – | – | 431.0k | 1335 | 493 | 1 | 1 | 0 | 0 |  |
| 8 | gpt-6-astra | kitchen-family-two-kids | 58.5 | 5 | 44.9 | – | – | 449.5k | 1577 | 462 | 1 | 2 | 0 | 0 |  |
| 9 | gpt-6-astra | kitchen-family-two-kids | 53.7 | 3 | 41.1 | – | – | 238.9k | 1267 | 502 | 1 | 2 | 0 | 1 | chat error |
| 10 | gpt-6-astra | image-kitchen-left-wall | 47.0 | 7 | 44.5 | – | – | 632.1k | 1254 | 288 | 2 | 2 | 0 | 1 |  |
| 11 | gpt-6-astra | image-kitchen-back-right-corner | 171.1 | 14 | 161.1 | – | – | 1719.5k | 5028 | 2070 | 9 | 4 | 0 | 2 |  |
| 12 | gpt-6-astra | image-planning-right-wall | 95.4 | 6 | 91.9 | – | – | 545.2k | 2851 | 1339 | 2 | 3 | 1 | 0 |  |
| 13 | gpt-6-astra | image-only-no-text | 216.4 | 16 | 205.0 | – | – | 1658.1k | 5202 | 2390 | 16 | 8 | 0 | 6 |  |

## Cache and transport measurements

Coverage is per field and turn. Missing counters are unknown. Cache reads are a subset of input tokens; request bytes still cross the network. SDK model-call timings include any test request pacing, and may overlap tool execution. They do not isolate prefill. First output can be reasoning or a tool call.

| Run | Turn | Cache read / coverage | Cache write / coverage | Request bytes | Reference bytes | First output ms | First visible text ms |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 320692 / complete | 10892 / complete | 3276432 | 295383 | 1664.4000000059605 | 34188.79999998212 |
| 1 | 2 | 373978 / complete | 10410 / complete | 3701303 | 295383 | 8668.59999999404 | 36554.5 |
| 1 | 3 | 415604 / complete | 9945 / complete | 4913780 | 295383 | 2725.5 | 39655.29999998212 |
| 2 | 1 | 240899 / complete | 90602 / complete | 1467388 | 295383 | 4305.199999988079 | 13888 |
| 2 | 2 | 373837 / complete | 10406 / complete | 3328107 | 295383 | 3658.9000000059605 | 27938.30000001192 |
| 2 | 3 | – / unavailable | – / unavailable | 1282908 | 295383 | – | – |
| 3 | 1 | – / unavailable | – / unavailable | 1017066 | 295383 | – | – |
| 4 | 1 | 399700 / complete | 12901 / complete | 3043440 | 295383 | 3663.0999999940395 | 16660.80000001192 |
| 5 | 1 | 408312 / complete | 22175 / complete | 4483503 | 295383 | 5046.699999988079 | 28299.399999976158 |
| 6 | 1 | 407857 / complete | 33940 / complete | 4159564 | 295383 | 3998.800000011921 | 19324.40000000596 |
| 7 | 1 | 408577 / complete | 22453 / complete | 4460320 | 295383 | 3066.2999999821186 | 21873.69999998808 |
| 8 | 1 | 419130 / complete | 30367 / complete | 5343090 | 295383 | 2566.5 | 29426.40000000596 |
| 9 | 1 | 230110 / complete | 8742 / complete | 2389585 | 295383 | 9873.59999999404 | 31165.90000000596 |
| 10 | 1 | 609015 / complete | 23025 / complete | 7362653 | 295383 | 3912.7000000178814 | 12979.5 |
| 11 | 1 | 1623063 / complete | 96408 / complete | 34034939 | 295383 | 3140.300000011921 | 30823.5 |
| 12 | 1 | 516665 / complete | 28522 / complete | 6093930 | 295383 | 4395.800000011921 | 45076 |
| 13 | 1 | 1610207 / complete | 47751 / complete | 32633953 | 295383 | 5319.9000000059605 | 31729.5 |

## Tools

| Model | Tool | Calls | Calls per run | Total s | Mean ms |
|---|---|---|---|---|---|
| gpt-6-astra | create-or-replace-groups | 11 | 1.1 | 21.5 | 1953 |
| gpt-6-astra | change-group-attribute | 14 | 1.4 | 8.5 | 605 |
| gpt-6-astra | get-plan-images | 10 | 1.0 | 5.1 | 514 |
| gpt-6-astra | change-module-attribute | 4 | 0.4 | 2.5 | 617 |
| gpt-6-astra | get-plan-context | 29 | 2.9 | 2.3 | 80 |
| gpt-6-astra | delete-article-in-place | 1 | 0.1 | 1.8 | 1815 |
| gpt-6-astra | insert-article-into-group | 1 | 0.1 | 1.2 | 1173 |
| gpt-6-astra | merge-article-into-group | 1 | 0.1 | 1.0 | 1031 |
| gpt-6-astra | exchange-root-module | 1 | 0.1 | 1.0 | 999 |
| gpt-6-astra | merge-groups | 1 | 0.1 | 0.5 | 507 |
| gpt-6-astra | place-group | 1 | 0.1 | 0.4 | 374 |
| gpt-6-astra | find-attributes | 2 | 0.2 | 0.3 | 133 |
| gpt-6-astra | move-interior-fitting | 1 | 0.1 | 0.2 | 195 |
| gpt-6-astra | add-interior-fitting | 1 | 0.1 | 0.2 | 194 |
| gpt-6-astra | get-interior-design-options | 3 | 0.3 | 0.2 | 53 |
| gpt-6-astra | delete-interior-fittings | 1 | 0.1 | 0.1 | 133 |
| gpt-6-astra | get-skill | 22 | 2.2 | 0.1 | 5 |

## 1 gpt-6-astra — edit-add-move-delete-subarticle

`.temp/result/mcp-test-2026-10-26_11-51-16/gpt-6-astra/01-edit-add-move-delete-subarticle`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 2.1 | – | 2.1 | 74.8k | 28 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 3.0 | – | 3.0 | 79.7k | 67 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 5.2 | – | 5.2 | 86.4k | 191 | 51 | – |  |
| 4 | 1 | — (stop) | 5.4 | – | 5.4 | 90.6k | 32 | 0 | – |  |
| 5 | 2 | — (tool-calls) | 9.6 | – | 9.6 | 90.7k | 28 | 0 | – |  |
| 6 | 2 | — (tool-calls) | 3.0 | – | 3.0 | 95.8k | 77 | 0 | – |  |
| 7 | 2 | — (tool-calls) | 2.3 | – | 2.3 | 96.8k | 80 | 0 | – |  |
| 8 | 2 | — (stop) | 6.8 | – | 6.8 | 101.0k | 28 | 0 | – |  |
| 9 | 3 | — (tool-calls) | 3.2 | – | 3.2 | 101.1k | 28 | 0 | – |  |
| 10 | 3 | — (tool-calls) | 2.7 | – | 2.7 | 106.2k | 79 | 0 | – |  |
| 11 | 3 | — (tool-calls) | 2.5 | – | 2.5 | 107.2k | 71 | 0 | – |  |
| 12 | 3 | — (stop) | 2.3 | – | 2.3 | 111.0k | 30 | 0 | – |  |

## 2 gpt-6-astra — edit-add-move-delete-subarticle (left out)

`.temp/result/mcp-test-2026-10-26_11-51-16/gpt-6-astra/01-edit-add-move-delete-subarticle.attempt-1`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 4.7 | – | 4.7 | 74.8k | 28 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 2.4 | – | 2.4 | 79.7k | 67 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 4.6 | – | 4.6 | 86.3k | 192 | 53 | – |  |
| 4 | 1 | — (stop) | 2.8 | – | 2.8 | 90.6k | 31 | 0 | – |  |
| 5 | 2 | — (tool-calls) | 4.3 | – | 4.3 | 90.7k | 28 | 0 | – |  |
| 6 | 2 | — (tool-calls) | 3.0 | – | 3.0 | 95.8k | 77 | 0 | – |  |
| 7 | 2 | — (tool-calls) | 2.9 | – | 2.9 | 96.8k | 80 | 0 | – |  |
| 8 | 2 | — (stop) | 2.6 | – | 2.6 | 101.0k | 28 | 0 | – |  |

## 3 gpt-6-astra — edit-add-move-delete-subarticle (left out)

`.temp/result/mcp-test-2026-10-26_11-51-16/gpt-6-astra/01-edit-add-move-delete-subarticle.attempt-2`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|

## 4 gpt-6-astra — sink-cabinet-at-water-connection

`.temp/result/mcp-test-2026-10-26_11-51-16/gpt-6-astra/02-sink-cabinet-at-water-connection`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 3.9 | – | 3.9 | 74.8k | 62 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 7.1 | – | 7.1 | 80.5k | 110 | 78 | – |  |
| 3 | 1 | — (tool-calls) | 6.2 | – | 6.2 | 83.7k | 288 | 45 | – |  |
| 4 | 1 | — (tool-calls) | 3.7 | – | 3.7 | 85.9k | 109 | 49 | – |  |
| 5 | 1 | — (stop) | 3.1 | – | 3.1 | 87.7k | 86 | 0 | – |  |

## 5 gpt-6-astra — kitchen-oven-hood-sink-fridge-corner

`.temp/result/mcp-test-2026-10-26_11-51-16/gpt-6-astra/03-kitchen-oven-hood-sink-fridge-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 5.6 | – | 5.6 | 74.8k | 62 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 2.6 | – | 2.6 | 80.5k | 30 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 25.7 | – | 25.7 | 83.6k | 1012 | 414 | – |  |
| 4 | 1 | — (tool-calls) | 3.1 | – | 3.1 | 94.5k | 32 | 15 | – |  |
| 5 | 1 | — (stop) | 8.4 | – | 8.4 | 97.0k | 155 | 0 | – |  |

## 6 gpt-6-astra — kitchen-oven-fridge-sink-corner

`.temp/result/mcp-test-2026-10-26_11-51-16/gpt-6-astra/04-kitchen-oven-fridge-sink-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 4.0 | – | 4.0 | 74.8k | 62 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 3.1 | – | 3.1 | 80.5k | 30 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 20.1 | – | 20.1 | 83.6k | 893 | 319 | – |  |
| 4 | 1 | — (tool-calls) | 3.9 | – | 3.9 | 94.2k | 103 | 44 | – |  |
| 5 | 1 | — (stop) | 7.7 | – | 7.7 | 108.7k | 186 | 0 | – |  |

## 7 gpt-6-astra — full-kitchen-walnut-marble-corner

`.temp/result/mcp-test-2026-10-26_11-51-16/gpt-6-astra/05-full-kitchen-walnut-marble-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 3.2 | – | 3.2 | 74.9k | 62 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 3.8 | – | 3.8 | 80.5k | 30 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 22.9 | – | 22.9 | 83.6k | 1024 | 441 | – |  |
| 4 | 1 | — (tool-calls) | 4.9 | – | 4.9 | 94.8k | 69 | 52 | – |  |
| 5 | 1 | — (stop) | 6.8 | – | 6.8 | 97.3k | 150 | 0 | – |  |

## 8 gpt-6-astra — kitchen-family-two-kids

`.temp/result/mcp-test-2026-10-26_11-51-16/gpt-6-astra/06-kitchen-family-two-kids`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 2.7 | – | 2.7 | 74.8k | 62 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 1.8 | – | 1.8 | 80.5k | 30 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 24.9 | – | 24.9 | 83.6k | 1134 | 408 | – |  |
| 4 | 1 | — (tool-calls) | 5.6 | – | 5.6 | 96.7k | 112 | 54 | – |  |
| 5 | 1 | — (stop) | 9.8 | – | 9.8 | 113.9k | 239 | 0 | – |  |

## 9 gpt-6-astra — kitchen-family-two-kids (left out)

`.temp/result/mcp-test-2026-10-26_11-51-16/gpt-6-astra/06-kitchen-family-two-kids.attempt-1`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 10.0 | – | 10.0 | 74.8k | 62 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 2.4 | – | 2.4 | 80.5k | 30 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 28.7 | – | 28.7 | 83.6k | 1175 | 502 | – |  |

## 10 gpt-6-astra — image-kitchen-left-wall

`.temp/result/mcp-test-2026-10-26_11-51-16/gpt-6-astra/07-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 4.2 | – | 4.2 | 77.2k | 79 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 10.8 | – | 10.8 | 84.1k | 294 | 191 | – |  |
| 3 | 1 | — (tool-calls) | 10.1 | – | 10.1 | 87.4k | 520 | 23 | – |  |
| 4 | 1 | — (tool-calls) | 4.2 | – | 4.2 | 95.0k | 44 | 22 | – |  |
| 5 | 1 | — (tool-calls) | 3.8 | – | 3.8 | 95.2k | 57 | 0 | – |  |
| 6 | 1 | — (tool-calls) | 2.4 | – | 2.4 | 95.4k | 15 | 0 | – |  |
| 7 | 1 | — (stop) | 9.1 | – | 9.1 | 97.8k | 245 | 52 | – |  |

## 11 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/mcp-test-2026-10-26_11-51-16/gpt-6-astra/08-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 3.3 | – | 3.3 | 76.7k | 79 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 15.2 | – | 15.2 | 83.6k | 436 | 404 | – |  |
| 3 | 1 | — (tool-calls) | 21.8 | – | 21.8 | 87.1k | 943 | 304 | – |  |
| 4 | 1 | — (tool-calls) | 16.2 | – | 16.2 | 96.3k | 574 | 389 | – |  |
| 5 | 1 | — (tool-calls) | 5.2 | – | 5.2 | 97.7k | 84 | 25 | – |  |
| 6 | 1 | — (tool-calls) | 15.2 | – | 15.2 | 112.9k | 433 | 325 | – |  |
| 7 | 1 | — (tool-calls) | 23.2 | – | 23.2 | 124.1k | 1388 | 149 | – |  |
| 8 | 1 | — (tool-calls) | 18.2 | – | 18.2 | 125.9k | 454 | 406 | – |  |
| 9 | 1 | — (tool-calls) | 5.7 | – | 5.7 | 136.5k | 79 | 18 | – |  |
| 10 | 1 | — (tool-calls) | 4.6 | – | 4.6 | 136.7k | 104 | 0 | – |  |
| 11 | 1 | — (tool-calls) | 5.9 | – | 5.9 | 146.4k | 143 | 21 | – |  |
| 12 | 1 | — (tool-calls) | 5.2 | – | 5.2 | 156.8k | 81 | 11 | – |  |
| 13 | 1 | — (tool-calls) | 9.1 | – | 9.1 | 167.5k | 70 | 18 | – |  |
| 14 | 1 | — (stop) | 12.3 | – | 12.3 | 171.2k | 160 | 0 | – |  |

## 12 gpt-6-astra — image-planning-right-wall

`.temp/result/mcp-test-2026-10-26_11-51-16/gpt-6-astra/09-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 4.6 | – | 4.6 | 76.8k | 79 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 22.0 | – | 22.0 | 83.7k | 548 | 516 | – |  |
| 3 | 1 | — (tool-calls) | 28.5 | – | 28.5 | 87.2k | 1220 | 452 | – |  |
| 4 | 1 | — (tool-calls) | 15.4 | – | 15.4 | 93.3k | 560 | 139 | – |  |
| 5 | 1 | — (tool-calls) | 7.2 | – | 7.2 | 100.9k | 31 | 14 | – |  |
| 6 | 1 | — (stop) | 14.3 | – | 14.3 | 103.3k | 413 | 218 | – |  |

## 13 gpt-6-astra — image-only-no-text

`.temp/result/mcp-test-2026-10-26_11-51-16/gpt-6-astra/10-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 5.6 | – | 5.6 | 76.1k | 79 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 28.5 | – | 28.5 | 83.8k | 624 | 516 | – |  |
| 3 | 1 | — (tool-calls) | 44.6 | – | 44.6 | 87.4k | 1883 | 1029 | – |  |
| 4 | 1 | — (tool-calls) | 11.7 | – | 11.7 | 97.8k | 530 | 106 | – |  |
| 5 | 1 | — (tool-calls) | 7.6 | – | 7.6 | 99.7k | 282 | 19 | – |  |
| 6 | 1 | — (tool-calls) | 7.9 | – | 7.9 | 100.6k | 222 | 96 | – |  |
| 7 | 1 | — (tool-calls) | 2.6 | – | 2.6 | 101.1k | 15 | 0 | – |  |
| 8 | 1 | — (tool-calls) | 16.7 | – | 16.7 | 103.6k | 402 | 278 | – |  |
| 9 | 1 | — (tool-calls) | 22.2 | – | 22.2 | 104.5k | 166 | 44 | – |  |
| 10 | 1 | — (tool-calls) | 7.2 | – | 7.2 | 105.2k | 184 | 56 | – |  |
| 11 | 1 | — (tool-calls) | 13.9 | – | 13.9 | 105.9k | 209 | 124 | – |  |
| 12 | 1 | — (tool-calls) | 4.8 | – | 4.8 | 106.2k | 41 | 11 | – |  |
| 13 | 1 | — (tool-calls) | 5.6 | – | 5.6 | 119.3k | 53 | 36 | – |  |
| 14 | 1 | — (tool-calls) | 10.8 | – | 10.8 | 121.8k | 234 | 75 | – |  |
| 15 | 1 | — (tool-calls) | 6.5 | – | 6.5 | 122.4k | 81 | 0 | – |  |
| 16 | 1 | — (stop) | 9.1 | – | 9.1 | 122.6k | 197 | 0 | – |  |
