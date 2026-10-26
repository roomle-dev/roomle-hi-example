# HI MCP benchmark

| Model | Test | Runs | Chat s mean | median | min | max | Steps mean | Input tokens mean |
|---|---|---|---|---|---|---|---|---|
| gpt-6.1-sol | full-kitchen-walnut-marble-corner | 2 | 112.8 | 112.8 | 87.0 | 138.5 | 6.0 | 547.7k |
| gpt-6.1-sol | image-kitchen-left-wall | 2 | 173.7 | 173.7 | 172.9 | 174.5 | 9.0 | 880.6k |
| gpt-6.1-sol | image-only-no-text | 2 | 195.0 | 195.0 | 173.1 | 216.9 | 10.0 | 1100.7k |
| gpt-6.1-sol | edit-add-move-delete-subarticle | 2 | 234.1 | 234.1 | 225.4 | 242.8 | 12.0 | 1141.2k |

## Runs

| Run | Model | Test | Chat s | Steps | Model s | Tools s | Other s | Input tokens | Output tokens | Reasoning tokens | Plan changes | Corrections | Not loaded | Errors | Left out |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | gpt-6.1-sol | full-kitchen-walnut-marble-corner | 87.0 | 5 | 83.7 | – | – | 436.0k | 1088 | 264 | 1 | 1 | 0 | 0 |  |
| 2 | gpt-6.1-sol | image-kitchen-left-wall | 172.9 | 9 | 168.8 | – | – | 890.4k | 1696 | 544 | 4 | 2 | 0 | 1 |  |
| 3 | gpt-6.1-sol | image-only-no-text | 216.9 | 11 | 210.4 | – | – | 1304.5k | 3386 | 767 | 7 | 4 | 0 | 2 |  |
| 4 | gpt-6.1-sol | edit-add-move-delete-subarticle | 242.8 | 12 | 238.1 | – | – | 1141.6k | 742 | 20 | 3 | 2 | 0 | 0 |  |
| 5 | gpt-6.1-sol | full-kitchen-walnut-marble-corner | 138.5 | 7 | 133.0 | – | – | 659.4k | 1368 | 379 | 3 | 0 | 0 | 0 |  |
| 6 | gpt-6.1-sol | image-kitchen-left-wall | 174.5 | 9 | 171.0 | – | – | 870.8k | 1580 | 543 | 3 | 4 | 0 | 1 |  |
| 7 | gpt-6.1-sol | image-only-no-text | 173.1 | 9 | 168.3 | – | – | 896.9k | 2464 | 604 | 7 | 4 | 0 | 4 |  |
| 8 | gpt-6.1-sol | edit-add-move-delete-subarticle | 225.4 | 12 | 224.6 | – | – | 1140.7k | 732 | 24 | 3 | 2 | 0 | 0 |  |

## Cache and transport measurements

Coverage is per field and turn. Missing counters are unknown. Cache reads are a subset of input tokens; request bytes still cross the network. SDK model-call timings include any test request pacing, and may overlap tool execution. They do not isolate prefill. First output can be reasoning or a tool call.

| Run | Turn | Cache read / coverage | Cache write / coverage | Request bytes | Reference bytes | First output ms | First visible text ms |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 331935 / complete | 104037 / complete | 1957245 | 295284 | 3506.5 | 49603.79999998212 |
| 2 | 1 | 785402 / complete | 104983 / complete | 8868810 | 295284 | 4206.800000011921 | 50431.59999999404 |
| 3 | 1 | 1169701 / complete | 134787 / complete | 10113407 | 295284 | 4829.199999988079 | 29216.5 |
| 4 | 1 | 254357 / complete | 77245 / complete | 1805750 | 295284 | 19460.80000001192 | 84264 |
| 4 | 2 | 373979 / complete | 10414 / complete | 1644827 | 295284 | 16748.69999998808 | 79451.59999999404 |
| 4 | 3 | 415642 / complete | 9960 / complete | 1779944 | 295284 | 16201 | 75669.5 |
| 5 | 1 | 627887 / complete | 31492 / complete | 2924586 | 295284 | 5154.299999982119 | 52372.80000001192 |
| 6 | 1 | 840263 / complete | 30469 / complete | 8807384 | 295284 | 4050 | 49465.20000001788 |
| 7 | 1 | 859897 / complete | 36982 / complete | 7971198 | 295284 | 4774.5 | 36365.40000000596 |
| 8 | 1 | 320608 / complete | 10792 / complete | 1466860 | 295284 | 2387.5999999940395 | 63156.69999998808 |
| 8 | 2 | 373625 / complete | 10429 / complete | 1644827 | 295284 | 20557.40000000596 | 78242.69999998808 |
| 8 | 3 | 415286 / complete | 9955 / complete | 1779944 | 295284 | 24467.40000000596 | 81425.69999998808 |

## Tools

| Model | Tool | Calls | Calls per run | Total s | Mean ms |
|---|---|---|---|---|---|
| gpt-6.1-sol | create-or-replace-groups | 6 | 0.8 | 13.4 | 2230 |
| gpt-6.1-sol | change-group-attribute | 14 | 1.8 | 7.1 | 506 |
| gpt-6.1-sol | change-module-attribute | 4 | 0.5 | 3.9 | 967 |
| gpt-6.1-sol | get-plan-images | 4 | 0.5 | 3.1 | 783 |
| gpt-6.1-sol | get-plan-context | 34 | 4.3 | 3.0 | 89 |
| gpt-6.1-sol | exchange-root-module | 1 | 0.1 | 1.2 | 1175 |
| gpt-6.1-sol | move-interior-fitting | 2 | 0.3 | 0.4 | 216 |
| gpt-6.1-sol | add-interior-fitting | 2 | 0.3 | 0.4 | 198 |
| gpt-6.1-sol | get-interior-design-options | 6 | 0.8 | 0.4 | 59 |
| gpt-6.1-sol | delete-interior-fittings | 2 | 0.3 | 0.3 | 147 |
| gpt-6.1-sol | get-skill | 16 | 2.0 | 0.1 | 4 |
| gpt-6.1-sol | find-attributes | 2 | 0.3 | 0.0 | 16 |

## 1 gpt-6.1-sol — full-kitchen-walnut-marble-corner

`.temp/result/prompt-caching-paced-library-rules-1/gpt-6.1-sol/01-full-kitchen-walnut-marble-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 3.6 | – | 3.6 | 74.9k | 62 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 18.7 | – | 18.7 | 80.5k | 30 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 35.3 | – | 35.3 | 83.6k | 759 | 221 | – |  |
| 4 | 1 | — (tool-calls) | 5.5 | – | 5.5 | 92.9k | 73 | 43 | – |  |
| 5 | 1 | — (stop) | 20.7 | – | 20.7 | 104.0k | 164 | 0 | – |  |

## 2 gpt-6.1-sol — image-kitchen-left-wall

`.temp/result/prompt-caching-paced-library-rules-1/gpt-6.1-sol/02-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 4.5 | – | 4.5 | 77.2k | 79 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 26.8 | – | 26.8 | 84.1k | 201 | 169 | – |  |
| 3 | 1 | — (tool-calls) | 27.2 | – | 27.2 | 87.3k | 779 | 175 | – |  |
| 4 | 1 | — (tool-calls) | 7.0 | – | 7.0 | 96.2k | 105 | 75 | – |  |
| 5 | 1 | — (tool-calls) | 21.1 | – | 21.1 | 106.5k | 121 | 64 | – |  |
| 6 | 1 | — (tool-calls) | 15.7 | – | 15.7 | 106.7k | 74 | 0 | – |  |
| 7 | 1 | — (tool-calls) | 21.8 | – | 21.8 | 106.9k | 107 | 48 | – |  |
| 8 | 1 | — (tool-calls) | 17.1 | – | 17.1 | 107.3k | 67 | 13 | – |  |
| 9 | 1 | — (stop) | 27.8 | – | 27.8 | 118.4k | 163 | 0 | – |  |

## 3 gpt-6.1-sol — image-only-no-text

`.temp/result/prompt-caching-paced-library-rules-1/gpt-6.1-sol/03-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 5.1 | – | 5.1 | 76.1k | 79 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 27.8 | – | 27.8 | 83.8k | 295 | 158 | – |  |
| 3 | 1 | — (tool-calls) | 20.2 | – | 20.2 | 109.3k | 248 | 217 | – |  |
| 4 | 1 | — (tool-calls) | 27.0 | – | 27.0 | 109.7k | 968 | 119 | – |  |
| 5 | 1 | — (tool-calls) | 7.7 | – | 7.7 | 118.8k | 121 | 91 | – |  |
| 6 | 1 | — (tool-calls) | 19.8 | – | 19.8 | 129.8k | 388 | 0 | – |  |
| 7 | 1 | — (tool-calls) | 22.1 | – | 22.1 | 130.9k | 319 | 54 | – |  |
| 8 | 1 | — (tool-calls) | 21.9 | – | 21.9 | 131.9k | 395 | 92 | – |  |
| 9 | 1 | — (tool-calls) | 14.2 | – | 14.2 | 132.7k | 300 | 0 | – |  |
| 10 | 1 | — (tool-calls) | 18.9 | – | 18.9 | 133.3k | 95 | 36 | – |  |
| 11 | 1 | — (stop) | 25.9 | – | 25.9 | 148.2k | 178 | 0 | – |  |

## 4 gpt-6.1-sol — edit-add-move-delete-subarticle

`.temp/result/prompt-caching-paced-library-rules-1/gpt-6.1-sol/04-edit-add-move-delete-subarticle`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 21.6 | – | 21.6 | 74.8k | 28 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 18.2 | – | 18.2 | 79.7k | 67 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 20.6 | – | 20.6 | 86.4k | 164 | 20 | – |  |
| 4 | 1 | — (stop) | 21.7 | – | 21.7 | 90.6k | 42 | 0 | – |  |
| 5 | 2 | — (tool-calls) | 17.3 | – | 17.3 | 90.7k | 28 | 0 | – |  |
| 6 | 2 | — (tool-calls) | 21.3 | – | 21.3 | 95.8k | 77 | 0 | – |  |
| 7 | 2 | — (tool-calls) | 19.6 | – | 19.6 | 96.8k | 80 | 0 | – |  |
| 8 | 2 | — (stop) | 21.8 | – | 21.8 | 101.0k | 43 | 0 | – |  |
| 9 | 3 | — (tool-calls) | 16.7 | – | 16.7 | 101.1k | 28 | 0 | – |  |
| 10 | 3 | — (tool-calls) | 22.0 | – | 22.0 | 106.2k | 79 | 0 | – |  |
| 11 | 3 | — (tool-calls) | 23.0 | – | 23.0 | 107.3k | 71 | 0 | – |  |
| 12 | 3 | — (stop) | 14.4 | – | 14.4 | 111.0k | 35 | 0 | – |  |

## 5 gpt-6.1-sol — full-kitchen-walnut-marble-corner

`.temp/result/prompt-caching-paced-library-rules-2/gpt-6.1-sol/01-full-kitchen-walnut-marble-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 5.6 | – | 5.6 | 74.9k | 62 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 17.5 | – | 17.5 | 80.5k | 30 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 38.1 | – | 38.1 | 83.6k | 840 | 266 | – |  |
| 4 | 1 | — (tool-calls) | 7.8 | – | 7.8 | 93.8k | 63 | 33 | – |  |
| 5 | 1 | — (tool-calls) | 19.2 | – | 19.2 | 105.7k | 105 | 46 | – |  |
| 6 | 1 | — (tool-calls) | 16.0 | – | 16.0 | 105.8k | 125 | 34 | – |  |
| 7 | 1 | — (stop) | 28.8 | – | 28.8 | 115.1k | 143 | 0 | – |  |

## 6 gpt-6.1-sol — image-kitchen-left-wall

`.temp/result/prompt-caching-paced-library-rules-2/gpt-6.1-sol/02-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 4.2 | – | 4.2 | 77.2k | 79 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 28.6 | – | 28.6 | 84.1k | 284 | 252 | – |  |
| 3 | 1 | — (tool-calls) | 25.7 | – | 25.7 | 87.4k | 784 | 199 | – |  |
| 4 | 1 | — (tool-calls) | 4.6 | – | 4.6 | 95.3k | 54 | 24 | – |  |
| 5 | 1 | — (tool-calls) | 19.7 | – | 19.7 | 104.4k | 35 | 13 | – |  |
| 6 | 1 | — (tool-calls) | 21.4 | – | 21.4 | 104.6k | 70 | 0 | – |  |
| 7 | 1 | — (tool-calls) | 20.5 | – | 20.5 | 104.8k | 110 | 55 | – |  |
| 8 | 1 | — (tool-calls) | 16.5 | – | 16.5 | 105.2k | 15 | 0 | – |  |
| 9 | 1 | — (stop) | 29.9 | – | 29.9 | 107.7k | 149 | 0 | – |  |

## 7 gpt-6.1-sol — image-only-no-text

`.temp/result/prompt-caching-paced-library-rules-2/gpt-6.1-sol/03-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 4.9 | – | 4.9 | 76.1k | 79 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 33.7 | – | 33.7 | 83.8k | 450 | 341 | – |  |
| 3 | 1 | — (tool-calls) | 22.9 | – | 22.9 | 87.2k | 890 | 139 | – |  |
| 4 | 1 | — (tool-calls) | 6.1 | – | 6.1 | 96.2k | 81 | 51 | – |  |
| 5 | 1 | — (tool-calls) | 24.1 | – | 24.1 | 107.1k | 345 | 11 | – |  |
| 6 | 1 | — (tool-calls) | 16.7 | – | 16.7 | 108.0k | 197 | 17 | – |  |
| 7 | 1 | — (tool-calls) | 18.2 | – | 18.2 | 108.7k | 145 | 14 | – |  |
| 8 | 1 | — (tool-calls) | 19.2 | – | 19.2 | 109.1k | 85 | 31 | – |  |
| 9 | 1 | — (stop) | 22.6 | – | 22.6 | 120.7k | 192 | 0 | – |  |

## 8 gpt-6.1-sol — edit-add-move-delete-subarticle

`.temp/result/prompt-caching-paced-library-rules-2/gpt-6.1-sol/04-edit-add-move-delete-subarticle`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | — (tool-calls) | 2.9 | – | 2.9 | 74.8k | 28 | 0 | – |  |
| 2 | 1 | — (tool-calls) | 23.5 | – | 23.5 | 79.7k | 67 | 0 | – |  |
| 3 | 1 | — (tool-calls) | 23.1 | – | 23.1 | 86.3k | 163 | 24 | – |  |
| 4 | 1 | — (stop) | 13.9 | – | 13.9 | 90.5k | 48 | 0 | – |  |
| 5 | 2 | — (tool-calls) | 21.5 | – | 21.5 | 90.6k | 28 | 0 | – |  |
| 6 | 2 | — (tool-calls) | 17.9 | – | 17.9 | 95.7k | 77 | 0 | – |  |
| 7 | 2 | — (tool-calls) | 20.3 | – | 20.3 | 96.7k | 80 | 0 | – |  |
| 8 | 2 | — (stop) | 18.8 | – | 18.8 | 101.0k | 28 | 0 | – |  |
| 9 | 3 | — (tool-calls) | 24.9 | – | 24.9 | 101.0k | 28 | 0 | – |  |
| 10 | 3 | — (tool-calls) | 15.5 | – | 15.5 | 106.1k | 79 | 0 | – |  |
| 11 | 3 | — (tool-calls) | 20.8 | – | 20.8 | 107.2k | 71 | 0 | – |  |
| 12 | 3 | — (stop) | 21.3 | – | 21.3 | 110.9k | 35 | 0 | – |  |
