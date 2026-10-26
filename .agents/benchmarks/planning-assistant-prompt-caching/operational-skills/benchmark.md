# HI MCP benchmark

| Model | Test | Runs | Chat s mean | median | min | max | Steps mean | Input tokens mean |
|---|---|---|---|---|---|---|---|---|
| gpt-6.1-sol | full-kitchen-walnut-marble-corner | 2 | 79.4 | 79.4 | 71.3 | 87.6 | 4.0 | 415.9k |
| gpt-6.1-sol | image-kitchen-left-wall | 2 | 116.8 | 116.8 | 109.2 | 124.5 | 6.0 | 659.1k |
| gpt-6.1-sol | image-only-no-text | 2 | 287.2 | 287.2 | 258.8 | 315.7 | 11.0 | 1384.0k |
| gpt-6.1-sol | edit-add-move-delete-subarticle | 2 | 292.8 | 292.8 | 282.7 | 302.9 | 12.0 | 1388.2k |

## Runs

| Run | Model | Test | Chat s | Steps | Model s | Tools s | Other s | Input tokens | Output tokens | Reasoning tokens | Plan changes | Corrections | Not loaded | Errors | Left out |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | gpt-6.1-sol | full-kitchen-walnut-marble-corner | 87.6 | 5 | 84.7 | – | – | 530.6k | 1238 | 314 | 2 | 2 | 0 | 0 |  |
| 2 | gpt-6.1-sol | image-kitchen-left-wall | 124.5 | 6 | 121.8 | – | – | 656.5k | 1047 | 245 | 2 | 1 | 0 | 1 |  |
| 3 | gpt-6.1-sol | image-only-no-text | 315.7 | 12 | 251.1 | – | – | 1613.7k | 2760 | 933 | 7 | 5 | 0 | 2 |  |
| 4 | gpt-6.1-sol | edit-add-move-delete-subarticle | 302.9 | 12 | 244.0 | – | – | 1388.6k | 731 | 23 | 3 | 2 | 0 | 0 |  |
| 5 | gpt-6.1-sol | full-kitchen-walnut-marble-corner | 71.3 | 3 | 65.0 | – | – | 301.2k | 971 | 264 | 1 | 2 | 0 | 0 |  |
| 6 | gpt-6.1-sol | image-kitchen-left-wall | 109.2 | 6 | 106.4 | – | – | 661.8k | 1166 | 268 | 2 | 2 | 0 | 1 |  |
| 7 | gpt-6.1-sol | image-only-no-text | 258.8 | 10 | 213.4 | – | – | 1154.4k | 2065 | 593 | 6 | 4 | 0 | 2 |  |
| 8 | gpt-6.1-sol | edit-add-move-delete-subarticle | 282.7 | 12 | 223.0 | – | – | 1387.9k | 723 | 23 | 3 | 2 | 0 | 0 |  |

## Cache and transport measurements

Coverage is per field and turn. Missing counters are unknown. Cache reads are a subset of input tokens; request bytes still cross the network. SDK model-call timings include any test request pacing, and may overlap tool execution. They do not isolate prefill. First output can be reasoning or a tool call.

| Run | Turn | Cache read / coverage | Cache write / coverage | Request bytes | Reference bytes | First output ms | First visible text ms |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 414130 / complete | 116489 / complete | 2412195 | 401171 | 3324.199999988079 | 31716.80000001192 |
| 2 | 1 | 571424 / complete | 85049 / complete | 7076849 | 401171 | 4418.5 | 31694.19999998808 |
| 3 | 1 | 1495094 / complete | 118577 / complete | 18859279 | 401171 | 3375.2999999821186 | 42195.09999999404 |
| 4 | 1 | 336613 / complete | 77251 / complete | 2335185 | 401171 | 19174 | 82620.90000000596 |
| 4 | 2 | 456296 / complete | 10435 / complete | 2584547 | 401171 | 16543.79999998212 | 98350.5 |
| 4 | 3 | 497978 / complete | 9954 / complete | 3302981 | 401171 | 19351.30000001192 | 117704.40000000596 |
| 5 | 1 | 289904 / complete | 11282 / complete | 1834300 | 401171 | 19204.30000001192 | 52485.10000002384 |
| 6 | 1 | 640811 / complete | 20951 / complete | 7249297 | 401171 | 2857.5999999940395 | 31023.09999999404 |
| 7 | 1 | 1129664 / complete | 24699 / complete | 15315196 | 401171 | 22222 | 57163.80000001192 |
| 8 | 1 | 402924 / complete | 10839 / complete | 2389518 | 401171 | 3471.4000000059605 | 83037.40000000596 |
| 8 | 2 | 456054 / complete | 10421 / complete | 2601578 | 401171 | 22086 | 102833.19999998808 |
| 8 | 3 | 497708 / complete | 9952 / complete | 2757249 | 401171 | 15762.09999999404 | 95002.09999999404 |

## Tools

| Model | Tool | Calls | Calls per run | Total s | Mean ms |
|---|---|---|---|---|---|
| gpt-6.1-sol | create-or-replace-groups | 6 | 0.8 | 13.4 | 2234 |
| gpt-6.1-sol | change-group-attribute | 11 | 1.4 | 4.7 | 427 |
| gpt-6.1-sol | change-module-attribute | 2 | 0.3 | 2.3 | 1126 |
| gpt-6.1-sol | get-plan-images | 4 | 0.5 | 2.2 | 556 |
| gpt-6.1-sol | place-group | 1 | 0.1 | 0.9 | 858 |
| gpt-6.1-sol | move-interior-fitting | 2 | 0.3 | 0.4 | 217 |
| gpt-6.1-sol | add-interior-fitting | 2 | 0.3 | 0.4 | 191 |
| gpt-6.1-sol | get-plan-context | 30 | 3.8 | 0.3 | 11 |
| gpt-6.1-sol | get-interior-design-options | 6 | 0.8 | 0.3 | 53 |
| gpt-6.1-sol | delete-interior-fittings | 2 | 0.3 | 0.3 | 152 |

## 1 gpt-6.1-sol — full-kitchen-walnut-marble-corner

`.temp/result/prompt-caching-paced-operational-skills-1/gpt-6.1-sol/01-full-kitchen-walnut-marble-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 3.9 | – | 3.9 | 95.5k | 28 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 34.9 | – | 34.9 | 97.2k | 781 | 267 | – |  |
| 3 | 1 | — (tool-calls) | 5.8 | – | 5.8 | 105.7k | 77 | 47 | – |  |
| 4 | 1 | — (tool-calls) | 25.9 | – | 25.9 | 115.8k | 166 | 0 | – |  |
| 5 | 1 | — (stop) | 14.1 | – | 14.1 | 116.5k | 186 | 0 | – |  |

## 2 gpt-6.1-sol — image-kitchen-left-wall

`.temp/result/prompt-caching-paced-operational-skills-1/gpt-6.1-sol/02-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 4.9 | – | 4.9 | 97.8k | 28 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 42.5 | – | 42.5 | 99.5k | 712 | 189 | – |  |
| 3 | 1 | — (tool-calls) | 5.9 | – | 5.9 | 107.3k | 75 | 45 | – |  |
| 4 | 1 | — (tool-calls) | 18.5 | – | 18.5 | 116.4k | 51 | 0 | – |  |
| 5 | 1 | — (tool-calls) | 23.6 | – | 23.6 | 116.6k | 28 | 11 | – |  |
| 6 | 1 | — (stop) | 26.4 | – | 26.4 | 119.0k | 153 | 0 | – |  |

## 3 gpt-6.1-sol — image-only-no-text

`.temp/result/prompt-caching-paced-operational-skills-1/gpt-6.1-sol/03-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 3.8 | – | 3.8 | 96.7k | 28 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 41.0 | – | 41.0 | 99.2k | 563 | 463 | – |  |
| 3 | 1 | — (tool-calls) | 17.8 | – | 17.8 | 122.0k | 837 | 62 | – |  |
| 4 | 1 | — (tool-calls) | 5.3 | – | 5.3 | 130.8k | 64 | 34 | – |  |
| 5 | 1 | — (tool-calls) | 26.6 | – | 26.6 | 141.1k | 240 | 51 | – |  |
| 6 | 1 | — (tool-calls) | 14.6 | – | 14.6 | 141.7k | 170 | 17 | – |  |
| 7 | 1 | — (tool-calls) | 21.8 | – | 21.8 | 142.3k | 151 | 0 | – |  |
| 8 | 1 | — (tool-calls) | 24.1 | – | 24.1 | 142.7k | 106 | 48 | – |  |
| 9 | 1 | — (tool-calls) | 20.1 | – | 20.1 | 142.9k | 122 | 66 | – |  |
| 10 | 1 | — (tool-calls) | 21.4 | – | 21.4 | 149.7k | 29 | 12 | – |  |
| 11 | 1 | — (tool-calls) | 28.8 | – | 28.8 | 152.1k | 261 | 180 | – |  |
| 12 | 1 | — (stop) | 25.8 | – | 25.8 | 152.5k | 189 | 0 | – |  |

## 4 gpt-6.1-sol — edit-add-move-delete-subarticle

`.temp/result/prompt-caching-paced-operational-skills-1/gpt-6.1-sol/04-edit-add-move-delete-subarticle`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 19.9 | – | 19.9 | 95.4k | 28 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 20.6 | – | 20.6 | 100.3k | 67 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 21.7 | – | 21.7 | 106.9k | 167 | 23 | – |  |
| 4 | 1 | — (stop) | 20.1 | – | 20.1 | 111.2k | 45 | 0 | – |  |
| 5 | 2 | — (tool-calls) | 16.9 | – | 16.9 | 111.3k | 28 | 0 | – |  |
| 6 | 2 | — (tool-calls) | 20.0 | – | 20.0 | 116.4k | 77 | 0 | – |  |
| 7 | 2 | — (tool-calls) | 21.4 | – | 21.4 | 117.4k | 80 | 0 | – |  |
| 8 | 2 | — (stop) | 19.7 | – | 19.7 | 121.6k | 28 | 0 | – |  |
| 9 | 3 | — (tool-calls) | 19.9 | – | 19.9 | 121.7k | 28 | 0 | – |  |
| 10 | 3 | — (tool-calls) | 24.1 | – | 24.1 | 126.8k | 79 | 0 | – |  |
| 11 | 3 | — (tool-calls) | 19.6 | – | 19.6 | 127.8k | 71 | 0 | – |  |
| 12 | 3 | — (stop) | 20.1 | – | 20.1 | 131.6k | 33 | 0 | – |  |

## 5 gpt-6.1-sol — full-kitchen-walnut-marble-corner

`.temp/result/prompt-caching-paced-operational-skills-2/gpt-6.1-sol/01-full-kitchen-walnut-marble-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 20.5 | – | 20.5 | 95.5k | 28 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 36.5 | – | 36.5 | 97.2k | 741 | 226 | – |  |
| 3 | 1 | — (stop) | 8.0 | – | 8.0 | 108.5k | 202 | 38 | – |  |

## 6 gpt-6.1-sol — image-kitchen-left-wall

`.temp/result/prompt-caching-paced-operational-skills-2/gpt-6.1-sol/02-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 3.2 | – | 3.2 | 97.8k | 28 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 35.9 | – | 35.9 | 99.5k | 812 | 208 | – |  |
| 3 | 1 | — (tool-calls) | 7.7 | – | 7.7 | 108.1k | 81 | 51 | – |  |
| 4 | 1 | — (tool-calls) | 21.7 | – | 21.7 | 117.8k | 56 | 0 | – |  |
| 5 | 1 | — (tool-calls) | 18.0 | – | 18.0 | 118.0k | 26 | 9 | – |  |
| 6 | 1 | — (stop) | 20.0 | – | 20.0 | 120.5k | 163 | 0 | – |  |

## 7 gpt-6.1-sol — image-only-no-text

`.temp/result/prompt-caching-paced-operational-skills-2/gpt-6.1-sol/03-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 23.1 | – | 23.1 | 96.7k | 28 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 40.3 | – | 40.3 | 99.2k | 1177 | 434 | – |  |
| 3 | 1 | — (tool-calls) | 8.0 | – | 8.0 | 108.6k | 47 | 17 | – |  |
| 4 | 1 | — (tool-calls) | 18.0 | – | 18.0 | 119.6k | 144 | 0 | – |  |
| 5 | 1 | — (tool-calls) | 19.1 | – | 19.1 | 120.1k | 114 | 17 | – |  |
| 6 | 1 | — (tool-calls) | 22.3 | – | 22.3 | 120.6k | 91 | 0 | – |  |
| 7 | 1 | — (tool-calls) | 24.5 | – | 24.5 | 120.9k | 103 | 31 | – |  |
| 8 | 1 | — (tool-calls) | 13.8 | – | 13.8 | 121.1k | 15 | 0 | – |  |
| 9 | 1 | — (tool-calls) | 24.9 | – | 24.9 | 123.6k | 182 | 94 | – |  |
| 10 | 1 | — (stop) | 19.4 | – | 19.4 | 123.9k | 164 | 0 | – |  |

## 8 gpt-6.1-sol — edit-add-move-delete-subarticle

`.temp/result/prompt-caching-paced-operational-skills-2/gpt-6.1-sol/04-edit-add-move-delete-subarticle`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 4.6 | – | 4.6 | 95.4k | 28 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 19.0 | – | 19.0 | 100.3k | 67 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 21.4 | – | 21.4 | 106.9k | 165 | 23 | – |  |
| 4 | 1 | — (stop) | 20.7 | – | 20.7 | 111.2k | 38 | 0 | – |  |
| 5 | 2 | — (tool-calls) | 22.8 | – | 22.8 | 111.2k | 28 | 0 | – |  |
| 6 | 2 | — (tool-calls) | 16.2 | – | 16.2 | 116.3k | 77 | 0 | – |  |
| 7 | 2 | — (tool-calls) | 21.0 | – | 21.0 | 117.4k | 80 | 0 | – |  |
| 8 | 2 | — (stop) | 24.2 | – | 24.2 | 121.6k | 28 | 0 | – |  |
| 9 | 3 | — (tool-calls) | 16.3 | – | 16.3 | 121.6k | 28 | 0 | – |  |
| 10 | 3 | — (tool-calls) | 19.8 | – | 19.8 | 126.8k | 79 | 0 | – |  |
| 11 | 3 | — (tool-calls) | 18.5 | – | 18.5 | 127.8k | 71 | 0 | – |  |
| 12 | 3 | — (stop) | 18.5 | – | 18.5 | 131.5k | 34 | 0 | – |  |
