# HI MCP benchmark

| Model | Test | Runs | Chat s mean | min | max | Steps mean | Input tokens mean |
|---|---|---|---|---|---|---|---|
| gpt-6-astra | image-kitchen-left-wall | 2 | 45.9 | 42.0 | 49.8 | 4.0 | 180.1k |
| gpt-6-astra | image-kitchen-back-right-corner | 2 | 93.1 | 70.2 | 116.0 | 7.5 | 435.1k |
| gpt-6-astra | image-planning-right-wall | 2 | 100.4 | 76.9 | 123.9 | 9.0 | 678.3k |
| gpt-6-astra | image-only-no-text | 2 | 56.1 | 53.7 | 58.6 | 6.0 | 326.4k |

Left out of the per-test and tool tables, because the chat ended with an error: run 5 (the turn took longer than 5 minutes and was ended - the plan holds what the tools changed so far).

## Runs

| Run | Model | Test | Chat s | Steps | Model s | Tools s | Other s | Input tokens | Output tokens | Reasoning tokens | Plan changes | Corrections | Not loaded | Errors | Left out |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | gpt-6-astra | image-kitchen-left-wall | 49.8 | 4 | 47.4 | 2.2 | 0.2 | 181.0k | 1143 | 385 | 1 | 3 | 0 | 0 |  |
| 2 | gpt-6-astra | image-kitchen-back-right-corner | 70.2 | 7 | 64.3 | 5.8 | 0.1 | 392.0k | 1644 | 325 | 3 | 9 | 1 | 0 |  |
| 3 | gpt-6-astra | image-planning-right-wall | 76.9 | 7 | 71.3 | 5.4 | 0.3 | 465.2k | 2092 | 558 | 3 | 10 | 1 | 0 |  |
| 4 | gpt-6-astra | image-only-no-text | 53.7 | 6 | 49.8 | 3.8 | 0.1 | 327.9k | 1660 | 566 | 2 | 9 | 0 | 0 |  |
| 5 | gpt-6-astra | image-only-no-text.attempt-1 | 300.2 | 1 | 5.6 | 0.0 | 294.5 | 6.9k | 116 | 0 | 0 | 0 | 0 | 1 | chat error |
| 6 | gpt-6-astra | image-kitchen-left-wall | 42.0 | 4 | 40.4 | 1.4 | 0.2 | 179.3k | 1008 | 301 | 1 | 3 | 0 | 0 |  |
| 7 | gpt-6-astra | image-kitchen-back-right-corner | 116.0 | 8 | 108.0 | 7.9 | 0.1 | 478.3k | 1946 | 541 | 4 | 8 | 0 | 0 |  |
| 8 | gpt-6-astra | image-planning-right-wall | 123.9 | 11 | 113.6 | 10.1 | 0.3 | 891.3k | 2644 | 709 | 7 | 12 | 1 | 0 |  |
| 9 | gpt-6-astra | image-only-no-text | 58.6 | 6 | 53.8 | 4.6 | 0.1 | 324.9k | 1505 | 442 | 2 | 8 | 0 | 0 |  |

## Tools

| Model | Tool | Calls | Calls per run | Total s | Mean ms |
|---|---|---|---|---|---|
| gpt-6-astra | create-or-replace-groups | 10 | 1.3 | 27.9 | 2791 |
| gpt-6-astra | exchange-root-module | 4 | 0.5 | 4.0 | 996 |
| gpt-6-astra | change-module-attribute | 4 | 0.5 | 3.5 | 881 |
| gpt-6-astra | get-plan-images | 4 | 0.5 | 2.6 | 655 |
| gpt-6-astra | place-group | 2 | 0.3 | 1.7 | 863 |
| gpt-6-astra | get-plan-context | 14 | 1.8 | 1.7 | 119 |
| gpt-6-astra | change-group-attribute | 1 | 0.1 | 0.9 | 942 |
| gpt-6-astra | get-skill | 16 | 2.0 | 0.2 | 12 |
| gpt-6-astra | get-authoring-rules | 8 | 1.0 | 0.1 | 11 |
| gpt-6-astra | undo | 2 | 0.3 | 0.1 | 36 |
| gpt-6-astra | find-attributes | 1 | 0.1 | 0.0 | 40 |

## 1 gpt-6-astra — image-kitchen-left-wall

`.temp/result/benchmark-rml-18164-step2-a/gpt-6-astra/01-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.6 | 0.0 | 4.5 | 8.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 4.7 | 0.0 | 4.6 | 52.5k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 27.8 | 2.1 | 25.7 | 55.6k | 886 | 351 | 8.4k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.1 s |
| 4 | 1 | — (stop) | 12.6 | 0.0 | 12.6 | 64.9k | 163 | 34 | – |  |

## 2 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/benchmark-rml-18164-step2-a/gpt-6-astra/02-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.5 | 0.0 | 4.5 | 6.4k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 4.1 | 0.0 | 4.0 | 50.9k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 31.8 | 3.1 | 28.7 | 54.0k | 829 | 252 | 10.2k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.6 s |
| 4 | 1 | undo | 5.8 | 0.0 | 5.8 | 65.1k | 88 | 73 | 0.1k | getExternalObjectPlanContext ×3 0.0 s, undo ×1 0.0 s |
| 5 | 1 | create-or-replace-groups | 11.6 | 2.6 | 9.0 | 65.2k | 447 | 0 | 9.0k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.6 s |
| 6 | 1 | get-plan-context | 6.1 | 0.0 | 6.1 | 74.6k | 21 | 0 | 1.2k | getExternalObjectPlanContext ×1 0.0 s |
| 7 | 1 | — (stop) | 6.2 | 0.0 | 6.2 | 75.8k | 165 | 0 | – |  |

## 3 gpt-6-astra — image-planning-right-wall

`.temp/result/benchmark-rml-18164-step2-a/gpt-6-astra/03-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 5.8 | 0.0 | 5.7 | 7.8k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 18.5 | 0.0 | 18.5 | 52.4k | 412 | 334 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 25.4 | 2.7 | 22.7 | 55.8k | 1155 | 177 | 17.5k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 2.5 s |
| 4 | 1 | exchange-root-module | 6.5 | 1.0 | 5.6 | 74.5k | 142 | 32 | 9.3k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 5 | 1 | exchange-root-module | 5.2 | 1.0 | 4.2 | 84.0k | 102 | 0 | 9.3k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 6 | 1 | get-plan-context, get-plan-images | 4.6 | 0.6 | 4.0 | 93.4k | 66 | 15 | 3.9k | getExternalObjectSnapshot ×1 0.6 s, getExternalObjectPlanContext ×1 0.0 s |
| 7 | 1 | — (stop) | 10.5 | 0.0 | 10.5 | 97.4k | 151 | 0 | – |  |

## 4 gpt-6-astra — image-only-no-text

`.temp/result/benchmark-rml-18164-step2-a/gpt-6-astra/04-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.5 | 0.0 | 4.5 | 6.9k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 16.4 | 0.0 | 16.4 | 51.5k | 491 | 397 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 15.3 | 2.1 | 13.2 | 55.0k | 772 | 89 | 10.5k | getExternalObjectPlanContext ×2 0.3 s, externalObjectGroupOperation ×1 1.7 s |
| 4 | 1 | place-group | 6.4 | 0.9 | 5.4 | 66.2k | 107 | 67 | 5.9k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 5 | 1 | get-plan-context, get-plan-images | 4.6 | 0.7 | 3.9 | 72.3k | 64 | 13 | 3.6k | getExternalObjectPlanContext ×1 0.0 s, getExternalObjectSnapshot ×1 0.7 s |
| 6 | 1 | — (stop) | 6.4 | 0.0 | 6.4 | 75.9k | 162 | 0 | – |  |

## 5 gpt-6-astra — image-only-no-text.attempt-1 (left out)

`.temp/result/benchmark-rml-18164-step2-a/gpt-6-astra/04-image-only-no-text.attempt-1`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-skill, get-authoring-rules, get-plan-context | 5.6 | 0.0 | 5.6 | 6.9k | 116 | 0 | – | getExternalObjectPlanContext ×1 0.0 s |

## 6 gpt-6-astra — image-kitchen-left-wall

`.temp/result/benchmark-rml-18164-step2-b/gpt-6-astra/01-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.7 | 0.0 | 4.6 | 8.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 6.2 | 0.0 | 6.2 | 52.5k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 23.3 | 1.3 | 21.9 | 55.6k | 711 | 234 | 6.9k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 1.2 s |
| 4 | 1 | — (stop) | 7.7 | 0.0 | 7.7 | 63.2k | 203 | 67 | – |  |

## 7 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/benchmark-rml-18164-step2-b/gpt-6-astra/02-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.2 | 0.0 | 4.2 | 6.4k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 19.8 | 0.0 | 19.8 | 50.9k | 492 | 400 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 11.8 | 3.4 | 8.4 | 54.5k | 506 | 0 | 10.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 3.3 s |
| 4 | 1 | undo | 5.5 | 0.0 | 5.5 | 65.1k | 69 | 54 | 0.1k | getExternalObjectPlanContext ×3 0.0 s, undo ×1 0.0 s |
| 5 | 1 | create-or-replace-groups | 11.8 | 2.9 | 8.9 | 65.2k | 464 | 0 | 9.0k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.8 s |
| 6 | 1 | change-module-attribute | 50.9 | 1.0 | 49.9 | 74.6k | 146 | 87 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.0 s |
| 7 | 1 | get-plan-context, get-plan-images | 5.1 | 0.6 | 4.5 | 74.8k | 52 | 0 | 11.9k | getExternalObjectPlanContext ×1 0.0 s, getExternalObjectSnapshot ×1 0.6 s |
| 8 | 1 | — (stop) | 6.8 | 0.0 | 6.8 | 86.8k | 153 | 0 | – |  |

## 8 gpt-6-astra — image-planning-right-wall

`.temp/result/benchmark-rml-18164-step2-b/gpt-6-astra/03-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 6.1 | 0.0 | 6.1 | 7.8k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 19.6 | 0.0 | 19.6 | 52.4k | 515 | 439 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 28.2 | 3.9 | 24.2 | 55.9k | 1228 | 128 | 19.7k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 3.8 s |
| 4 | 1 | exchange-root-module | 8.0 | 1.0 | 6.9 | 76.8k | 144 | 58 | 11.4k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.0 s |
| 5 | 1 | exchange-root-module | 7.0 | 1.0 | 5.9 | 88.3k | 84 | 0 | 11.3k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 6 | 1 | change-module-attribute | 7.1 | 0.6 | 6.5 | 99.7k | 101 | 14 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.6 s |
| 7 | 1 | change-group-attribute | 6.9 | 0.9 | 6.0 | 100.0k | 75 | 32 | 0.2k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 8 | 1 | change-module-attribute | 7.0 | 0.9 | 6.1 | 100.2k | 85 | 0 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 9 | 1 | get-plan-context, get-plan-images | 5.7 | 0.6 | 5.0 | 100.4k | 49 | 0 | 4.3k | getExternalObjectSnapshot ×1 0.6 s, getExternalObjectPlanContext ×1 0.0 s |
| 10 | 1 | change-module-attribute | 8.5 | 1.0 | 7.5 | 104.8k | 126 | 38 | 0.1k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 0.9 s |
| 11 | 1 | — (stop) | 19.6 | 0.0 | 19.6 | 105.0k | 173 | 0 | – |  |

## 9 gpt-6-astra — image-only-no-text

`.temp/result/benchmark-rml-18164-step2-b/gpt-6-astra/04-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 3.9 | 0.0 | 3.9 | 6.9k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 15.9 | 0.0 | 15.9 | 51.5k | 354 | 261 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 19.0 | 3.8 | 15.2 | 54.9k | 782 | 135 | 10.4k | getExternalObjectPlanContext ×2 0.7 s, externalObjectGroupOperation ×1 3.1 s |
| 4 | 1 | find-attributes, place-group | 7.5 | 0.8 | 6.7 | 66.0k | 100 | 30 | 6.0k | getExternalObjectPlanContext ×3 0.1 s, externalObjectGroupOperation ×1 0.7 s |
| 5 | 1 | get-plan-context | 5.2 | 0.0 | 5.2 | 72.2k | 39 | 16 | 1.2k | getExternalObjectPlanContext ×1 0.0 s |
| 6 | 1 | — (stop) | 6.9 | 0.0 | 6.9 | 73.4k | 166 | 0 | – |  |
