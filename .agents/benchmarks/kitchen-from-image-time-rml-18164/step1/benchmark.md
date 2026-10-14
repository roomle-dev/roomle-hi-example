# HI MCP benchmark

| Model | Test | Runs | Chat s mean | min | max | Steps mean | Input tokens mean |
|---|---|---|---|---|---|---|---|
| gpt-6-astra | image-kitchen-left-wall | 2 | 46.6 | 41.8 | 51.3 | 5.0 | 244.0k |
| gpt-6-astra | image-kitchen-back-right-corner | 2 | 97.2 | 75.4 | 119.1 | 8.0 | 502.2k |
| gpt-6-astra | image-planning-right-wall | 2 | 96.1 | 90.9 | 101.3 | 7.0 | 459.7k |
| gpt-6-astra | image-only-no-text | 2 | 61.7 | 60.2 | 63.3 | 6.0 | 325.3k |

## Runs

| Run | Model | Test | Chat s | Steps | Model s | Tools s | Other s | Input tokens | Output tokens | Reasoning tokens | Plan changes | Corrections | Not loaded | Errors | Left out |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | gpt-6-astra | image-kitchen-left-wall | 41.8 | 5 | 37.4 | 4.2 | 0.2 | 243.3k | 963 | 219 | 1 | 3 | 0 | 0 |  |
| 2 | gpt-6-astra | image-kitchen-back-right-corner | 119.1 | 9 | 104.2 | 14.8 | 0.1 | 618.6k | 2618 | 691 | 4 | 9 | 0 | 0 |  |
| 3 | gpt-6-astra | image-planning-right-wall | 101.3 | 7 | 89.2 | 11.9 | 0.3 | 473.5k | 2670 | 608 | 3 | 18 | 1 | 0 |  |
| 4 | gpt-6-astra | image-only-no-text | 63.3 | 6 | 58.7 | 4.5 | 0.1 | 326.5k | 1616 | 570 | 2 | 8 | 0 | 0 |  |
| 5 | gpt-6-astra | image-kitchen-left-wall | 51.3 | 5 | 46.6 | 4.5 | 0.2 | 244.7k | 934 | 217 | 1 | 3 | 0 | 0 |  |
| 6 | gpt-6-astra | image-kitchen-back-right-corner | 75.4 | 7 | 63.4 | 11.9 | 0.1 | 385.7k | 1520 | 438 | 3 | 4 | 0 | 0 |  |
| 7 | gpt-6-astra | image-planning-right-wall | 90.9 | 7 | 80.1 | 10.6 | 0.3 | 445.9k | 2175 | 615 | 3 | 12 | 0 | 0 |  |
| 8 | gpt-6-astra | image-only-no-text | 60.2 | 6 | 55.7 | 4.3 | 0.1 | 324.2k | 1613 | 610 | 2 | 8 | 0 | 0 |  |

## Tools

| Model | Tool | Calls | Calls per run | Total s | Mean ms |
|---|---|---|---|---|---|
| gpt-6-astra | create-or-replace-groups | 10 | 1.3 | 43.4 | 4336 |
| gpt-6-astra | change-module-attribute | 3 | 0.4 | 8.5 | 2844 |
| gpt-6-astra | undo | 3 | 0.4 | 6.1 | 2038 |
| gpt-6-astra | get-plan-images | 8 | 1.0 | 4.9 | 610 |
| gpt-6-astra | delete-article-in-place | 1 | 0.1 | 1.7 | 1735 |
| gpt-6-astra | get-plan-context | 13 | 1.6 | 1.7 | 129 |
| gpt-6-astra | place-group | 2 | 0.3 | 1.6 | 789 |
| gpt-6-astra | get-skill | 16 | 2.0 | 0.2 | 12 |
| gpt-6-astra | get-authoring-rules | 8 | 1.0 | 0.1 | 12 |

## 1 gpt-6-astra — image-kitchen-left-wall

`.temp/result/benchmark-rml-18164-step1-a/gpt-6-astra/01-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.3 | 0.0 | 4.3 | 8.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 5.1 | 0.0 | 5.0 | 52.5k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 20.2 | 4.1 | 16.1 | 55.6k | 678 | 195 | 6.9k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.1 s |
| 4 | 1 | get-plan-context | 4.9 | 0.0 | 4.9 | 63.2k | 47 | 24 | 0.9k | getExternalObjectPlanContext ×1 0.0 s |
| 5 | 1 | — (stop) | 7.1 | 0.0 | 7.1 | 64.1k | 144 | 0 | – |  |

## 2 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/benchmark-rml-18164-step1-a/gpt-6-astra/02-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.0 | 0.0 | 4.0 | 6.4k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 9.7 | 0.0 | 9.7 | 50.9k | 228 | 196 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 25.2 | 5.4 | 19.8 | 54.2k | 744 | 194 | 9.9k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 3.4 s |
| 4 | 1 | undo | 9.3 | 2.0 | 7.3 | 64.9k | 111 | 96 | 9.2k | getExternalObjectPlanContext ×1 0.0 s |
| 5 | 1 | undo | 15.4 | 2.0 | 13.3 | 74.2k | 23 | 8 | 9.2k | getExternalObjectPlanContext ×1 0.0 s |
| 6 | 1 | get-plan-context, get-plan-images | 6.6 | 0.6 | 5.9 | 83.5k | 62 | 11 | 3.7k | getExternalObjectSnapshot ×1 0.6 s, getExternalObjectPlanContext ×1 0.0 s |
| 7 | 1 | create-or-replace-groups | 30.7 | 4.1 | 26.6 | 87.2k | 1159 | 156 | 9.0k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.1 s |
| 8 | 1 | get-plan-images | 6.2 | 0.5 | 5.7 | 97.4k | 47 | 30 | 2.4k | getExternalObjectSnapshot ×1 0.5 s |
| 9 | 1 | — (stop) | 11.9 | 0.0 | 11.9 | 99.9k | 180 | 0 | – |  |

## 3 gpt-6-astra — image-planning-right-wall

`.temp/result/benchmark-rml-18164-step1-a/gpt-6-astra/03-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 5.2 | 0.0 | 5.1 | 7.8k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 20.9 | 0.0 | 20.9 | 52.4k | 485 | 404 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 25.2 | 5.7 | 19.4 | 55.9k | 827 | 0 | 16.3k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 3.7 s |
| 4 | 1 | undo | 11.8 | 2.0 | 9.8 | 73.0k | 153 | 138 | 13.7k | getExternalObjectPlanContext ×1 0.0 s |
| 5 | 1 | create-or-replace-groups | 23.3 | 3.4 | 19.8 | 86.9k | 954 | 66 | 9.0k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.4 s |
| 6 | 1 | get-plan-context, get-plan-images | 8.1 | 0.6 | 7.5 | 96.9k | 50 | 0 | 3.8k | getExternalObjectPlanContext ×1 0.0 s, getExternalObjectSnapshot ×1 0.6 s |
| 7 | 1 | — (stop) | 6.7 | 0.0 | 6.7 | 100.7k | 137 | 0 | – |  |

## 4 gpt-6-astra — image-only-no-text

`.temp/result/benchmark-rml-18164-step1-a/gpt-6-astra/04-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 3.9 | 0.0 | 3.9 | 6.9k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 19.4 | 0.0 | 19.3 | 51.5k | 504 | 406 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 17.3 | 3.0 | 14.3 | 55.0k | 724 | 74 | 10.4k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 2.9 s |
| 4 | 1 | place-group | 7.4 | 0.8 | 6.6 | 66.1k | 111 | 73 | 6.0k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.7 s |
| 5 | 1 | get-plan-images | 7.6 | 0.6 | 7.0 | 72.3k | 34 | 17 | 2.4k | getExternalObjectSnapshot ×1 0.6 s |
| 6 | 1 | — (stop) | 7.6 | 0.0 | 7.6 | 74.7k | 179 | 0 | – |  |

## 5 gpt-6-astra — image-kitchen-left-wall

`.temp/result/benchmark-rml-18164-step1-b/gpt-6-astra/01-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 8.9 | 0.0 | 8.8 | 8.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 5.3 | 0.0 | 5.3 | 52.5k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 19.3 | 3.9 | 15.4 | 55.6k | 664 | 186 | 6.8k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.8 s |
| 4 | 1 | get-plan-images | 10.6 | 0.6 | 10.0 | 63.1k | 48 | 31 | 2.4k | getExternalObjectSnapshot ×1 0.6 s |
| 5 | 1 | — (stop) | 7.1 | 0.0 | 7.1 | 65.5k | 128 | 0 | – |  |

## 6 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/benchmark-rml-18164-step1-b/gpt-6-astra/02-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-skill, get-authoring-rules, get-plan-context | 4.3 | 0.0 | 4.3 | 6.4k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 12.7 | 0.0 | 12.7 | 50.9k | 215 | 183 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 22.2 | 5.2 | 16.9 | 54.2k | 786 | 189 | 10.5k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 3.2 s |
| 4 | 1 | get-plan-context, get-plan-images | 6.8 | 0.6 | 6.2 | 65.5k | 86 | 34 | 3.8k | getExternalObjectSnapshot ×1 0.6 s, getExternalObjectPlanContext ×1 0.0 s |
| 5 | 1 | change-module-attribute | 10.1 | 3.0 | 7.1 | 69.3k | 121 | 32 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 6 | 1 | change-module-attribute | 12.0 | 2.9 | 9.1 | 69.6k | 87 | 0 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 7 | 1 | — (stop) | 7.2 | 0.0 | 7.2 | 69.8k | 161 | 0 | – |  |

## 7 gpt-6-astra — image-planning-right-wall

`.temp/result/benchmark-rml-18164-step1-b/gpt-6-astra/03-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.1 | 0.0 | 4.1 | 7.8k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 21.0 | 0.0 | 20.9 | 52.4k | 514 | 431 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 23.6 | 5.5 | 18.0 | 55.9k | 1110 | 0 | 19.7k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 3.5 s |
| 4 | 1 | get-plan-context, get-plan-images | 8.5 | 0.6 | 7.9 | 76.7k | 165 | 114 | 4.2k | getExternalObjectPlanContext ×1 0.0 s, getExternalObjectSnapshot ×1 0.6 s |
| 5 | 1 | change-module-attribute | 9.2 | 2.6 | 6.6 | 81.0k | 98 | 41 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.6 s |
| 6 | 1 | delete-article-in-place | 8.0 | 1.7 | 6.3 | 81.2k | 74 | 29 | 9.4k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 1.7 s |
| 7 | 1 | — (stop) | 16.3 | 0.0 | 16.3 | 90.8k | 150 | 0 | – |  |

## 8 gpt-6-astra — image-only-no-text

`.temp/result/benchmark-rml-18164-step1-b/gpt-6-astra/04-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.4 | 0.0 | 4.4 | 6.9k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 17.9 | 0.0 | 17.9 | 51.5k | 493 | 398 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 18.8 | 2.9 | 16.0 | 55.0k | 763 | 151 | 9.6k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.8 s |
| 4 | 1 | place-group | 7.3 | 0.8 | 6.5 | 65.4k | 89 | 51 | 6.0k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.7 s |
| 5 | 1 | get-plan-images | 4.1 | 0.6 | 3.5 | 71.5k | 27 | 10 | 2.4k | getExternalObjectSnapshot ×1 0.6 s |
| 6 | 1 | — (stop) | 7.4 | 0.0 | 7.4 | 73.9k | 177 | 0 | – |  |
