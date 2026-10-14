# HI MCP benchmark

| Model | Test | Runs | Chat s mean | min | max | Steps mean | Input tokens mean |
|---|---|---|---|---|---|---|---|
| gpt-6-astra | image-kitchen-left-wall | 2 | 42.0 | 39.1 | 44.9 | 4.0 | 179.8k |
| gpt-6-astra | image-kitchen-back-right-corner | 2 | 75.1 | 65.4 | 84.9 | 7.0 | 387.4k |
| gpt-6-astra | image-planning-right-wall | 2 | 86.8 | 76.8 | 96.7 | 10.0 | 741.6k |
| gpt-6-astra | image-only-no-text | 2 | 74.9 | 58.5 | 91.3 | 7.5 | 443.1k |

## Runs

| Run | Model | Test | Chat s | Steps | Model s | Tools s | Other s | Input tokens | Output tokens | Reasoning tokens | Plan changes | Corrections | Not loaded | Errors | Left out |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | gpt-6-astra | image-kitchen-left-wall | 39.1 | 4 | 37.5 | 1.4 | 0.2 | 179.8k | 1176 | 461 | 1 | 3 | 0 | 0 |  |
| 2 | gpt-6-astra | image-kitchen-back-right-corner | 65.4 | 7 | 59.4 | 5.9 | 0.1 | 388.2k | 1811 | 471 | 3 | 9 | 0 | 0 |  |
| 3 | gpt-6-astra | image-planning-right-wall | 76.8 | 9 | 69.0 | 7.6 | 0.2 | 637.5k | 2080 | 526 | 5 | 8 | 1 | 0 |  |
| 4 | gpt-6-astra | image-only-no-text | 91.3 | 9 | 84.0 | 7.2 | 0.1 | 562.2k | 1979 | 631 | 5 | 12 | 0 | 0 |  |
| 5 | gpt-6-astra | image-kitchen-left-wall | 44.9 | 4 | 42.6 | 2.1 | 0.2 | 179.7k | 1038 | 304 | 1 | 3 | 0 | 0 |  |
| 6 | gpt-6-astra | image-kitchen-back-right-corner | 84.9 | 7 | 78.1 | 6.7 | 0.1 | 386.7k | 1897 | 807 | 3 | 4 | 0 | 0 |  |
| 7 | gpt-6-astra | image-planning-right-wall | 96.7 | 11 | 85.9 | 10.6 | 0.3 | 845.8k | 2781 | 945 | 7 | 12 | 1 | 0 |  |
| 8 | gpt-6-astra | image-only-no-text | 58.5 | 6 | 54.0 | 4.4 | 0.1 | 324.1k | 1739 | 716 | 2 | 8 | 0 | 0 |  |

## Tools

| Model | Tool | Calls | Calls per run | Total s | Mean ms |
|---|---|---|---|---|---|
| gpt-6-astra | create-or-replace-groups | 9 | 1.1 | 27.1 | 3014 |
| gpt-6-astra | change-module-attribute | 9 | 1.1 | 7.7 | 855 |
| gpt-6-astra | exchange-root-module | 4 | 0.5 | 3.7 | 922 |
| gpt-6-astra | get-plan-images | 5 | 0.6 | 3.1 | 615 |
| gpt-6-astra | get-plan-context | 13 | 1.6 | 2.1 | 164 |
| gpt-6-astra | place-group | 2 | 0.3 | 1.5 | 754 |
| gpt-6-astra | delete-article-in-place | 1 | 0.1 | 1.4 | 1355 |
| gpt-6-astra | change-group-attribute | 1 | 0.1 | 1.0 | 994 |
| gpt-6-astra | get-skill | 16 | 2.0 | 0.2 | 11 |
| gpt-6-astra | get-authoring-rules | 8 | 1.0 | 0.1 | 13 |
| gpt-6-astra | undo | 1 | 0.1 | 0.0 | 36 |

## 1 gpt-6-astra — image-kitchen-left-wall

`.temp/result/benchmark-rml-18164-step5-a/gpt-6-astra/01-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.3 | 0.0 | 4.2 | 8.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 3.7 | 0.0 | 3.7 | 52.6k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 25.0 | 1.3 | 23.7 | 55.7k | 900 | 418 | 6.8k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.2 s |
| 4 | 1 | — (stop) | 5.9 | 0.0 | 5.9 | 63.4k | 182 | 43 | – |  |

## 2 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/benchmark-rml-18164-step5-a/gpt-6-astra/02-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-skill, get-authoring-rules, get-plan-context | 5.7 | 0.0 | 5.6 | 6.4k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 4.4 | 0.0 | 4.4 | 51.0k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 22.0 | 3.1 | 19.0 | 54.1k | 899 | 324 | 9.3k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 2.9 s |
| 4 | 1 | undo | 7.7 | 0.0 | 7.6 | 64.3k | 162 | 147 | 0.1k | getExternalObjectPlanContext ×3 0.0 s, undo ×1 0.0 s |
| 5 | 1 | create-or-replace-groups | 10.5 | 2.7 | 7.8 | 64.5k | 461 | 0 | 8.4k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.7 s |
| 6 | 1 | get-plan-context | 7.5 | 0.0 | 7.5 | 73.4k | 21 | 0 | 1.1k | getExternalObjectPlanContext ×1 0.0 s |
| 7 | 1 | — (stop) | 7.5 | 0.0 | 7.5 | 74.5k | 174 | 0 | – |  |

## 3 gpt-6-astra — image-planning-right-wall

`.temp/result/benchmark-rml-18164-step5-a/gpt-6-astra/03-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 5.0 | 0.0 | 4.9 | 7.8k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 4.5 | 0.0 | 4.5 | 52.4k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 31.0 | 3.4 | 27.6 | 55.5k | 1357 | 388 | 14.3k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 3.3 s |
| 4 | 1 | exchange-root-module | 8.0 | 0.8 | 7.2 | 71.2k | 203 | 109 | 8.2k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.8 s |
| 5 | 1 | exchange-root-module | 5.8 | 0.8 | 5.0 | 79.6k | 92 | 0 | 8.2k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.8 s |
| 6 | 1 | change-module-attribute | 4.7 | 0.6 | 4.1 | 87.9k | 71 | 12 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.5 s |
| 7 | 1 | delete-article-in-place | 5.2 | 1.4 | 3.8 | 88.0k | 64 | 17 | 7.6k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.3 s |
| 8 | 1 | get-plan-images, get-plan-context | 4.1 | 0.6 | 3.6 | 95.7k | 49 | 0 | 3.5k | getExternalObjectSnapshot ×1 0.5 s, getExternalObjectPlanContext ×1 0.0 s |
| 9 | 1 | — (stop) | 8.3 | 0.0 | 8.3 | 99.3k | 150 | 0 | – |  |

## 4 gpt-6-astra — image-only-no-text

`.temp/result/benchmark-rml-18164-step5-a/gpt-6-astra/04-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.8 | 0.0 | 4.8 | 7.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 14.7 | 0.0 | 14.7 | 51.6k | 330 | 226 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 23.9 | 2.9 | 21.0 | 54.9k | 896 | 225 | 10.7k | getExternalObjectPlanContext ×2 0.7 s, externalObjectGroupOperation ×1 2.0 s |
| 4 | 1 | place-group | 5.9 | 0.8 | 5.1 | 66.5k | 80 | 43 | 6.5k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.7 s |
| 5 | 1 | get-plan-context, get-plan-images | 16.5 | 0.7 | 15.9 | 73.1k | 103 | 51 | 3.6k | getExternalObjectPlanContext ×1 0.0 s, getExternalObjectSnapshot ×1 0.6 s |
| 6 | 1 | change-module-attribute | 7.7 | 0.7 | 7.0 | 76.9k | 152 | 71 | 0.2k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.6 s |
| 7 | 1 | change-module-attribute | 5.3 | 1.0 | 4.3 | 77.2k | 96 | 15 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.0 s |
| 8 | 1 | change-module-attribute | 4.8 | 1.0 | 3.8 | 77.4k | 79 | 0 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.0 s |
| 9 | 1 | — (stop) | 7.6 | 0.0 | 7.6 | 77.6k | 179 | 0 | – |  |

## 5 gpt-6-astra — image-kitchen-left-wall

`.temp/result/benchmark-rml-18164-step5-b/gpt-6-astra/01-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.0 | 0.0 | 4.0 | 8.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 7.9 | 0.0 | 7.9 | 52.6k | 191 | 159 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 16.8 | 2.0 | 14.8 | 55.9k | 553 | 74 | 6.8k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.0 s |
| 4 | 1 | — (stop) | 15.9 | 0.0 | 15.9 | 63.2k | 230 | 71 | – |  |

## 6 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/benchmark-rml-18164-step5-b/gpt-6-astra/02-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 3.4 | 0.0 | 3.4 | 6.4k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 11.1 | 0.0 | 11.1 | 51.0k | 30 | 0 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 27.5 | 4.0 | 23.5 | 54.1k | 1049 | 413 | 10.6k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 3.9 s |
| 4 | 1 | get-plan-context, get-plan-images | 6.6 | 0.6 | 6.0 | 65.7k | 84 | 32 | 3.8k | getExternalObjectSnapshot ×1 0.6 s, getExternalObjectPlanContext ×1 0.0 s |
| 5 | 1 | change-group-attribute | 7.9 | 1.0 | 6.9 | 69.6k | 148 | 91 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 6 | 1 | change-module-attribute | 9.2 | 1.0 | 8.2 | 69.8k | 222 | 140 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 7 | 1 | — (stop) | 19.1 | 0.0 | 19.1 | 70.1k | 300 | 131 | – |  |

## 7 gpt-6-astra — image-planning-right-wall

`.temp/result/benchmark-rml-18164-step5-b/gpt-6-astra/03-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-skill, get-authoring-rules, get-plan-context | 4.8 | 0.0 | 4.8 | 7.8k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 18.7 | 0.0 | 18.7 | 52.4k | 610 | 516 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 24.8 | 4.6 | 20.3 | 56.1k | 1210 | 213 | 17.4k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 4.5 s |
| 4 | 1 | exchange-root-module | 9.7 | 1.0 | 8.6 | 74.7k | 258 | 140 | 9.2k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.0 s |
| 5 | 1 | exchange-root-module | 5.4 | 1.0 | 4.3 | 84.1k | 117 | 0 | 9.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.0 s |
| 6 | 1 | change-module-attribute | 4.6 | 0.7 | 3.9 | 93.4k | 56 | 0 | 0.1k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 0.6 s |
| 7 | 1 | change-module-attribute | 4.5 | 0.9 | 3.5 | 93.6k | 74 | 16 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 8 | 1 | change-module-attribute | 4.3 | 0.9 | 3.5 | 93.7k | 56 | 0 | 0.1k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 0.8 s |
| 9 | 1 | get-plan-context, get-plan-images | 4.5 | 0.6 | 4.0 | 93.8k | 49 | 0 | 4.0k | getExternalObjectSnapshot ×1 0.5 s, getExternalObjectPlanContext ×1 0.0 s |
| 10 | 1 | change-module-attribute | 7.4 | 0.9 | 6.5 | 97.9k | 119 | 60 | 0.1k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 0.8 s |
| 11 | 1 | — (stop) | 7.7 | 0.0 | 7.7 | 98.1k | 168 | 0 | – |  |

## 8 gpt-6-astra — image-only-no-text

`.temp/result/benchmark-rml-18164-step5-b/gpt-6-astra/04-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 3.9 | 0.0 | 3.8 | 7.0k | 64 | 0 | 44.5k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill | 12.9 | 0.0 | 12.9 | 51.6k | 381 | 287 | 3.0k |  |
| 3 | 1 | create-or-replace-groups | 20.2 | 3.0 | 17.2 | 55.0k | 858 | 246 | 9.5k | getExternalObjectPlanContext ×2 0.4 s, externalObjectGroupOperation ×1 2.6 s |
| 4 | 1 | place-group | 7.3 | 0.7 | 6.5 | 65.3k | 123 | 86 | 5.9k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.7 s |
| 5 | 1 | get-plan-images | 4.4 | 0.6 | 3.8 | 71.4k | 44 | 27 | 2.4k | getExternalObjectSnapshot ×1 0.6 s |
| 6 | 1 | — (stop) | 9.7 | 0.0 | 9.7 | 73.8k | 269 | 70 | – |  |
