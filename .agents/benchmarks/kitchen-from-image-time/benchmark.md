# HI MCP benchmark

| Model | Test | Runs | Chat s mean | min | max | Steps mean | Input tokens mean |
|---|---|---|---|---|---|---|---|
| gpt-6-astra | image-kitchen-left-wall | 2 | 69.7 | 68.8 | 70.6 | 9.5 | 597.0k |
| gpt-6-astra | image-kitchen-back-right-corner | 2 | 98.6 | 60.1 | 137.1 | 11.5 | 902.0k |
| gpt-6-astra | image-only-no-text | 2 | 108.5 | 76.5 | 140.5 | 9.5 | 599.2k |
| gpt-6-astra | image-planning-right-wall | 1 (fewer than 2) | 113.5 | 113.5 | 113.5 | 12.0 | 1102.2k |

Left out of the per-test and tool tables, because the chat ended with an error: run 2 (Failed to process successful response).

## Runs

| Run | Model | Test | Chat s | Steps | Model s | Tools s | Other s | Input tokens | Output tokens | Reasoning tokens | Plan changes | Corrections | Not loaded | Errors | Left out |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | gpt-6-astra | image-kitchen-left-wall | 68.8 | 9 | 61.6 | 7.0 | 0.2 | 563.4k | 1249 | 245 | 3 | 9 | 0 | 1 |  |
| 2 | gpt-6-astra | image-planning-right-wall | 133.7 | 6 | 55.5 | 16.4 | 61.8 | 384.7k | 1697 | 558 | 4 | 16 | 0 | 2 | chat error |
| 3 | gpt-6-astra | image-kitchen-back-right-corner | 137.1 | 16 | 109.1 | 27.9 | 0.1 | 1349.5k | 3197 | 661 | 10 | 21 | 0 | 1 |  |
| 4 | gpt-6-astra | image-only-no-text | 140.5 | 12 | 113.8 | 26.5 | 0.1 | 785.5k | 3354 | 561 | 6 | 37 | 0 | 1 |  |
| 5 | gpt-6-astra | image-kitchen-left-wall | 70.6 | 10 | 63.1 | 7.3 | 0.2 | 630.6k | 1238 | 245 | 2 | 8 | 0 | 0 |  |
| 6 | gpt-6-astra | image-planning-right-wall | 113.5 | 12 | 91.1 | 21.9 | 0.5 | 1102.2k | 2432 | 806 | 7 | 25 | 0 | 0 |  |
| 7 | gpt-6-astra | image-kitchen-back-right-corner | 60.1 | 7 | 48.4 | 11.6 | 0.1 | 454.5k | 1261 | 381 | 3 | 8 | 0 | 0 |  |
| 8 | gpt-6-astra | image-only-no-text | 76.5 | 7 | 63.7 | 12.6 | 0.2 | 412.9k | 1448 | 423 | 2 | 26 | 0 | 0 |  |

## Tools

| Model | Tool | Calls | Calls per run | Total s | Mean ms |
|---|---|---|---|---|---|
| gpt-6-astra | create-or-replace-groups | 12 | 1.7 | 90.1 | 7505 |
| gpt-6-astra | undo | 4 | 0.6 | 8.2 | 2053 |
| gpt-6-astra | change-module-attribute | 7 | 1.0 | 6.3 | 894 |
| gpt-6-astra | change-group-attribute | 3 | 0.4 | 2.8 | 933 |
| gpt-6-astra | place-group | 3 | 0.4 | 2.3 | 751 |
| gpt-6-astra | get-plan-images | 3 | 0.4 | 1.9 | 621 |
| gpt-6-astra | swap-root-modules | 2 | 0.3 | 1.6 | 808 |
| gpt-6-astra | delete-root-module | 1 | 0.1 | 1.6 | 1568 |
| gpt-6-astra | find-attributes | 49 | 7.0 | 1.1 | 23 |
| gpt-6-astra | get-plan-context | 12 | 1.7 | 0.3 | 26 |
| gpt-6-astra | delete-group | 1 | 0.1 | 0.1 | 89 |
| gpt-6-astra | get-authoring-rules | 7 | 1.0 | 0.1 | 10 |

## 1 gpt-6-astra — image-kitchen-left-wall

`.temp/result/mcp-test-2026-10-07_11-58-22/gpt-6-astra/28-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 3.4 | 0.0 | 3.4 | 6.3k | 47 | 0 | 49.5k | getExternalObjectPlanContext ×1 |
| 2 | 1 | find-attributes, find-attributes, find-attributes | 4.1 | 0.0 | 4.1 | 55.8k | 66 | 0 | 6.6k | getExternalObjectPlanContext ×3 |
| 3 | 1 | find-attributes, find-attributes | 7.0 | 0.0 | 7.0 | 62.5k | 80 | 20 | 1.1k | getExternalObjectPlanContext ×2 |
| 4 | 1 | create-or-replace-groups | 15.7 | 5.3 | 10.4 | 63.7k | 627 | 61 | 6.1k | getExternalObjectPlanContext ×5, getExternalObjectGroups ×3, loadExternalObjectGroupLayout ×1, externalObjectGroupOperation ×9 |
| 5 | 1 | get-plan-context, find-attributes | 9.4 | 0.0 | 9.4 | 70.4k | 70 | 16 | 1.2k | getExternalObjectPlanContext ×2 |
| 6 | 1 | find-attributes | 4.5 | 0.0 | 4.5 | 71.7k | 35 | 14 | 0.3k | getExternalObjectPlanContext ×1 |
| 7 | 1 | swap-root-modules | 8.3 | 0.8 | 7.5 | 72.0k | 216 | 134 | 5.5k | getExternalObjectPlanContext ×1, getExternalObjectGroups ×5, externalObjectGroupOperation ×1 |
| 8 | 1 | place-group | 4.0 | 0.8 | 3.2 | 77.7k | 30 | 0 | 5.6k | getExternalObjectPlanContext ×2, getExternalObjectGroups ×4, loadExternalObjectGroupLayout ×1 |
| 9 | 1 | — (stop) | 12.3 | 0.0 | 12.3 | 83.4k | 78 | 0 | – |  |

## 2 gpt-6-astra — image-planning-right-wall (left out)

`.temp/result/mcp-test-2026-10-07_11-58-22/gpt-6-astra/29-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 3.6 | 0.0 | 3.5 | 6.1k | 47 | 0 | 49.5k | getExternalObjectPlanContext ×1 |
| 2 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 7.0 | 0.0 | 7.0 | 55.6k | 81 | 0 | 6.9k | getExternalObjectPlanContext ×4 |
| 3 | 1 | create-or-replace-groups | 35.6 | 13.8 | 21.8 | 62.6k | 1245 | 404 | 15.1k | getExternalObjectPlanContext ×5, getExternalObjectGroups ×8, loadExternalObjectGroupLayout ×3, undo ×2, externalObjectGroupOperation ×16 |
| 4 | 1 | change-module-attribute | 8.0 | 0.9 | 7.1 | 79.0k | 119 | 62 | 7.7k | getExternalObjectPlanContext ×1, getExternalObjectGroups ×3, externalObjectGroupOperation ×1 |
| 5 | 1 | change-module-attribute | 7.6 | 0.9 | 6.7 | 86.8k | 98 | 42 | 7.7k | getExternalObjectPlanContext ×1, getExternalObjectGroups ×3, externalObjectGroupOperation ×1 |
| 6 | 1 | change-module-attribute | 10.2 | 0.9 | 9.3 | 94.7k | 107 | 50 | – | getExternalObjectPlanContext ×1, getExternalObjectGroups ×3, externalObjectGroupOperation ×1 |

## 3 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/mcp-test-2026-10-07_11-58-22/gpt-6-astra/30-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 3.6 | 0.0 | 3.5 | 4.7k | 47 | 0 | 49.5k | getExternalObjectPlanContext ×1 |
| 2 | 1 | find-attributes, find-attributes, find-attributes | 3.3 | 0.0 | 3.3 | 54.2k | 66 | 0 | 6.3k | getExternalObjectPlanContext ×3 |
| 3 | 1 | create-or-replace-groups | 22.9 | 7.9 | 15.0 | 60.5k | 712 | 287 | 7.9k | getExternalObjectPlanContext ×5, getExternalObjectGroups ×6, loadExternalObjectGroupLayout ×2, undo ×1, externalObjectGroupOperation ×7 |
| 4 | 1 | get-plan-context | 7.1 | 0.0 | 7.1 | 69.1k | 21 | 0 | 1.1k | getExternalObjectPlanContext ×1 |
| 5 | 1 | undo | 9.2 | 2.9 | 6.3 | 70.2k | 137 | 122 | 0.0k | getExternalObjectGroups ×2, undo ×8, getExternalObjectPlanContext ×1 |
| 6 | 1 | create-or-replace-groups | 13.4 | 6.3 | 7.1 | 70.4k | 381 | 0 | 7.8k | getExternalObjectPlanContext ×4, getExternalObjectGroups ×3, loadExternalObjectGroupLayout ×1, externalObjectGroupOperation ×7 |
| 7 | 1 | find-attributes | 15.9 | 0.0 | 15.8 | 78.6k | 38 | 16 | 0.4k | getExternalObjectPlanContext ×1 |
| 8 | 1 | delete-root-module | 6.1 | 1.6 | 4.6 | 79.0k | 111 | 68 | 7.3k | getExternalObjectPlanContext ×1, getExternalObjectGroups ×3, externalObjectGroupOperation ×1 |
| 9 | 1 | undo | 4.1 | 0.5 | 3.7 | 86.4k | 43 | 28 | 7.5k | getExternalObjectGroups ×3, undo ×1, getExternalObjectPlanContext ×1 |
| 10 | 1 | create-or-replace-groups | 12.4 | 0.7 | 11.8 | 93.9k | 881 | 0 | 6.3k | getExternalObjectPlanContext ×3, getExternalObjectGroups ×2, loadExternalObjectGroupLayout ×1 |
| 11 | 1 | place-group | 4.7 | 0.7 | 4.0 | 101.1k | 49 | 17 | 6.2k | getExternalObjectPlanContext ×2, getExternalObjectGroups ×4, loadExternalObjectGroupLayout ×1 |
| 12 | 1 | change-group-attribute | 5.6 | 1.0 | 4.7 | 107.3k | 90 | 52 | 6.6k | getExternalObjectPlanContext ×1, getExternalObjectGroups ×3, externalObjectGroupOperation ×1 |
| 13 | 1 | delete-group | 6.2 | 0.1 | 6.1 | 114.0k | 95 | 71 | 0.0k | getExternalObjectPlanContext ×1, getExternalObjectGroups ×2, externalObjectGroupOperation ×1 |
| 14 | 1 | create-or-replace-groups | 14.3 | 6.3 | 8.0 | 114.2k | 398 | 0 | 7.9k | getExternalObjectPlanContext ×4, getExternalObjectGroups ×3, loadExternalObjectGroupLayout ×1, externalObjectGroupOperation ×7 |
| 15 | 1 | get-plan-context | 3.7 | 0.0 | 3.7 | 122.5k | 21 | 0 | 1.1k | getExternalObjectPlanContext ×1 |
| 16 | 1 | — (stop) | 4.6 | 0.0 | 4.6 | 123.6k | 107 | 0 | – |  |

## 4 gpt-6-astra — image-only-no-text

`.temp/result/mcp-test-2026-10-07_11-58-22/gpt-6-astra/32-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 5.6 | 0.0 | 5.6 | 5.2k | 47 | 0 | 49.5k | getExternalObjectPlanContext ×1 |
| 2 | 1 | find-attributes, find-attributes, find-attributes, find-attributes, find-attributes | 9.3 | 0.0 | 9.2 | 54.7k | 270 | 113 | 1.3k | getExternalObjectPlanContext ×5 |
| 3 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 4.3 | 0.0 | 4.3 | 56.3k | 84 | 0 | 1.1k | getExternalObjectPlanContext ×4 |
| 4 | 1 | find-attributes | 6.7 | 0.0 | 6.7 | 57.4k | 37 | 16 | 2.9k | getExternalObjectPlanContext ×1 |
| 5 | 1 | find-attributes | 9.3 | 0.0 | 9.3 | 60.3k | 157 | 135 | 0.5k | getExternalObjectPlanContext ×1 |
| 6 | 1 | create-or-replace-groups | 19.0 | 10.4 | 8.6 | 61.0k | 579 | 0 | 10.2k | getExternalObjectPlanContext ×5, getExternalObjectGroups ×8, loadExternalObjectGroupLayout ×3, undo ×2, externalObjectGroupOperation ×20 |
| 7 | 1 | find-attributes | 6.6 | 0.0 | 6.6 | 71.8k | 75 | 52 | 0.0k | getExternalObjectPlanContext ×1 |
| 8 | 1 | undo | 8.5 | 4.4 | 4.1 | 71.9k | 41 | 26 | 0.0k | getExternalObjectGroups ×2, undo ×17, getExternalObjectPlanContext ×1 |
| 9 | 1 | create-or-replace-groups | 20.9 | 9.2 | 11.7 | 72.0k | 541 | 0 | 9.9k | getExternalObjectPlanContext ×4, getExternalObjectGroups ×3, loadExternalObjectGroupLayout ×1, externalObjectGroupOperation ×16 |
| 10 | 1 | change-module-attribute, change-module-attribute | 8.9 | 1.2 | 7.7 | 82.4k | 207 | 76 | 9.3k | getExternalObjectPlanContext ×2, getExternalObjectGroups ×6, externalObjectGroupOperation ×2 |
| 11 | 1 | create-or-replace-groups | 17.3 | 1.2 | 16.1 | 91.9k | 1167 | 101 | 7.6k | getExternalObjectPlanContext ×3, getExternalObjectGroups ×3, loadExternalObjectGroupLayout ×1 |
| 12 | 1 | — (stop) | 24.0 | 0.0 | 24.0 | 100.6k | 149 | 42 | – |  |

## 5 gpt-6-astra — image-kitchen-left-wall

`.temp/result/mcp-test-2026-10-08_13-56-35/gpt-6-astra/30-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 4.3 | 0.0 | 4.3 | 6.8k | 47 | 0 | 49.7k | getExternalObjectPlanContext ×1 |
| 2 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 4.7 | 0.0 | 4.7 | 56.5k | 82 | 0 | 6.3k | getExternalObjectPlanContext ×4 |
| 3 | 1 | find-attributes | 4.0 | 0.0 | 4.0 | 62.9k | 31 | 9 | 0.5k | getExternalObjectPlanContext ×1 |
| 4 | 1 | create-or-replace-groups | 20.3 | 5.7 | 14.6 | 63.5k | 639 | 67 | 6.0k | getExternalObjectPlanContext ×6, getExternalObjectGroups ×6, loadExternalObjectGroupLayout ×2, externalObjectGroupOperation ×8 |
| 5 | 1 | get-plan-context | 3.7 | 0.0 | 3.7 | 70.2k | 46 | 23 | 0.9k | getExternalObjectPlanContext ×1 |
| 6 | 1 | find-attributes | 4.8 | 0.0 | 4.8 | 71.1k | 79 | 58 | 0.3k | getExternalObjectPlanContext ×1 |
| 7 | 1 | get-plan-images | 5.6 | 0.7 | 5.0 | 71.5k | 42 | 25 | 2.4k | getExternalObjectSnapshot ×1 |
| 8 | 1 | find-attributes | 5.1 | 0.0 | 5.1 | 73.9k | 74 | 53 | 0.3k | getExternalObjectPlanContext ×1 |
| 9 | 1 | swap-root-modules | 12.3 | 0.8 | 11.5 | 74.3k | 104 | 10 | 5.5k | getExternalObjectPlanContext ×1, getExternalObjectGroups ×5, externalObjectGroupOperation ×1 |
| 10 | 1 | — (stop) | 5.5 | 0.0 | 5.5 | 79.9k | 94 | 0 | – |  |

## 6 gpt-6-astra — image-planning-right-wall

`.temp/result/mcp-test-2026-10-08_13-56-35/gpt-6-astra/31-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 3.7 | 0.0 | 3.7 | 6.6k | 47 | 0 | 49.7k | getExternalObjectPlanContext ×1 |
| 2 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 5.5 | 0.0 | 5.5 | 56.4k | 136 | 13 | 5.8k | getExternalObjectPlanContext ×4 |
| 3 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 10.6 | 0.0 | 10.6 | 62.3k | 329 | 244 | 1.5k | getExternalObjectPlanContext ×4 |
| 4 | 1 | create-or-replace-groups | 37.6 | 16.4 | 21.2 | 64.1k | 1144 | 247 | 16.6k | getExternalObjectPlanContext ×6, getExternalObjectGroups ×9, loadExternalObjectGroupLayout ×3, undo ×1, externalObjectGroupOperation ×20 |
| 5 | 1 | change-module-attribute | 8.4 | 0.9 | 7.6 | 81.9k | 204 | 151 | 8.5k | getExternalObjectPlanContext ×1, getExternalObjectGroups ×3, externalObjectGroupOperation ×1 |
| 6 | 1 | undo | 4.9 | 0.5 | 4.4 | 90.6k | 23 | 8 | 13.8k | getExternalObjectGroups ×3, undo ×1, getExternalObjectPlanContext ×1 |
| 7 | 1 | change-module-attribute | 8.3 | 0.8 | 7.5 | 104.4k | 112 | 59 | 8.4k | getExternalObjectPlanContext ×1, getExternalObjectGroups ×3, externalObjectGroupOperation ×1 |
| 8 | 1 | change-module-attribute | 4.5 | 0.8 | 3.6 | 112.9k | 56 | 0 | 8.4k | getExternalObjectPlanContext ×1, getExternalObjectGroups ×3, externalObjectGroupOperation ×1 |
| 9 | 1 | get-plan-context, get-plan-images | 7.6 | 0.6 | 7.0 | 121.4k | 75 | 24 | 3.9k | getExternalObjectPlanContext ×1, getExternalObjectSnapshot ×1 |
| 10 | 1 | change-module-attribute | 7.7 | 0.9 | 6.8 | 125.4k | 120 | 60 | 8.4k | getExternalObjectPlanContext ×1, getExternalObjectGroups ×3, externalObjectGroupOperation ×1 |
| 11 | 1 | change-module-attribute | 6.9 | 0.8 | 6.0 | 133.9k | 58 | 0 | 8.4k | getExternalObjectPlanContext ×1, getExternalObjectGroups ×3, externalObjectGroupOperation ×1 |
| 12 | 1 | — (stop) | 7.2 | 0.0 | 7.2 | 142.4k | 128 | 0 | – |  |

## 7 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/mcp-test-2026-10-08_13-56-35/gpt-6-astra/32-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 3.8 | 0.0 | 3.8 | 5.2k | 47 | 0 | 49.7k | getExternalObjectPlanContext ×1 |
| 2 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 4.1 | 0.0 | 4.1 | 54.9k | 80 | 0 | 9.4k | getExternalObjectPlanContext ×4 |
| 3 | 1 | create-or-replace-groups | 27.2 | 9.1 | 18.0 | 64.4k | 865 | 314 | 8.8k | getExternalObjectPlanContext ×6, getExternalObjectGroups ×6, loadExternalObjectGroupLayout ×2, externalObjectGroupOperation ×8 |
| 4 | 1 | get-plan-images | 4.8 | 0.6 | 4.2 | 74.1k | 38 | 21 | 2.4k | getExternalObjectSnapshot ×1 |
| 5 | 1 | change-group-attribute | 9.4 | 0.9 | 8.5 | 76.6k | 86 | 46 | 8.6k | getExternalObjectPlanContext ×1, getExternalObjectGroups ×3, externalObjectGroupOperation ×1 |
| 6 | 1 | change-group-attribute | 5.4 | 0.9 | 4.5 | 85.3k | 38 | 0 | 8.6k | getExternalObjectPlanContext ×1, getExternalObjectGroups ×3, externalObjectGroupOperation ×1 |
| 7 | 1 | — (stop) | 5.2 | 0.0 | 5.2 | 93.9k | 107 | 0 | – |  |

## 8 gpt-6-astra — image-only-no-text

`.temp/result/mcp-test-2026-10-08_13-56-35/gpt-6-astra/34-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 3.9 | 0.0 | 3.9 | 5.8k | 47 | 0 | 49.7k | getExternalObjectPlanContext ×1 |
| 2 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 11.0 | 0.0 | 11.0 | 55.5k | 305 | 158 | 3.7k | getExternalObjectPlanContext ×4 |
| 3 | 1 | find-attributes | 7.1 | 0.0 | 7.0 | 59.5k | 32 | 11 | 5.3k | getExternalObjectPlanContext ×1 |
| 4 | 1 | find-attributes, find-attributes | 12.1 | 0.0 | 12.1 | 64.9k | 178 | 123 | 1.2k | getExternalObjectPlanContext ×2 |
| 5 | 1 | create-or-replace-groups | 23.4 | 11.7 | 11.7 | 66.2k | 599 | 0 | 10.6k | getExternalObjectPlanContext ×6, getExternalObjectGroups ×6, loadExternalObjectGroupLayout ×2, externalObjectGroupOperation ×22 |
| 6 | 1 | place-group | 10.8 | 0.8 | 10.1 | 77.4k | 171 | 131 | 5.9k | getExternalObjectPlanContext ×2, getExternalObjectGroups ×5, loadExternalObjectGroupLayout ×1 |
| 7 | 1 | — (stop) | 8.0 | 0.0 | 8.0 | 83.5k | 116 | 0 | – |  |
