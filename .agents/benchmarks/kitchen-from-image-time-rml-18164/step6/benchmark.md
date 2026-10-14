# HI MCP benchmark

| Model | Test | Runs | Chat s mean | min | max | Steps mean | Input tokens mean |
|---|---|---|---|---|---|---|---|
| gpt-6-astra | image-kitchen-left-wall | 2 | 38.4 | 35.5 | 41.2 | 5.0 | 244.2k |
| gpt-6-astra | image-kitchen-back-right-corner | 2 | 82.0 | 68.7 | 95.2 | 8.0 | 456.2k |
| gpt-6-astra | image-planning-right-wall | 2 | 107.0 | 89.1 | 125.0 | 8.0 | 565.8k |
| gpt-6-astra | image-only-no-text | 2 | 71.2 | 69.9 | 72.5 | 6.0 | 323.2k |

Left out of the per-test and tool tables, because the chat ended with an error: run 2 (the turn took longer than 5 minutes and was ended - the plan holds what the tools changed so far).

## Runs

| Run | Model | Test | Chat s | Steps | Model s | Tools s | Other s | Input tokens | Output tokens | Reasoning tokens | Plan changes | Corrections | Not loaded | Errors | Left out |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | gpt-6-astra | image-kitchen-left-wall | 35.5 | 5 | 32.5 | 2.8 | 0.2 | 243.7k | 872 | 160 | 1 | 1 | 0 | 0 |  |
| 2 | gpt-6-astra | image-kitchen-left-wall.attempt-1 | 300.2 | 4 | 36.6 | 2.9 | 260.8 | 179.3k | 1023 | 449 | 1 | 3 | 0 | 1 | chat error |
| 3 | gpt-6-astra | image-kitchen-back-right-corner | 68.7 | 7 | 63.4 | 5.2 | 0.1 | 384.3k | 1529 | 554 | 2 | 5 | 0 | 0 |  |
| 4 | gpt-6-astra | image-planning-right-wall | 89.1 | 6 | 81.9 | 6.9 | 0.3 | 371.5k | 3451 | 704 | 2 | 18 | 1 | 0 |  |
| 5 | gpt-6-astra | image-only-no-text | 72.5 | 6 | 67.9 | 4.5 | 0.2 | 323.6k | 1989 | 869 | 2 | 8 | 0 | 0 |  |
| 6 | gpt-6-astra | image-kitchen-left-wall | 41.2 | 5 | 38.5 | 2.5 | 0.2 | 244.6k | 1015 | 293 | 1 | 3 | 0 | 0 |  |
| 7 | gpt-6-astra | image-kitchen-back-right-corner | 95.2 | 9 | 87.6 | 7.5 | 0.1 | 528.1k | 1702 | 573 | 4 | 4 | 0 | 0 |  |
| 8 | gpt-6-astra | image-planning-right-wall | 125.0 | 10 | 114.7 | 9.9 | 0.3 | 760.2k | 3058 | 1173 | 6 | 12 | 1 | 0 |  |
| 9 | gpt-6-astra | image-only-no-text | 69.9 | 6 | 65.0 | 4.7 | 0.2 | 322.8k | 1860 | 779 | 2 | 9 | 0 | 0 |  |

## Tools

| Model | Tool | Calls | Calls per run | Total s | Mean ms |
|---|---|---|---|---|---|
| gpt-6-astra | create-or-replace-groups | 9 | 1.1 | 28.0 | 3109 |
| gpt-6-astra | change-module-attribute | 6 | 0.8 | 5.6 | 926 |
| gpt-6-astra | get-plan-images | 8 | 1.0 | 5.1 | 638 |
| gpt-6-astra | get-plan-context | 15 | 1.9 | 3.0 | 201 |
| gpt-6-astra | exchange-root-module | 2 | 0.3 | 2.3 | 1150 |
| gpt-6-astra | place-group | 2 | 0.3 | 1.6 | 808 |
| gpt-6-astra | change-group-attribute | 1 | 0.1 | 1.0 | 996 |
| gpt-6-astra | get-skill | 16 | 2.0 | 0.2 | 12 |
| gpt-6-astra | get-authoring-rules | 8 | 1.0 | 0.1 | 12 |

## 1 gpt-6-astra — image-kitchen-left-wall

`.temp/result/benchmark-rml-18164-step6-a/gpt-6-astra/01-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.3 | 0.0 | 4.2 | 8.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 5.1 | 0.0 | 5.1 | 52.6k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 15.0 | 2.2 | 12.9 | 55.7k | 623 | 150 | 6.2k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.1 s |
| 4 | 1 | get-plan-images | 4.8 | 0.6 | 4.2 | 62.5k | 27 | 10 | 2.4k | getExternalObjectSnapshot ×1 0.6 s |
| 5 | 1 | — (stop) | 6.1 | 0.0 | 6.1 | 64.9k | 128 | 0 | – |  |

## 2 gpt-6-astra — image-kitchen-left-wall.attempt-1 (left out)

`.temp/result/benchmark-rml-18164-step6-a/gpt-6-astra/01-image-kitchen-left-wall.attempt-1`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.0 | 0.0 | 3.9 | 8.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 7.1 | 0.0 | 7.1 | 52.6k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 22.8 | 2.2 | 20.6 | 55.7k | 880 | 417 | 6.4k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 2.0 s |
| 4 | 1 | get-plan-images | 5.6 | 0.7 | 5.0 | 63.0k | 49 | 32 | – | getExternalObjectSnapshot ×1 0.6 s |

## 3 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/benchmark-rml-18164-step6-a/gpt-6-astra/02-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 3.9 | 0.0 | 3.8 | 6.4k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 3.8 | 0.0 | 3.8 | 51.0k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 28.8 | 3.5 | 25.2 | 54.1k | 926 | 360 | 9.8k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 3.4 s |
| 4 | 1 | get-plan-context, get-plan-images | 7.8 | 0.6 | 7.2 | 64.9k | 101 | 50 | 3.7k | getExternalObjectSnapshot ×1 0.6 s, getExternalObjectPlanContext ×1 0.0 s |
| 5 | 1 | change-group-attribute | 12.0 | 1.0 | 11.0 | 68.7k | 194 | 124 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 6 | 1 | get-plan-context | 4.8 | 0.0 | 4.8 | 69.0k | 43 | 20 | 1.3k | getExternalObjectPlanContext ×1 0.0 s |
| 7 | 1 | — (stop) | 7.6 | 0.0 | 7.6 | 70.3k | 171 | 0 | – |  |

## 4 gpt-6-astra — image-planning-right-wall

`.temp/result/benchmark-rml-18164-step6-a/gpt-6-astra/03-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.8 | 0.1 | 4.7 | 7.8k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 9.8 | 0.0 | 9.8 | 52.4k | 232 | 200 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 32.7 | 4.0 | 28.7 | 55.7k | 1411 | 282 | 17.8k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 4.0 s |
| 4 | 1 | create-or-replace-groups | 27.1 | 2.2 | 25.0 | 75.0k | 1516 | 204 | 11.6k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 2.1 s |
| 5 | 1 | get-plan-context, get-plan-images | 7.4 | 0.7 | 6.8 | 88.1k | 70 | 18 | 4.2k | getExternalObjectPlanContext ×1 0.0 s, getExternalObjectSnapshot ×1 0.6 s |
| 6 | 1 | — (stop) | 6.9 | 0.0 | 6.9 | 92.4k | 158 | 0 | – |  |

## 5 gpt-6-astra — image-only-no-text

`.temp/result/benchmark-rml-18164-step6-a/gpt-6-astra/04-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 7.8 | 0.0 | 7.8 | 7.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 11.2 | 0.0 | 11.2 | 51.6k | 296 | 206 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 24.1 | 3.0 | 21.1 | 54.9k | 972 | 307 | 8.8k | getExternalObjectPlanContext ×2 0.4 s, externalObjectGroupOperation ×1 2.6 s |
| 4 | 1 | place-group | 10.6 | 0.8 | 9.8 | 64.7k | 205 | 167 | 6.0k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.8 s |
| 5 | 1 | get-plan-images, get-plan-context | 4.9 | 0.6 | 4.3 | 70.9k | 77 | 26 | 3.5k | getExternalObjectSnapshot ×1 0.6 s, getExternalObjectPlanContext ×1 0.0 s |
| 6 | 1 | — (stop) | 13.8 | 0.0 | 13.8 | 74.5k | 375 | 163 | – |  |

## 6 gpt-6-astra — image-kitchen-left-wall

`.temp/result/benchmark-rml-18164-step6-b/gpt-6-astra/01-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.2 | 0.0 | 4.2 | 8.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 3.5 | 0.0 | 3.5 | 52.6k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 19.3 | 1.8 | 17.5 | 55.7k | 757 | 275 | 6.4k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 1.5 s |
| 4 | 1 | get-plan-images | 6.6 | 0.6 | 6.0 | 62.9k | 35 | 18 | 2.4k | getExternalObjectSnapshot ×1 0.6 s |
| 5 | 1 | — (stop) | 7.4 | 0.0 | 7.4 | 65.3k | 129 | 0 | – |  |

## 7 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/benchmark-rml-18164-step6-b/gpt-6-astra/02-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 3.9 | 0.1 | 3.9 | 6.4k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 3.4 | 0.0 | 3.4 | 51.0k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 27.6 | 3.7 | 23.9 | 54.1k | 915 | 363 | 9.2k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 3.6 s |
| 4 | 1 | get-plan-context, get-plan-images | 20.6 | 0.6 | 19.9 | 64.2k | 70 | 18 | 3.6k | getExternalObjectSnapshot ×1 0.6 s, getExternalObjectPlanContext ×1 0.0 s |
| 5 | 1 | change-module-attribute | 16.2 | 1.1 | 15.1 | 67.9k | 255 | 175 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.0 s |
| 6 | 1 | change-module-attribute | 5.3 | 0.9 | 4.4 | 68.3k | 78 | 0 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 7 | 1 | change-module-attribute | 5.9 | 1.0 | 4.9 | 68.5k | 98 | 17 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.0 s |
| 8 | 1 | get-plan-context | 3.7 | 0.0 | 3.6 | 68.7k | 23 | 0 | 10.3k | getExternalObjectPlanContext ×1 0.0 s |
| 9 | 1 | — (stop) | 8.5 | 0.0 | 8.5 | 79.0k | 169 | 0 | – |  |

## 8 gpt-6-astra — image-planning-right-wall

`.temp/result/benchmark-rml-18164-step6-b/gpt-6-astra/03-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.8 | 0.0 | 4.7 | 7.8k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 23.3 | 0.0 | 23.3 | 52.4k | 602 | 516 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 30.1 | 4.3 | 25.8 | 56.1k | 1307 | 238 | 17.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 4.3 s |
| 4 | 1 | exchange-root-module | 9.9 | 1.1 | 8.8 | 74.5k | 217 | 88 | 10.4k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 1.0 s |
| 5 | 1 | exchange-root-module | 8.0 | 1.2 | 6.8 | 85.2k | 127 | 0 | 10.4k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 1.1 s |
| 6 | 1 | change-module-attribute | 4.6 | 0.7 | 3.9 | 95.7k | 58 | 0 | 0.1k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 0.6 s |
| 7 | 1 | change-module-attribute | 16.7 | 0.9 | 15.8 | 95.9k | 85 | 25 | 0.1k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 0.8 s |
| 8 | 1 | change-module-attribute | 4.5 | 0.9 | 3.6 | 96.0k | 58 | 0 | 0.1k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 0.8 s |
| 9 | 1 | get-plan-context, get-plan-images | 4.8 | 0.7 | 4.1 | 96.2k | 49 | 0 | 4.1k | getExternalObjectSnapshot ×1 0.7 s, getExternalObjectPlanContext ×1 0.0 s |
| 10 | 1 | — (stop) | 18.0 | 0.0 | 18.0 | 100.3k | 491 | 306 | – |  |

## 9 gpt-6-astra — image-only-no-text

`.temp/result/benchmark-rml-18164-step6-b/gpt-6-astra/04-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.4 | 0.0 | 4.4 | 7.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 21.6 | 0.0 | 21.6 | 51.6k | 610 | 516 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 18.1 | 3.2 | 14.9 | 55.2k | 736 | 80 | 8.9k | getExternalObjectPlanContext ×2 0.5 s, externalObjectGroupOperation ×1 2.7 s |
| 4 | 1 | place-group | 8.3 | 0.8 | 7.5 | 64.8k | 137 | 100 | 5.9k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.8 s |
| 5 | 1 | get-plan-images | 4.5 | 0.6 | 3.9 | 70.9k | 31 | 14 | 2.4k | getExternalObjectSnapshot ×1 0.6 s |
| 6 | 1 | — (stop) | 12.8 | 0.0 | 12.8 | 73.3k | 282 | 69 | – |  |
