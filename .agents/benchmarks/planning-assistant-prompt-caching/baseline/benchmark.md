# HI MCP benchmark

| Model | Test | Runs | Chat s mean | median | min | max | Steps mean | Input tokens mean |
|---|---|---|---|---|---|---|---|---|
| gpt-6.1-sol | full-kitchen-walnut-marble-corner | 2 | 96.7 | 96.7 | 87.1 | 106.3 | 5.5 | 413.7k |
| gpt-6.1-sol | image-kitchen-left-wall | 2 | 189.6 | 189.6 | 189.1 | 190.1 | 10.0 | 851.3k |
| gpt-6.1-sol | image-only-no-text | 2 | 296.5 | 296.5 | 262.8 | 330.2 | 13.5 | 1363.7k |
| gpt-6.1-sol | edit-add-move-delete-subarticle | 2 | 183.1 | 183.1 | 182.8 | 183.4 | 10.0 | 382.4k |

## Runs

| Run | Model | Test | Chat s | Steps | Model s | Tools s | Other s | Input tokens | Output tokens | Reasoning tokens | Plan changes | Corrections | Not loaded | Errors | Left out |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | gpt-6.1-sol | full-kitchen-walnut-marble-corner | 106.3 | 6 | 102.7 | – | – | 467.5k | 1210 | 254 | 2 | 1 | 0 | 0 |  |
| 2 | gpt-6.1-sol | image-kitchen-left-wall | 189.1 | 10 | 184.2 | – | – | 848.8k | 1831 | 130 | 6 | 4 | 0 | 1 |  |
| 3 | gpt-6.1-sol | image-only-no-text | 262.8 | 13 | 253.9 | – | – | 1098.7k | 3282 | 656 | 15 | 11 | 0 | 6 |  |
| 4 | gpt-6.1-sol | edit-add-move-delete-subarticle | 183.4 | 10 | 182.6 | – | – | 246.9k | 697 | 58 | 3 | 2 | 0 | 0 |  |
| 5 | gpt-6.1-sol | full-kitchen-walnut-marble-corner | 87.1 | 5 | 84.3 | – | – | 359.9k | 1000 | 168 | 1 | 1 | 0 | 0 |  |
| 6 | gpt-6.1-sol | image-kitchen-left-wall | 190.1 | 10 | 185.4 | – | – | 853.8k | 2481 | 220 | 6 | 4 | 0 | 2 |  |
| 7 | gpt-6.1-sol | image-only-no-text | 330.2 | 14 | 287.8 | – | – | 1628.7k | 3774 | 944 | 13 | 4 | 0 | 10 |  |
| 8 | gpt-6.1-sol | edit-add-move-delete-subarticle | 182.8 | 10 | 182.0 | – | – | 517.8k | 685 | 25 | 3 | 2 | 0 | 0 |  |

## Cache and transport measurements

Coverage is per field and turn. Missing counters are unknown. Cache reads are a subset of input tokens; request bytes still cross the network. SDK model-call timings include any test request pacing, and may overlap tool execution. They do not isolate prefill. First output can be reasoning or a tool call.

| Run | Turn | Cache read / coverage | Cache write / coverage | Request bytes | Reference bytes | First output ms | First visible text ms |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 441774 / complete | 25722 / complete | 2098136 | – | 4849.299999982119 | 102067.30000001192 |
| 2 | 1 | 834548 / complete | 14213 / complete | 9095723 | – | 4640.4000000059605 | 30442.100000023842 |
| 3 | 1 | 994613 / complete | 104051 / complete | 9803487 | – | 3911.199999988079 | 23856.79999998212 |
| 4 | 1 | 44866 / complete | 13807 / complete | 271755 | – | 2202.5 | 61277.80000001192 |
| 4 | 2 | 72583 / complete | 10996 / complete | 341748 | – | 20157 | 60188.69999998808 |
| 4 | 3 | 99845 / complete | 4818 / complete | 413152 | – | 18974.90000000596 | 59205.5 |
| 5 | 1 | 345783 / complete | 14065 / complete | 1628338 | – | 4869.899999976158 | 83134 |
| 6 | 1 | 831452 / complete | 22345 / complete | 9020806 | – | 4233.0999999940395 | 26834.59999999404 |
| 7 | 1 | 1536833 / complete | 91825 / complete | 16013737 | – | 4558.9000000059605 | 62005.30000001192 |
| 8 | 1 | 138099 / complete | 10857 / complete | 667812 | – | 1753.699999988079 | 62053.20000001788 |
| 8 | 2 | 162834 / complete | 11019 / complete | 737805 | – | 22003.29999998212 | 64598.59999999404 |
| 8 | 3 | 190168 / complete | 4834 / complete | 809209 | – | 20625.20000001788 | 51710.60000002384 |

## Tools

| Model | Tool | Calls | Calls per run | Total s | Mean ms |
|---|---|---|---|---|---|
| gpt-6.1-sol | change-group-attribute | 33 | 4.1 | 17.6 | 533 |
| gpt-6.1-sol | create-or-replace-groups | 7 | 0.9 | 14.0 | 2003 |
| gpt-6.1-sol | get-plan-images | 4 | 0.5 | 2.1 | 517 |
| gpt-6.1-sol | change-module-attribute | 3 | 0.4 | 2.0 | 663 |
| gpt-6.1-sol | get-plan-context | 14 | 1.8 | 1.7 | 124 |
| gpt-6.1-sol | move-interior-fitting | 2 | 0.3 | 0.4 | 216 |
| gpt-6.1-sol | add-interior-fitting | 2 | 0.3 | 0.4 | 192 |
| gpt-6.1-sol | get-interior-design-options | 6 | 0.8 | 0.4 | 60 |
| gpt-6.1-sol | delete-interior-fittings | 2 | 0.3 | 0.3 | 152 |
| gpt-6.1-sol | get-skill | 16 | 2.0 | 0.2 | 10 |
| gpt-6.1-sol | get-authoring-rules | 6 | 0.8 | 0.1 | 21 |
| gpt-6.1-sol | find-attributes | 1 | 0.1 | 0.0 | 20 |

## 1 gpt-6.1-sol — full-kitchen-walnut-marble-corner

`.temp/result/prompt-caching-paced-baseline-1/gpt-6.1-sol/01-full-kitchen-walnut-marble-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 5.6 | – | 5.6 | 8.2k | 65 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 23.7 | – | 23.7 | 80.4k | 249 | 217 | – |  |
| 3 | 1 | — (tool-calls) | 22.8 | – | 22.8 | 83.7k | 596 | 0 | – |  |
| 4 | 1 | — (tool-calls) | 10.9 | – | 10.9 | 94.5k | 108 | 37 | – |  |
| 5 | 1 | — (tool-calls) | 16.6 | – | 16.6 | 94.7k | 23 | 0 | – |  |
| 6 | 1 | — (stop) | 23.1 | – | 23.1 | 106.1k | 169 | 0 | – |  |

## 2 gpt-6.1-sol — image-kitchen-left-wall

`.temp/result/prompt-caching-paced-baseline-1/gpt-6.1-sol/02-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 5.2 | – | 5.2 | 10.5k | 82 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 30.0 | – | 30.0 | 83.9k | 174 | 65 | – |  |
| 3 | 1 | — (tool-calls) | 16.8 | – | 16.8 | 87.1k | 741 | 0 | – |  |
| 4 | 1 | — (tool-calls) | 14.5 | – | 14.5 | 93.8k | 223 | 44 | – |  |
| 5 | 1 | — (tool-calls) | 16.5 | – | 16.5 | 94.4k | 153 | 21 | – |  |
| 6 | 1 | — (tool-calls) | 20.8 | – | 20.8 | 94.7k | 91 | 0 | – |  |
| 7 | 1 | — (tool-calls) | 19.9 | – | 19.9 | 95.2k | 102 | 0 | – |  |
| 8 | 1 | — (tool-calls) | 17.1 | – | 17.1 | 95.4k | 102 | 0 | – |  |
| 9 | 1 | — (tool-calls) | 18.6 | – | 18.6 | 95.7k | 15 | 0 | – |  |
| 10 | 1 | — (stop) | 24.8 | – | 24.8 | 98.1k | 148 | 0 | – |  |

## 3 gpt-6.1-sol — image-only-no-text

`.temp/result/prompt-caching-paced-baseline-1/gpt-6.1-sol/03-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 4.2 | – | 4.2 | 9.4k | 21 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 22.0 | – | 22.0 | 10.6k | 140 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 23.6 | – | 23.6 | 83.7k | 220 | 188 | – |  |
| 4 | 1 | — (tool-calls) | 32.0 | – | 32.0 | 86.9k | 1078 | 261 | – |  |
| 5 | 1 | — (tool-calls) | 8.1 | – | 8.1 | 96.2k | 327 | 21 | – |  |
| 6 | 1 | — (tool-calls) | 20.8 | – | 20.8 | 97.0k | 250 | 70 | – |  |
| 7 | 1 | — (tool-calls) | 20.9 | – | 20.9 | 98.0k | 271 | 16 | – |  |
| 8 | 1 | — (tool-calls) | 13.5 | – | 13.5 | 99.0k | 133 | 16 | – |  |
| 9 | 1 | — (tool-calls) | 19.7 | – | 19.7 | 99.7k | 201 | 17 | – |  |
| 10 | 1 | — (tool-calls) | 19.8 | – | 19.8 | 100.4k | 156 | 39 | – |  |
| 11 | 1 | — (tool-calls) | 20.6 | – | 20.6 | 101.2k | 176 | 18 | – |  |
| 12 | 1 | — (tool-calls) | 14.8 | – | 14.8 | 101.9k | 64 | 10 | – |  |
| 13 | 1 | — (stop) | 33.9 | – | 33.9 | 114.7k | 245 | 0 | – |  |

## 4 gpt-6.1-sol — edit-add-move-delete-subarticle

`.temp/result/prompt-caching-paced-baseline-1/gpt-6.1-sol/04-edit-add-move-delete-subarticle`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 2.8 | – | 2.8 | 8.1k | 20 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 20.1 | – | 20.1 | 11.0k | 67 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 22.8 | – | 22.8 | 17.6k | 200 | 58 | – |  |
| 4 | 1 | — (stop) | 16.3 | – | 16.3 | 21.9k | 41 | 0 | – |  |
| 5 | 2 | — (tool-calls) | 21.1 | – | 21.1 | 22.0k | 71 | 0 | – |  |
| 6 | 2 | — (tool-calls) | 22.1 | – | 22.1 | 28.7k | 80 | 0 | – |  |
| 7 | 2 | — (stop) | 17.5 | – | 17.5 | 32.9k | 31 | 0 | – |  |
| 8 | 3 | — (tool-calls) | 20.0 | – | 20.0 | 33.0k | 79 | 0 | – |  |
| 9 | 3 | — (tool-calls) | 19.5 | – | 19.5 | 34.0k | 71 | 0 | – |  |
| 10 | 3 | — (stop) | 20.5 | – | 20.5 | 37.7k | 37 | 0 | – |  |

## 5 gpt-6.1-sol — full-kitchen-walnut-marble-corner

`.temp/result/prompt-caching-paced-baseline-2/gpt-6.1-sol/01-full-kitchen-walnut-marble-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 5.3 | – | 5.3 | 8.2k | 65 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 24.0 | – | 24.0 | 80.4k | 188 | 156 | – |  |
| 3 | 1 | — (tool-calls) | 20.7 | – | 20.7 | 83.6k | 560 | 0 | – |  |
| 4 | 1 | — (tool-calls) | 11.5 | – | 11.5 | 93.3k | 35 | 12 | – |  |
| 5 | 1 | — (stop) | 22.8 | – | 22.8 | 94.4k | 152 | 0 | – |  |

## 6 gpt-6.1-sol — image-kitchen-left-wall

`.temp/result/prompt-caching-paced-baseline-2/gpt-6.1-sol/02-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 4.4 | – | 4.4 | 10.5k | 82 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 25.1 | – | 25.1 | 83.9k | 205 | 101 | – |  |
| 3 | 1 | — (tool-calls) | 30.2 | – | 30.2 | 87.2k | 740 | 0 | – |  |
| 4 | 1 | — (tool-calls) | 14.3 | – | 14.3 | 88.0k | 769 | 27 | – |  |
| 5 | 1 | — (tool-calls) | 9.9 | – | 9.9 | 94.7k | 123 | 29 | – |  |
| 6 | 1 | — (tool-calls) | 22.6 | – | 22.6 | 95.2k | 177 | 36 | – |  |
| 7 | 1 | — (tool-calls) | 15.2 | – | 15.2 | 95.8k | 100 | 0 | – |  |
| 8 | 1 | — (tool-calls) | 19.4 | – | 19.4 | 96.1k | 55 | 0 | – |  |
| 9 | 1 | — (tool-calls) | 19.8 | – | 19.8 | 96.3k | 81 | 27 | – |  |
| 10 | 1 | — (stop) | 24.4 | – | 24.4 | 106.2k | 149 | 0 | – |  |

## 7 gpt-6.1-sol — image-only-no-text

`.temp/result/prompt-caching-paced-baseline-2/gpt-6.1-sol/03-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 4.9 | – | 4.9 | 9.4k | 21 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 18.6 | – | 18.6 | 10.6k | 65 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 42.6 | – | 42.6 | 83.6k | 514 | 397 | – |  |
| 4 | 1 | — (tool-calls) | 24.3 | – | 24.3 | 87.2k | 1036 | 266 | – |  |
| 5 | 1 | — (tool-calls) | 16.4 | – | 16.4 | 96.3k | 418 | 79 | – |  |
| 6 | 1 | — (tool-calls) | 12.2 | – | 12.2 | 97.3k | 328 | 13 | – |  |
| 7 | 1 | — (tool-calls) | 17.0 | – | 17.0 | 98.2k | 42 | 17 | – |  |
| 8 | 1 | — (tool-calls) | 23.1 | – | 23.1 | 159.9k | 348 | 27 | – |  |
| 9 | 1 | — (tool-calls) | 17.6 | – | 17.6 | 160.9k | 220 | 13 | – |  |
| 10 | 1 | — (tool-calls) | 20.3 | – | 20.3 | 161.7k | 239 | 55 | – |  |
| 11 | 1 | — (tool-calls) | 17.2 | – | 17.2 | 162.5k | 39 | 17 | – |  |
| 12 | 1 | — (tool-calls) | 22.4 | – | 22.4 | 162.7k | 128 | 0 | – |  |
| 13 | 1 | — (tool-calls) | 19.4 | – | 19.4 | 163.1k | 71 | 17 | – |  |
| 14 | 1 | — (stop) | 31.8 | – | 31.8 | 175.4k | 305 | 43 | – |  |

## 8 gpt-6.1-sol — edit-add-move-delete-subarticle

`.temp/result/prompt-caching-paced-baseline-2/gpt-6.1-sol/04-edit-add-move-delete-subarticle`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 2.3 | – | 2.3 | 8.1k | 22 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 21.9 | – | 21.9 | 41.1k | 67 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 21.2 | – | 21.2 | 47.7k | 168 | 25 | – |  |
| 4 | 1 | — (stop) | 17.4 | – | 17.4 | 52.0k | 45 | 0 | – |  |
| 5 | 2 | — (tool-calls) | 25.7 | – | 25.7 | 52.1k | 71 | 0 | – |  |
| 6 | 2 | — (tool-calls) | 14.1 | – | 14.1 | 58.8k | 80 | 0 | – |  |
| 7 | 2 | — (stop) | 27.0 | – | 27.0 | 63.0k | 48 | 0 | – |  |
| 8 | 3 | — (tool-calls) | 22.6 | – | 22.6 | 63.1k | 79 | 0 | – |  |
| 9 | 3 | — (tool-calls) | 11.8 | – | 11.8 | 64.1k | 71 | 0 | – |  |
| 10 | 3 | — (stop) | 18.0 | – | 18.0 | 67.8k | 34 | 0 | – |  |
