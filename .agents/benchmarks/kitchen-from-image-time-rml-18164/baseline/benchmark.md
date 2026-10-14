# HI MCP benchmark

| Model | Test | Runs | Chat s mean | min | max | Steps mean | Input tokens mean |
|---|---|---|---|---|---|---|---|
| gpt-6-astra | image-kitchen-left-wall | 2 | 47.3 | 42.4 | 52.2 | 5.0 | 237.3k |
| gpt-6-astra | image-kitchen-back-right-corner | 2 | 117.2 | 101.9 | 132.5 | 11.0 | 707.8k |
| gpt-6-astra | image-planning-right-wall | 2 | 161.0 | 135.5 | 186.5 | 9.0 | 691.2k |
| gpt-6-astra | image-only-no-text | 2 | 88.7 | 86.6 | 90.8 | 8.5 | 489.2k |

## Runs

| Run | Model | Test | Chat s | Steps | Model s | Tools s | Other s | Input tokens | Output tokens | Reasoning tokens | Plan changes | Corrections | Not loaded | Errors | Left out |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | gpt-6-astra | image-kitchen-left-wall | 52.2 | 5 | 46.3 | 5.6 | 0.3 | 237.7k | 1128 | 313 | 1 | 1 | 0 | 0 |  |
| 2 | gpt-6-astra | image-kitchen-back-right-corner | 101.9 | 10 | 84.8 | 17.0 | 0.1 | 699.9k | 2097 | 957 | 5 | 2 | 1 | 0 |  |
| 3 | gpt-6-astra | image-planning-right-wall | 186.5 | 9 | 170.7 | 15.5 | 0.3 | 664.0k | 3529 | 939 | 4 | 18 | 1 | 0 |  |
| 4 | gpt-6-astra | image-only-no-text | 86.6 | 9 | 78.6 | 7.8 | 0.2 | 507.0k | 2251 | 530 | 3 | 7 | 1 | 0 |  |
| 5 | gpt-6-astra | image-kitchen-left-wall | 42.4 | 5 | 37.8 | 4.4 | 0.2 | 236.8k | 988 | 192 | 1 | 1 | 0 | 0 |  |
| 6 | gpt-6-astra | image-kitchen-back-right-corner | 132.5 | 12 | 115.2 | 17.2 | 0.1 | 715.7k | 2641 | 1305 | 4 | 4 | 0 | 0 |  |
| 7 | gpt-6-astra | image-planning-right-wall | 135.5 | 9 | 120.4 | 14.8 | 0.3 | 718.5k | 4874 | 1154 | 4 | 11 | 1 | 0 |  |
| 8 | gpt-6-astra | image-only-no-text | 90.8 | 8 | 81.2 | 9.5 | 0.2 | 471.3k | 2616 | 797 | 3 | 8 | 1 | 0 |  |

## Tools

| Model | Tool | Calls | Calls per run | Total s | Mean ms |
|---|---|---|---|---|---|
| gpt-6-astra | create-or-replace-groups | 12 | 1.5 | 54.0 | 4501 |
| gpt-6-astra | undo | 8 | 1.0 | 15.8 | 1973 |
| gpt-6-astra | get-plan-images | 9 | 1.1 | 6.4 | 708 |
| gpt-6-astra | change-module-attribute | 2 | 0.3 | 6.0 | 2982 |
| gpt-6-astra | change-group-attribute | 2 | 0.3 | 5.9 | 2931 |
| gpt-6-astra | exchange-root-module | 1 | 0.1 | 3.2 | 3249 |
| gpt-6-astra | get-plan-context | 18 | 2.3 | 2.4 | 132 |
| gpt-6-astra | find-attributes | 47 | 5.9 | 1.2 | 25 |
| gpt-6-astra | get-skill | 16 | 2.0 | 0.2 | 13 |
| gpt-6-astra | get-authoring-rules | 8 | 1.0 | 0.1 | 11 |

## 1 gpt-6-astra — image-kitchen-left-wall

`.temp/result/benchmark-rml-18164-baseline-a/gpt-6-astra/01-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context, find-attributes | 5.7 | 0.0 | 5.6 | 7.9k | 79 | 0 | 41.2k | getExternalObjectPlanContext ×2 0.0 s |
| 2 | 1 | get-skill, find-attributes, find-attributes, find-attributes | 6.5 | 0.0 | 6.5 | 49.2k | 105 | 11 | 5.0k | getExternalObjectPlanContext ×3 0.0 s |
| 3 | 1 | create-or-replace-groups | 26.3 | 4.8 | 21.5 | 54.3k | 750 | 289 | 6.4k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.6 s |
| 4 | 1 | get-plan-context, get-plan-images | 5.6 | 0.8 | 4.9 | 61.5k | 64 | 13 | 3.2k | getExternalObjectSnapshot ×1 0.7 s, getExternalObjectPlanContext ×1 0.0 s |
| 5 | 1 | — (stop) | 7.9 | 0.0 | 7.9 | 64.8k | 130 | 0 | – |  |

## 2 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/benchmark-rml-18164-baseline-a/gpt-6-astra/02-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context, find-attributes | 4.5 | 0.0 | 4.5 | 6.3k | 79 | 0 | 41.2k | getExternalObjectPlanContext ×2 0.0 s |
| 2 | 1 | get-skill, find-attributes, find-attributes, find-attributes | 6.4 | 0.0 | 6.3 | 47.6k | 160 | 17 | 4.6k | getExternalObjectPlanContext ×3 0.0 s |
| 3 | 1 | create-or-replace-groups | 34.4 | 5.7 | 28.8 | 52.4k | 1025 | 514 | 10.7k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 3.6 s |
| 4 | 1 | find-attributes, get-plan-context | 9.2 | 0.0 | 9.2 | 64.1k | 216 | 161 | 2.5k | getExternalObjectPlanContext ×2 0.0 s |
| 5 | 1 | undo | 12.9 | 2.0 | 10.9 | 66.9k | 238 | 223 | 10.2k | getExternalObjectPlanContext ×1 0.0 s |
| 6 | 1 | undo | 6.2 | 2.0 | 4.2 | 77.4k | 26 | 11 | 10.2k | getExternalObjectPlanContext ×1 0.0 s |
| 7 | 1 | exchange-root-module | 7.7 | 3.2 | 4.4 | 87.6k | 70 | 11 | 10.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.2 s |
| 8 | 1 | change-group-attribute | 7.3 | 2.9 | 4.3 | 97.8k | 76 | 20 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 9 | 1 | get-plan-context, get-plan-images | 5.3 | 1.0 | 4.3 | 98.0k | 49 | 0 | 3.8k | getExternalObjectPlanContext ×1 0.0 s, getExternalObjectSnapshot ×1 0.9 s |
| 10 | 1 | — (stop) | 7.9 | 0.0 | 7.9 | 101.8k | 158 | 0 | – |  |

## 3 gpt-6-astra — image-planning-right-wall

`.temp/result/benchmark-rml-18164-baseline-a/gpt-6-astra/03-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 5.1 | 0.0 | 5.1 | 7.7k | 64 | 0 | 39.0k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill, find-attributes, find-attributes, find-attributes | 4.7 | 0.0 | 4.7 | 46.8k | 92 | 0 | 6.5k | getExternalObjectPlanContext ×3 0.0 s |
| 3 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 24.2 | 0.1 | 24.1 | 53.3k | 660 | 516 | 2.1k | getExternalObjectPlanContext ×4 0.0 s |
| 4 | 1 | create-or-replace-groups | 30.1 | 6.2 | 23.9 | 56.0k | 1078 | 222 | 16.6k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 4.2 s |
| 5 | 1 | undo | 11.0 | 2.0 | 9.0 | 73.7k | 137 | 122 | 14.0k | getExternalObjectPlanContext ×1 0.0 s |
| 6 | 1 | undo | 6.3 | 2.0 | 4.3 | 87.9k | 24 | 9 | 14.0k | getExternalObjectPlanContext ×1 0.0 s |
| 7 | 1 | create-or-replace-groups | 26.7 | 4.2 | 22.5 | 101.9k | 1240 | 60 | 13.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.2 s |
| 8 | 1 | get-plan-context, get-plan-images | 70.8 | 0.9 | 69.8 | 116.2k | 62 | 10 | 4.1k | getExternalObjectPlanContext ×1 0.0 s, getExternalObjectSnapshot ×1 0.8 s |
| 9 | 1 | — (stop) | 7.3 | 0.0 | 7.3 | 120.4k | 172 | 0 | – |  |

## 4 gpt-6-astra — image-only-no-text

`.temp/result/benchmark-rml-18164-baseline-a/gpt-6-astra/04-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.1 | 0.0 | 4.1 | 6.9k | 64 | 0 | 39.0k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill, find-attributes, find-attributes | 5.5 | 0.0 | 5.5 | 45.9k | 152 | 9 | 5.3k | getExternalObjectPlanContext ×2 0.0 s |
| 3 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 20.8 | 0.0 | 20.7 | 51.4k | 310 | 227 | 2.3k | getExternalObjectPlanContext ×4 0.0 s |
| 4 | 1 | create-or-replace-groups | 17.2 | 2.2 | 15.0 | 54.0k | 789 | 156 | 10.2k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.2 s |
| 5 | 1 | undo | 10.9 | 1.8 | 9.1 | 65.0k | 129 | 114 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, undo ×4 0.7 s |
| 6 | 1 | get-plan-context | 3.4 | 0.0 | 3.4 | 65.1k | 23 | 0 | 0.2k | getExternalObjectPlanContext ×1 0.0 s |
| 7 | 1 | create-or-replace-groups | 12.7 | 3.1 | 9.6 | 65.3k | 566 | 11 | 9.0k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 3.0 s |
| 8 | 1 | get-plan-context, get-plan-images | 4.7 | 0.6 | 4.1 | 74.9k | 64 | 13 | 3.6k | getExternalObjectSnapshot ×1 0.6 s, getExternalObjectPlanContext ×1 0.0 s |
| 9 | 1 | — (stop) | 7.1 | 0.0 | 7.1 | 78.5k | 154 | 0 | – |  |

## 5 gpt-6-astra — image-kitchen-left-wall

`.temp/result/benchmark-rml-18164-baseline-b/gpt-6-astra/01-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context, find-attributes | 5.0 | 0.0 | 4.9 | 7.9k | 79 | 0 | 41.2k | getExternalObjectPlanContext ×2 0.0 s |
| 2 | 1 | get-skill, find-attributes, find-attributes, find-attributes | 4.8 | 0.0 | 4.8 | 49.2k | 105 | 11 | 5.0k | getExternalObjectPlanContext ×3 0.0 s |
| 3 | 1 | create-or-replace-groups | 19.7 | 3.7 | 15.9 | 54.3k | 624 | 154 | 6.5k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.7 s |
| 4 | 1 | get-plan-images | 4.9 | 0.6 | 4.3 | 61.4k | 44 | 27 | 2.4k | getExternalObjectSnapshot ×1 0.6 s |
| 5 | 1 | — (stop) | 7.8 | 0.0 | 7.8 | 63.9k | 136 | 0 | – |  |

## 6 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/benchmark-rml-18164-baseline-b/gpt-6-astra/02-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 9.3 | 0.0 | 9.2 | 6.3k | 64 | 0 | 39.0k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill, find-attributes, find-attributes | 4.5 | 0.0 | 4.5 | 45.3k | 79 | 0 | 5.3k | getExternalObjectPlanContext ×2 0.0 s |
| 3 | 1 | find-attributes, find-attributes, find-attributes | 6.5 | 0.0 | 6.5 | 50.8k | 84 | 16 | 1.5k | getExternalObjectPlanContext ×3 0.0 s |
| 4 | 1 | find-attributes, find-attributes, find-attributes | 22.8 | 0.0 | 22.8 | 52.4k | 550 | 421 | 1.1k | getExternalObjectPlanContext ×3 0.0 s |
| 5 | 1 | create-or-replace-groups | 29.3 | 7.0 | 22.3 | 54.0k | 873 | 357 | 10.2k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 5.0 s |
| 6 | 1 | get-plan-context, get-plan-images | 7.1 | 0.7 | 6.4 | 65.1k | 120 | 68 | 3.7k | getExternalObjectPlanContext ×1 0.0 s, getExternalObjectSnapshot ×1 0.6 s |
| 7 | 1 | change-group-attribute | 18.7 | 2.9 | 15.8 | 68.9k | 380 | 324 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 8 | 1 | change-module-attribute | 8.3 | 3.0 | 5.3 | 69.4k | 117 | 39 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.0 s |
| 9 | 1 | change-module-attribute | 6.8 | 2.9 | 3.9 | 69.6k | 82 | 0 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 10 | 1 | get-plan-context | 3.7 | 0.0 | 3.6 | 69.8k | 40 | 15 | 11.1k | getExternalObjectPlanContext ×1 0.0 s |
| 11 | 1 | get-plan-images | 6.4 | 0.5 | 5.9 | 80.9k | 82 | 65 | 2.4k | getExternalObjectSnapshot ×1 0.5 s |
| 12 | 1 | — (stop) | 9.0 | 0.0 | 9.0 | 83.3k | 170 | 0 | – |  |

## 7 gpt-6-astra — image-planning-right-wall

`.temp/result/benchmark-rml-18164-baseline-b/gpt-6-astra/03-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 4.5 | 0.0 | 4.5 | 7.7k | 64 | 0 | 39.0k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill, find-attributes, find-attributes, find-attributes, find-attributes | 4.1 | 0.0 | 4.1 | 46.8k | 107 | 0 | 6.9k | getExternalObjectPlanContext ×4 0.0 s |
| 3 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 20.6 | 0.0 | 20.5 | 53.7k | 611 | 479 | 2.0k | getExternalObjectPlanContext ×4 0.0 s |
| 4 | 1 | create-or-replace-groups | 31.5 | 6.2 | 25.3 | 56.4k | 1338 | 259 | 19.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 4.1 s |
| 5 | 1 | undo | 12.4 | 2.0 | 10.4 | 76.8k | 221 | 206 | 16.5k | getExternalObjectPlanContext ×1 0.0 s |
| 6 | 1 | undo | 6.1 | 2.0 | 4.1 | 93.6k | 13 | 0 | 16.5k | getExternalObjectPlanContext ×1 0.0 s |
| 7 | 1 | create-or-replace-groups | 36.4 | 3.9 | 32.6 | 110.1k | 2151 | 78 | 22.2k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 3.8 s |
| 8 | 1 | get-plan-context, get-plan-images | 6.1 | 0.6 | 5.4 | 134.5k | 49 | 0 | 4.4k | getExternalObjectSnapshot ×1 0.6 s, getExternalObjectPlanContext ×1 0.0 s |
| 9 | 1 | — (stop) | 13.5 | 0.0 | 13.5 | 138.9k | 320 | 132 | – |  |

## 8 gpt-6-astra — image-only-no-text

`.temp/result/benchmark-rml-18164-baseline-b/gpt-6-astra/04-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-skill, get-plan-context | 5.0 | 0.0 | 5.0 | 6.9k | 64 | 0 | 39.0k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-skill, find-attributes, find-attributes, find-attributes, find-attributes, find-attributes | 15.0 | 0.0 | 14.9 | 45.9k | 422 | 235 | 7.3k | getExternalObjectPlanContext ×5 0.0 s |
| 3 | 1 | create-or-replace-groups | 25.8 | 3.5 | 22.3 | 53.6k | 1063 | 312 | 13.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 3.5 s |
| 4 | 1 | undo | 10.3 | 1.8 | 8.5 | 67.8k | 141 | 126 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, undo ×4 0.8 s |
| 5 | 1 | get-plan-context | 3.8 | 0.0 | 3.7 | 68.0k | 23 | 0 | 0.2k | getExternalObjectPlanContext ×1 0.0 s |
| 6 | 1 | create-or-replace-groups | 16.4 | 3.4 | 12.9 | 68.2k | 639 | 65 | 10.5k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 3.4 s |
| 7 | 1 | get-plan-images | 4.5 | 0.6 | 3.9 | 79.3k | 15 | 0 | 2.4k | getExternalObjectSnapshot ×1 0.6 s |
| 8 | 1 | — (stop) | 9.9 | 0.0 | 9.9 | 81.7k | 249 | 59 | – |  |
