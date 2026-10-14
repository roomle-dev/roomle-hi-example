# HI MCP benchmark

| Model | Test | Runs | Chat s mean | min | max | Steps mean | Input tokens mean |
|---|---|---|---|---|---|---|---|
| gpt-6-astra | image-kitchen-left-wall | 2 | 43.9 | 39.3 | 48.5 | 5.0 | 245.4k |
| gpt-6-astra | image-kitchen-back-right-corner | 2 | 101.5 | 97.1 | 106.0 | 10.0 | 625.8k |
| gpt-6-astra | image-planning-right-wall | 2 | 92.6 | 83.5 | 101.7 | 8.0 | 558.7k |
| gpt-6-astra | image-only-no-text | 2 | 76.1 | 71.5 | 80.6 | 6.0 | 322.5k |

Left out of the per-test and tool tables, because the chat ended with an error: run 5 (Failed to process successful response).

## Runs

| Run | Model | Test | Chat s | Steps | Model s | Tools s | Other s | Input tokens | Output tokens | Reasoning tokens | Plan changes | Corrections | Not loaded | Errors | Left out |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | gpt-6-astra | image-kitchen-left-wall | 48.5 | 5 | 45.3 | 3.0 | 0.2 | 245.6k | 1231 | 483 | 1 | 3 | 0 | 0 |  |
| 2 | gpt-6-astra | image-kitchen-back-right-corner | 106.0 | 10 | 95.6 | 10.2 | 0.1 | 613.0k | 3068 | 781 | 4 | 8 | 0 | 0 |  |
| 3 | gpt-6-astra | image-planning-right-wall | 83.5 | 9 | 74.8 | 8.4 | 0.2 | 657.7k | 2433 | 715 | 5 | 8 | 1 | 0 |  |
| 4 | gpt-6-astra | image-only-no-text | 71.5 | 6 | 68.4 | 3.0 | 0.1 | 319.0k | 1588 | 508 | 2 | 9 | 0 | 0 |  |
| 5 | gpt-6-astra | image-only-no-text.attempt-1 | 67.7 | 1 | 3.9 | 0.1 | 63.7 | 7.0k | 64 | 0 | 0 | 0 | 0 | 1 | chat error |
| 6 | gpt-6-astra | image-kitchen-left-wall | 39.3 | 5 | 36.6 | 2.5 | 0.2 | 245.2k | 999 | 266 | 1 | 3 | 0 | 0 |  |
| 7 | gpt-6-astra | image-kitchen-back-right-corner | 97.1 | 10 | 88.0 | 9.0 | 0.1 | 638.5k | 2207 | 667 | 5 | 7 | 0 | 0 |  |
| 8 | gpt-6-astra | image-planning-right-wall | 101.7 | 7 | 93.5 | 8.0 | 0.3 | 459.7k | 3030 | 698 | 3 | 21 | 1 | 0 |  |
| 9 | gpt-6-astra | image-only-no-text | 80.6 | 6 | 76.1 | 4.4 | 0.1 | 325.9k | 1930 | 771 | 2 | 9 | 0 | 0 |  |

## Tools

| Model | Tool | Calls | Calls per run | Total s | Mean ms |
|---|---|---|---|---|---|
| gpt-6-astra | create-or-replace-groups | 11 | 1.4 | 32.4 | 2945 |
| gpt-6-astra | change-module-attribute | 5 | 0.6 | 5.8 | 1160 |
| gpt-6-astra | get-plan-images | 7 | 0.9 | 4.5 | 636 |
| gpt-6-astra | get-plan-context | 17 | 2.1 | 2.4 | 141 |
| gpt-6-astra | exchange-root-module | 2 | 0.3 | 1.8 | 876 |
| gpt-6-astra | delete-article-in-place | 1 | 0.1 | 1.7 | 1684 |
| gpt-6-astra | place-group | 1 | 0.1 | 0.9 | 929 |
| gpt-6-astra | change-group-attribute | 1 | 0.1 | 0.8 | 751 |
| gpt-6-astra | get-skill | 16 | 2.0 | 0.2 | 11 |
| gpt-6-astra | get-authoring-rules | 8 | 1.0 | 0.1 | 11 |
| gpt-6-astra | undo | 2 | 0.3 | 0.1 | 37 |
| gpt-6-astra | find-attributes | 1 | 0.1 | 0.0 | 40 |

## 1 gpt-6-astra — image-kitchen-left-wall

`.temp/result/benchmark-rml-18164-step4-a/gpt-6-astra/01-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.4 | 0.0 | 4.4 | 8.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 12.0 | 0.0 | 12.0 | 52.6k | 274 | 242 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 15.1 | 2.2 | 12.9 | 55.9k | 584 | 102 | 6.9k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.1 s |
| 4 | 1 | get-plan-images | 5.0 | 0.7 | 4.3 | 63.4k | 31 | 14 | 2.4k | getExternalObjectSnapshot ×1 0.7 s |
| 5 | 1 | — (stop) | 11.6 | 0.0 | 11.6 | 65.8k | 278 | 125 | – |  |

## 2 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/benchmark-rml-18164-step4-a/gpt-6-astra/02-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 5.0 | 0.0 | 5.0 | 6.4k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 4.2 | 0.0 | 4.2 | 51.0k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 30.6 | 4.0 | 26.6 | 54.0k | 932 | 354 | 10.0k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 3.9 s |
| 4 | 1 | get-plan-context | 6.0 | 0.0 | 6.0 | 65.0k | 107 | 84 | 1.3k | getExternalObjectPlanContext ×1 0.0 s |
| 5 | 1 | change-module-attribute | 10.0 | 1.7 | 8.3 | 66.4k | 188 | 130 | 0.1k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 1.6 s |
| 6 | 1 | change-module-attribute | 4.9 | 1.5 | 3.4 | 66.7k | 79 | 0 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.4 s |
| 7 | 1 | get-plan-context, get-plan-images | 3.8 | 0.6 | 3.2 | 66.9k | 49 | 0 | 3.7k | getExternalObjectSnapshot ×1 0.6 s, getExternalObjectPlanContext ×1 0.0 s |
| 8 | 1 | create-or-replace-groups | 29.5 | 2.3 | 27.2 | 70.6k | 1429 | 213 | 10.3k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.3 s |
| 9 | 1 | get-plan-context | 4.0 | 0.0 | 4.0 | 82.4k | 21 | 0 | 1.3k | getExternalObjectPlanContext ×1 0.0 s |
| 10 | 1 | — (stop) | 7.8 | 0.0 | 7.8 | 83.7k | 169 | 0 | – |  |

## 3 gpt-6-astra — image-planning-right-wall

`.temp/result/benchmark-rml-18164-step4-a/gpt-6-astra/03-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.0 | 0.0 | 4.0 | 7.8k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 4.1 | 0.0 | 4.1 | 52.4k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 34.6 | 3.7 | 30.9 | 55.5k | 1550 | 516 | 16.2k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 3.6 s |
| 4 | 1 | exchange-root-module | 12.1 | 0.9 | 11.2 | 73.2k | 313 | 172 | 8.9k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.8 s |
| 5 | 1 | exchange-root-module | 6.8 | 0.9 | 5.9 | 82.4k | 140 | 0 | 8.8k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.8 s |
| 6 | 1 | change-module-attribute | 4.7 | 0.6 | 4.2 | 91.4k | 74 | 13 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.5 s |
| 7 | 1 | delete-article-in-place | 6.1 | 1.7 | 4.4 | 91.5k | 63 | 14 | 8.3k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 1.6 s |
| 8 | 1 | get-plan-context, get-plan-images | 4.0 | 0.6 | 3.3 | 99.9k | 50 | 0 | 3.6k | getExternalObjectPlanContext ×1 0.0 s, getExternalObjectSnapshot ×1 0.6 s |
| 9 | 1 | — (stop) | 6.8 | 0.0 | 6.8 | 103.6k | 149 | 0 | – |  |

## 4 gpt-6-astra — image-only-no-text

`.temp/result/benchmark-rml-18164-step4-a/gpt-6-astra/04-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.8 | 0.0 | 4.8 | 7.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 14.2 | 0.0 | 14.1 | 51.5k | 356 | 256 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 17.6 | 2.1 | 15.5 | 54.9k | 798 | 125 | 9.5k | getExternalObjectPlanContext ×2 0.3 s, externalObjectGroupOperation ×1 1.8 s |
| 4 | 1 | change-group-attribute | 24.2 | 0.8 | 23.4 | 65.2k | 182 | 127 | 0.3k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.7 s |
| 5 | 1 | get-plan-context | 3.9 | 0.0 | 3.8 | 65.7k | 23 | 0 | 9.0k | getExternalObjectPlanContext ×1 0.0 s |
| 6 | 1 | — (stop) | 6.7 | 0.0 | 6.7 | 74.7k | 165 | 0 | – |  |

## 5 gpt-6-astra — image-only-no-text.attempt-1 (left out)

`.temp/result/benchmark-rml-18164-step4-a/gpt-6-astra/04-image-only-no-text.attempt-1`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 3.9 | 0.1 | 3.9 | 7.0k | 64 | 0 | – | getExternalObjectPlanContext ×1 0.0 s |

## 6 gpt-6-astra — image-kitchen-left-wall

`.temp/result/benchmark-rml-18164-step4-b/gpt-6-astra/01-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.1 | 0.0 | 4.1 | 8.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 7.2 | 0.0 | 7.2 | 52.6k | 159 | 127 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 15.8 | 1.9 | 13.9 | 55.8k | 594 | 114 | 6.8k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.8 s |
| 4 | 1 | get-plan-images | 4.2 | 0.6 | 3.6 | 63.2k | 42 | 25 | 2.4k | getExternalObjectSnapshot ×1 0.5 s |
| 5 | 1 | — (stop) | 7.8 | 0.0 | 7.8 | 65.6k | 140 | 0 | – |  |

## 7 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/benchmark-rml-18164-step4-b/gpt-6-astra/02-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.0 | 0.0 | 3.9 | 6.4k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 4.7 | 0.0 | 4.7 | 51.0k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 33.6 | 3.3 | 30.3 | 54.0k | 1040 | 442 | 10.8k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 3.2 s |
| 4 | 1 | undo | 5.7 | 0.0 | 5.6 | 65.9k | 99 | 84 | 0.1k | getExternalObjectPlanContext ×3 0.0 s, undo ×1 0.0 s |
| 5 | 1 | create-or-replace-groups | 12.9 | 2.9 | 10.0 | 66.1k | 499 | 0 | 9.7k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.9 s |
| 6 | 1 | change-module-attribute | 12.6 | 1.1 | 11.5 | 76.3k | 176 | 119 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.0 s |
| 7 | 1 | get-plan-context, get-plan-images | 5.1 | 0.6 | 4.5 | 76.5k | 50 | 0 | 3.6k | getExternalObjectPlanContext ×1 0.0 s, getExternalObjectSnapshot ×1 0.6 s |
| 8 | 1 | change-module-attribute | 6.1 | 1.0 | 5.2 | 80.2k | 78 | 22 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 9 | 1 | get-plan-context | 3.7 | 0.0 | 3.7 | 80.4k | 21 | 0 | 1.2k | getExternalObjectPlanContext ×1 0.0 s |
| 10 | 1 | — (stop) | 8.6 | 0.0 | 8.6 | 81.6k | 150 | 0 | – |  |

## 8 gpt-6-astra — image-planning-right-wall

`.temp/result/benchmark-rml-18164-step4-b/gpt-6-astra/03-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 3.9 | 0.0 | 3.9 | 7.8k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 3.3 | 0.0 | 3.2 | 52.4k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 38.5 | 3.9 | 34.7 | 55.5k | 1579 | 516 | 18.5k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 3.8 s |
| 4 | 1 | undo | 9.8 | 0.0 | 9.8 | 75.5k | 182 | 167 | 0.1k | getExternalObjectPlanContext ×3 0.0 s, undo ×1 0.0 s |
| 5 | 1 | create-or-replace-groups | 18.3 | 3.4 | 15.0 | 75.8k | 956 | 0 | 17.6k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 3.3 s |
| 6 | 1 | get-plan-context, get-plan-images | 19.9 | 0.7 | 19.2 | 94.3k | 67 | 15 | 4.0k | getExternalObjectSnapshot ×1 0.6 s, getExternalObjectPlanContext ×1 0.0 s |
| 7 | 1 | — (stop) | 7.8 | 0.0 | 7.8 | 98.4k | 152 | 0 | – |  |

## 9 gpt-6-astra — image-only-no-text

`.temp/result/benchmark-rml-18164-step4-b/gpt-6-astra/04-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.5 | 0.0 | 4.5 | 7.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 13.5 | 0.0 | 13.5 | 51.5k | 328 | 232 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 29.4 | 2.7 | 26.7 | 54.9k | 984 | 326 | 9.7k | getExternalObjectPlanContext ×2 0.4 s, externalObjectGroupOperation ×1 2.3 s |
| 4 | 1 | find-attributes, place-group | 8.3 | 0.9 | 7.4 | 65.6k | 175 | 105 | 6.0k | getExternalObjectPlanContext ×3 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 5 | 1 | get-plan-context, get-plan-images | 9.7 | 0.7 | 9.0 | 71.7k | 61 | 10 | 3.5k | getExternalObjectSnapshot ×1 0.6 s, getExternalObjectPlanContext ×1 0.0 s |
| 6 | 1 | — (stop) | 15.0 | 0.0 | 15.0 | 75.3k | 318 | 98 | – |  |
