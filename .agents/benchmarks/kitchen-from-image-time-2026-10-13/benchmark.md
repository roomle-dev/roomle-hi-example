# HI MCP benchmark

| Model | Test | Runs | Chat s mean | min | max | Steps mean | Input tokens mean |
|---|---|---|---|---|---|---|---|
| gpt-5-mini | image-kitchen-left-wall | 1 (fewer than 2) | 94.0 | 94.0 | 94.0 | 4.0 | 227.5k |
| gpt-5-mini | image-planning-right-wall | 1 (fewer than 2) | 81.1 | 81.1 | 81.1 | 4.0 | 226.7k |
| gpt-5-mini | image-kitchen-back-right-corner | 1 (fewer than 2) | 112.5 | 112.5 | 112.5 | 4.0 | 229.6k |
| gpt-5-mini | image-only-no-text | 1 (fewer than 2) | 96.0 | 96.0 | 96.0 | 4.0 | 232.1k |
| gpt-5.4-mini | image-planning-right-wall | 1 (fewer than 2) | 233.2 | 233.2 | 233.2 | 10.0 | 543.8k |
| gpt-5.4-mini | image-kitchen-back-right-corner | 1 (fewer than 2) | 161.1 | 161.1 | 161.1 | 5.0 | 268.4k |
| gpt-5.4-mini | image-only-no-text | 1 (fewer than 2) | 216.6 | 216.6 | 216.6 | 13.0 | 635.0k |
| gpt-6-astra | image-kitchen-left-wall | 3 | 46.3 | 35.4 | 54.9 | 5.3 | 245.1k |
| gpt-6-astra | image-planning-right-wall | 3 | 84.1 | 42.6 | 122.4 | 7.0 | 478.6k |
| gpt-6-astra | image-kitchen-back-right-corner | 3 | 47.6 | 41.6 | 59.2 | 5.3 | 291.7k |
| gpt-6-astra | image-only-no-text | 3 | 51.9 | 49.9 | 53.2 | 5.7 | 267.2k |
| Mistral-Large-3 | image-kitchen-left-wall | 1 (fewer than 2) | 20.4 | 20.4 | 20.4 | 3.0 | 116.6k |
| Mistral-Large-3 | image-kitchen-back-right-corner | 1 (fewer than 2) | 24.2 | 24.2 | 24.2 | 3.0 | 115.7k |
| Mistral-Large-3 | image-planning-right-wall | 1 (fewer than 2) | 32.1 | 32.1 | 32.1 | 3.0 | 120.9k |
| Mistral-Large-3 | image-only-no-text | 1 (fewer than 2) | 65.6 | 65.6 | 65.6 | 4.0 | 199.0k |

Left out of the per-test and tool tables, because the chat ended with an error: run 5 (the turn took longer than 5 minutes and was ended - the plan holds what the tools changed so far).

## Runs

| Run | Model | Test | Chat s | Steps | Model s | Tools s | Other s | Input tokens | Output tokens | Reasoning tokens | Plan changes | Corrections | Not loaded | Errors | Left out |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | gpt-5-mini | image-kitchen-left-wall | 94.0 | 4 | 91.6 | 2.1 | 0.2 | 227.5k | 10633 | 9664 | 1 | 3 | 0 | 0 |  |
| 2 | gpt-5-mini | image-planning-right-wall | 81.1 | 4 | 78.7 | 2.2 | 0.3 | 226.7k | 8688 | 7744 | 1 | 2 | 0 | 0 |  |
| 3 | gpt-5-mini | image-kitchen-back-right-corner | 112.5 | 4 | 109.7 | 2.7 | 0.1 | 229.6k | 12764 | 11968 | 1 | 1 | 0 | 0 |  |
| 4 | gpt-5-mini | image-only-no-text | 96.0 | 4 | 93.1 | 2.7 | 0.1 | 232.1k | 10346 | 9472 | 1 | 2 | 0 | 0 |  |
| 5 | gpt-5.4-mini | image-kitchen-left-wall | 300.2 | 6 | 288.1 | 5.8 | 6.4 | 496.1k | 25173 | 24058 | 3 | 0 | 1 | 1 | chat error |
| 6 | gpt-5.4-mini | image-planning-right-wall | 233.2 | 10 | 224.2 | 8.7 | 0.2 | 543.8k | 20394 | 18980 | 3 | 1 | 1 | 0 |  |
| 7 | gpt-5.4-mini | image-kitchen-back-right-corner | 161.1 | 5 | 157.4 | 3.6 | 0.1 | 268.4k | 17875 | 17248 | 2 | 4 | 0 | 0 |  |
| 8 | gpt-5.4-mini | image-only-no-text | 216.6 | 13 | 211.7 | 4.7 | 0.2 | 635.0k | 18891 | 18046 | 2 | 2 | 0 | 0 |  |
| 9 | gpt-6-astra | image-kitchen-left-wall | 54.9 | 8 | 50.8 | 3.7 | 0.4 | 367.5k | 1137 | 232 | 2 | 1 | 0 | 0 |  |
| 10 | gpt-6-astra | image-planning-right-wall | 42.6 | 4 | 38.1 | 4.3 | 0.2 | 153.8k | 1631 | 475 | 1 | 6 | 0 | 0 |  |
| 11 | gpt-6-astra | image-kitchen-back-right-corner | 42.1 | 4 | 38.8 | 3.3 | 0.1 | 139.8k | 992 | 267 | 1 | 0 | 0 | 0 |  |
| 12 | gpt-6-astra | image-only-no-text | 52.6 | 6 | 47.6 | 4.6 | 0.4 | 248.0k | 1574 | 491 | 2 | 5 | 0 | 0 |  |
| 13 | gpt-6-astra | image-kitchen-left-wall | 48.5 | 4 | 43.8 | 4.3 | 0.5 | 214.0k | 754 | 56 | 1 | 1 | 0 | 0 |  |
| 14 | gpt-6-astra | image-kitchen-back-right-corner | 41.6 | 5 | 36.3 | 5.1 | 0.1 | 282.7k | 1012 | 301 | 1 | 1 | 0 | 0 |  |
| 15 | gpt-6-astra | image-planning-right-wall | 122.4 | 10 | 104.1 | 17.7 | 0.5 | 884.9k | 3362 | 712 | 4 | 12 | 1 | 0 |  |
| 16 | gpt-6-astra | image-only-no-text | 53.2 | 5 | 44.2 | 8.8 | 0.2 | 295.1k | 1326 | 376 | 2 | 4 | 0 | 0 |  |
| 17 | Mistral-Large-3 | image-kitchen-left-wall | 20.4 | 3 | 18.5 | 1.7 | 0.2 | 116.6k | 749 | 0 | 1 | 0 | 0 | 0 |  |
| 18 | Mistral-Large-3 | image-kitchen-back-right-corner | 24.2 | 3 | 21.1 | 3.0 | 0.1 | 115.7k | 862 | 0 | 1 | 0 | 0 | 0 |  |
| 19 | Mistral-Large-3 | image-planning-right-wall | 32.1 | 3 | 23.1 | 8.0 | 1.0 | 120.9k | 806 | 0 | 1 | 4 | 0 | 0 |  |
| 20 | Mistral-Large-3 | image-only-no-text | 65.6 | 4 | 42.2 | 22.2 | 1.2 | 199.0k | 1741 | 0 | 4 | 1 | 0 | 0 |  |
| 21 | gpt-6-astra | image-kitchen-left-wall | 35.4 | 4 | 31.3 | 3.8 | 0.3 | 153.7k | 757 | 76 | 1 | 1 | 0 | 0 |  |
| 22 | gpt-6-astra | image-kitchen-back-right-corner | 59.2 | 7 | 48.7 | 10.4 | 0.1 | 452.5k | 1219 | 364 | 3 | 3 | 0 | 0 |  |
| 23 | gpt-6-astra | image-planning-right-wall | 87.3 | 7 | 76.5 | 10.5 | 0.3 | 397.0k | 3174 | 527 | 2 | 17 | 1 | 0 |  |
| 24 | gpt-6-astra | image-only-no-text | 49.9 | 6 | 45.1 | 4.6 | 0.2 | 258.5k | 1319 | 402 | 2 | 4 | 0 | 0 |  |

## Tools

| Model | Tool | Calls | Calls per run | Total s | Mean ms |
|---|---|---|---|---|---|
| gpt-5-mini | create-or-replace-groups | 4 | 1.0 | 9.6 | 2399 |
| gpt-5-mini | get-plan-context | 4 | 1.0 | 0.1 | 35 |
| gpt-5-mini | get-authoring-rules | 4 | 1.0 | 0.0 | 9 |
| gpt-5.4-mini | create-or-replace-groups | 4 | 1.3 | 11.9 | 2967 |
| gpt-5.4-mini | get-plan-images | 5 | 1.7 | 2.4 | 484 |
| gpt-5.4-mini | undo | 1 | 0.3 | 1.0 | 1036 |
| gpt-5.4-mini | change-group-attribute | 1 | 0.3 | 0.9 | 883 |
| gpt-5.4-mini | merge-article-into-group | 1 | 0.3 | 0.6 | 569 |
| gpt-5.4-mini | find-attributes | 12 | 4.0 | 0.3 | 23 |
| gpt-5.4-mini | get-plan-context | 3 | 1.0 | 0.1 | 30 |
| gpt-5.4-mini | get-authoring-rules | 3 | 1.0 | 0.0 | 8 |
| gpt-6-astra | create-or-replace-groups | 14 | 1.2 | 64.6 | 4616 |
| gpt-6-astra | change-module-attribute | 2 | 0.2 | 5.6 | 2802 |
| gpt-6-astra | undo | 2 | 0.2 | 4.1 | 2063 |
| gpt-6-astra | place-group | 3 | 0.3 | 3.2 | 1066 |
| gpt-6-astra | get-plan-images | 3 | 0.3 | 1.8 | 615 |
| gpt-6-astra | find-attributes | 63 | 5.3 | 1.6 | 26 |
| gpt-6-astra | swap-root-modules | 1 | 0.1 | 0.8 | 798 |
| gpt-6-astra | get-plan-context | 15 | 1.3 | 0.4 | 29 |
| gpt-6-astra | get-authoring-rules | 12 | 1.0 | 0.1 | 11 |
| Mistral-Large-3 | create-or-replace-groups | 6 | 1.5 | 39.0 | 6507 |
| Mistral-Large-3 | place-group | 1 | 0.3 | 6.0 | 6013 |
| Mistral-Large-3 | get-plan-context | 4 | 1.0 | 0.1 | 23 |
| Mistral-Large-3 | get-authoring-rules | 4 | 1.0 | 0.0 | 7 |

## 1 gpt-5-mini — image-kitchen-left-wall

`.temp/result/mcp-test-2026-10-08_18-33-08/gpt-5-mini/30-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-plan-context | 5.4 | 0.0 | 5.3 | 5.9k | 394 | 320 | 60.0k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-authoring-rules | 4.6 | 0.0 | 4.6 | 66.3k | 257 | 192 | 4.4k |  |
| 3 | 1 | create-or-replace-groups | 61.0 | 2.1 | 58.9 | 71.0k | 6770 | 6400 | 6.5k | getExternalObjectPlanContext ×6 0.3 s, getExternalObjectGroups ×6 0.1 s, loadExternalObjectGroupLayout ×2 0.7 s, externalObjectGroupOperation ×1 0.2 s |
| 4 | 1 | — (stop) | 22.9 | 0.0 | 22.9 | 84.3k | 3212 | 2752 | – |  |

## 2 gpt-5-mini — image-planning-right-wall

`.temp/result/mcp-test-2026-10-08_18-33-08/gpt-5-mini/31-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-plan-context | 11.0 | 0.0 | 11.0 | 6.0k | 882 | 832 | 60.0k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-authoring-rules | 9.7 | 0.0 | 9.6 | 66.9k | 480 | 448 | 4.4k |  |
| 3 | 1 | create-or-replace-groups | 41.1 | 2.1 | 39.0 | 71.7k | 5080 | 4800 | 5.3k | getExternalObjectPlanContext ×6 0.1 s, getExternalObjectGroups ×6 0.1 s, loadExternalObjectGroupLayout ×2 0.7 s, externalObjectGroupOperation ×1 0.2 s |
| 4 | 1 | — (stop) | 19.0 | 0.0 | 19.0 | 82.2k | 2246 | 1664 | – |  |

## 3 gpt-5-mini — image-kitchen-back-right-corner

`.temp/result/mcp-test-2026-10-08_18-33-08/gpt-5-mini/32-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-plan-context | 9.2 | 0.0 | 9.2 | 5.7k | 387 | 320 | 60.0k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-authoring-rules | 8.7 | 0.0 | 8.7 | 66.1k | 493 | 448 | 4.4k |  |
| 3 | 1 | create-or-replace-groups | 73.6 | 2.7 | 70.9 | 71.0k | 9263 | 8960 | 6.4k | getExternalObjectPlanContext ×6 0.3 s, getExternalObjectGroups ×6 0.2 s, loadExternalObjectGroupLayout ×2 0.8 s, externalObjectGroupOperation ×1 0.2 s |
| 4 | 1 | — (stop) | 20.9 | 0.0 | 20.9 | 86.7k | 2621 | 2240 | – |  |

## 4 gpt-5-mini — image-only-no-text

`.temp/result/mcp-test-2026-10-08_18-33-08/gpt-5-mini/34-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-plan-context | 6.2 | 0.0 | 6.2 | 6.0k | 356 | 320 | 60.0k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-authoring-rules | 21.0 | 0.0 | 20.9 | 66.4k | 2206 | 2176 | 4.4k |  |
| 3 | 1 | create-or-replace-groups | 45.3 | 2.7 | 42.7 | 73.0k | 5100 | 4736 | 8.6k | getExternalObjectPlanContext ×6 0.2 s, getExternalObjectGroups ×6 0.2 s, loadExternalObjectGroupLayout ×2 1.0 s, externalObjectGroupOperation ×1 0.3 s |
| 4 | 1 | — (stop) | 23.4 | 0.0 | 23.4 | 86.7k | 2684 | 2240 | – |  |

## 5 gpt-5.4-mini — image-kitchen-left-wall (left out)

`.temp/result/mcp-test-2026-10-08_18-33-08/gpt-5.4-mini/30-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 3.6 | 0.0 | 3.6 | 5.9k | 271 | 205 | 64.4k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | create-or-replace-groups | 209.5 | 1.7 | 207.8 | 70.6k | 19251 | 18756 | 5.2k | getExternalObjectPlanContext ×6 0.1 s, getExternalObjectGroups ×7 0.1 s, loadExternalObjectGroupLayout ×2 0.7 s, externalObjectGroupOperation ×1 0.1 s |
| 3 | 1 | get-plan-images | 23.0 | 0.7 | 22.3 | 95.1k | 2314 | 2297 | 1.5k | getExternalObjectSnapshot ×1 0.7 s |
| 4 | 1 | undo | 17.2 | 1.5 | 15.8 | 98.9k | 762 | 747 | 0.1k | getExternalObjectGroups ×1 0.0 s, undo ×3 0.4 s, getExternalObjectPlanContext ×1 0.0 s |
| 5 | 1 | get-plan-context | 8.4 | 0.0 | 8.4 | 99.7k | 80 | 53 | 26.2k | getExternalObjectPlanContext ×1 0.0 s |
| 6 | 1 | create-or-replace-groups | 32.0 | 1.8 | 30.2 | 126.0k | 2495 | 2000 | – | getExternalObjectPlanContext ×5 0.1 s, getExternalObjectGroups ×7 0.1 s, loadExternalObjectGroupLayout ×2 0.9 s, externalObjectGroupOperation ×1 0.1 s |

## 6 gpt-5.4-mini — image-planning-right-wall

`.temp/result/mcp-test-2026-10-08_18-33-08/gpt-5.4-mini/31-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 4.4 | 0.0 | 4.4 | 6.0k | 249 | 189 | 32.2k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | find-attributes | 34.3 | 0.0 | 34.3 | 38.4k | 2669 | 2633 | 0.0k | getExternalObjectPlanContext ×1 0.0 s |
| 3 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 4.3 | 0.0 | 4.2 | 41.1k | 157 | 42 | 3.2k | getExternalObjectPlanContext ×4 0.0 s |
| 4 | 1 | get-plan-images | 53.8 | 0.3 | 53.5 | 44.5k | 4609 | 4592 | 1.5k | getExternalObjectSnapshot ×1 0.3 s |
| 5 | 1 | find-attributes | 30.9 | 0.0 | 30.9 | 50.6k | 3442 | 3412 | 0.0k | getExternalObjectPlanContext ×1 0.0 s |
| 6 | 1 | create-or-replace-groups | 63.9 | 3.7 | 60.2 | 54.1k | 6601 | 6115 | 10.3k | getExternalObjectPlanContext ×6 0.4 s, getExternalObjectGroups ×10 0.2 s, loadExternalObjectGroupLayout ×3 1.1 s, undo ×1 0.0 s, externalObjectGroupOperation ×2 0.6 s |
| 7 | 1 | undo | 9.7 | 1.0 | 8.6 | 70.9k | 347 | 332 | 0.1k | getExternalObjectGroups ×2 0.0 s, undo ×4 0.9 s, getExternalObjectPlanContext ×1 0.0 s |
| 8 | 1 | create-or-replace-groups | 10.6 | 3.1 | 7.5 | 71.3k | 923 | 436 | 10.4k | getExternalObjectPlanContext ×5 0.1 s, getExternalObjectGroups ×7 0.1 s, loadExternalObjectGroupLayout ×2 1.1 s, externalObjectGroupOperation ×2 0.7 s |
| 9 | 1 | get-plan-images | 6.1 | 0.5 | 5.6 | 82.7k | 44 | 27 | 1.5k | getExternalObjectSnapshot ×1 0.5 s |
| 10 | 1 | — (stop) | 14.9 | 0.0 | 14.9 | 84.2k | 1353 | 1202 | – |  |

## 7 gpt-5.4-mini — image-kitchen-back-right-corner

`.temp/result/mcp-test-2026-10-08_18-33-08/gpt-5.4-mini/32-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 5.9 | 0.0 | 5.8 | 5.7k | 392 | 329 | 42.4k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | create-or-replace-groups | 114.8 | 2.1 | 112.6 | 48.5k | 14040 | 13797 | 6.6k | getExternalObjectPlanContext ×4 0.0 s, getExternalObjectGroups ×7 0.3 s, loadExternalObjectGroupLayout ×2 1.0 s |
| 3 | 1 | change-group-attribute | 11.5 | 0.9 | 10.6 | 69.2k | 1043 | 867 | 1.5k | getExternalObjectPlanContext ×2 0.0 s, getExternalObjectGroups ×2 0.0 s, externalObjectGroupOperation ×1 0.4 s |
| 4 | 1 | get-plan-images | 3.9 | 0.6 | 3.3 | 71.7k | 73 | 56 | 1.5k | getExternalObjectSnapshot ×1 0.5 s |
| 5 | 1 | — (stop) | 24.9 | 0.0 | 24.9 | 73.3k | 2327 | 2199 | – |  |

## 8 gpt-5.4-mini — image-only-no-text

`.temp/result/mcp-test-2026-10-08_18-33-08/gpt-5.4-mini/34-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-plan-context | 5.8 | 0.0 | 5.7 | 6.0k | 317 | 288 | 27.8k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | get-authoring-rules | 7.1 | 0.0 | 7.1 | 34.1k | 427 | 408 | 4.4k |  |
| 3 | 1 | find-attributes | 44.7 | 0.0 | 44.7 | 39.0k | 4178 | 4156 | 1.0k | getExternalObjectPlanContext ×1 0.0 s |
| 4 | 1 | find-attributes | 3.1 | 0.0 | 3.1 | 44.2k | 43 | 19 | 0.7k | getExternalObjectPlanContext ×1 0.0 s |
| 5 | 1 | find-attributes | 4.1 | 0.0 | 4.0 | 44.9k | 49 | 26 | 0.8k | getExternalObjectPlanContext ×1 0.0 s |
| 6 | 1 | find-attributes | 6.5 | 0.0 | 6.4 | 45.8k | 48 | 26 | 0.3k | getExternalObjectPlanContext ×1 0.0 s |
| 7 | 1 | find-attributes | 3.6 | 0.0 | 3.6 | 46.1k | 37 | 15 | 0.3k | getExternalObjectPlanContext ×1 0.0 s |
| 8 | 1 | find-attributes | 38.1 | 0.0 | 38.1 | 46.4k | 4335 | 4314 | 0.3k | getExternalObjectPlanContext ×1 0.0 s |
| 9 | 1 | create-or-replace-groups | 63.2 | 3.0 | 60.2 | 51.1k | 6517 | 6113 | 7.9k | getExternalObjectPlanContext ×6 0.1 s, getExternalObjectGroups ×7 0.2 s, loadExternalObjectGroupLayout ×2 1.0 s, externalObjectGroupOperation ×2 0.4 s |
| 10 | 1 | get-plan-images | 4.6 | 0.6 | 4.0 | 65.5k | 187 | 170 | 1.5k | getExternalObjectSnapshot ×1 0.5 s |
| 11 | 1 | merge-article-into-group | 16.8 | 0.6 | 16.2 | 67.2k | 1590 | 1489 | 2.6k | getExternalObjectPlanContext ×1 0.0 s, getExternalObjectGroups ×4 0.1 s, externalObjectGroupOperation ×1 0.2 s |
| 12 | 1 | get-plan-images | 5.3 | 0.5 | 4.8 | 71.4k | 49 | 32 | 1.6k | getExternalObjectSnapshot ×1 0.4 s |
| 13 | 1 | — (stop) | 13.7 | 0.0 | 13.7 | 73.1k | 1114 | 990 | – |  |

## 9 gpt-6-astra — image-kitchen-left-wall

`.temp/result/mcp-test-2026-10-08_18-33-08/gpt-6-astra/30-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context, find-attributes | 3.8 | 0.0 | 3.8 | 7.4k | 61 | 0 | 34.5k | getExternalObjectPlanContext ×2 0.0 s |
| 2 | 1 | find-attributes, find-attributes, find-attributes | 3.7 | 0.0 | 3.6 | 41.9k | 66 | 0 | 2.0k | getExternalObjectPlanContext ×3 0.0 s |
| 3 | 1 | create-or-replace-groups | 14.0 | 2.2 | 11.8 | 44.0k | 571 | 100 | 6.4k | getExternalObjectPlanContext ×6 0.1 s, getExternalObjectGroups ×7 0.1 s, loadExternalObjectGroupLayout ×2 0.7 s, externalObjectGroupOperation ×1 0.2 s |
| 4 | 1 | get-plan-context, find-attributes, find-attributes | 4.1 | 0.0 | 4.1 | 51.0k | 88 | 19 | 1.7k | getExternalObjectPlanContext ×3 0.0 s |
| 5 | 1 | find-attributes | 4.8 | 0.0 | 4.8 | 52.8k | 39 | 18 | 0.4k | getExternalObjectPlanContext ×1 0.0 s |
| 6 | 1 | get-plan-images | 5.8 | 0.6 | 5.2 | 53.2k | 85 | 68 | 2.4k | getExternalObjectSnapshot ×1 0.6 s |
| 7 | 1 | swap-root-modules | 9.9 | 0.8 | 9.1 | 55.7k | 129 | 27 | 5.7k | getExternalObjectPlanContext ×1 0.0 s, getExternalObjectGroups ×5 0.1 s, externalObjectGroupOperation ×1 0.4 s |
| 8 | 1 | — (stop) | 8.4 | 0.0 | 8.4 | 61.6k | 98 | 0 | – |  |

## 10 gpt-6-astra — image-planning-right-wall

`.temp/result/mcp-test-2026-10-08_18-33-08/gpt-6-astra/31-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context, find-attributes | 4.4 | 0.0 | 4.3 | 7.2k | 61 | 0 | 34.5k | getExternalObjectPlanContext ×2 0.0 s |
| 2 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 8.7 | 0.0 | 8.7 | 41.8k | 273 | 150 | 1.7k | getExternalObjectPlanContext ×4 0.0 s |
| 3 | 1 | create-or-replace-groups | 22.2 | 4.2 | 18.0 | 43.8k | 1136 | 265 | 16.2k | getExternalObjectPlanContext ×6 0.6 s, getExternalObjectGroups ×10 0.2 s, loadExternalObjectGroupLayout ×3 1.4 s, undo ×1 0.0 s, externalObjectGroupOperation ×2 0.7 s |
| 4 | 1 | — (stop) | 7.1 | 0.0 | 7.1 | 61.1k | 161 | 60 | – |  |

## 11 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/mcp-test-2026-10-08_18-33-08/gpt-6-astra/32-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context, find-attributes | 3.2 | 0.0 | 3.2 | 5.8k | 61 | 0 | 34.5k | getExternalObjectPlanContext ×2 0.0 s |
| 2 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 3.4 | 0.0 | 3.4 | 40.3k | 81 | 0 | 1.9k | getExternalObjectPlanContext ×4 0.0 s |
| 3 | 1 | create-or-replace-groups | 18.3 | 3.2 | 15.1 | 42.4k | 709 | 215 | 8.2k | getExternalObjectPlanContext ×6 0.3 s, getExternalObjectGroups ×7 0.5 s, loadExternalObjectGroupLayout ×2 1.0 s, externalObjectGroupOperation ×1 0.1 s |
| 4 | 1 | — (stop) | 17.1 | 0.0 | 17.1 | 51.3k | 141 | 52 | – |  |

## 12 gpt-6-astra — image-only-no-text

`.temp/result/mcp-test-2026-10-08_18-33-08/gpt-6-astra/34-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 3.8 | 0.0 | 3.8 | 6.3k | 47 | 0 | 32.2k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 6.3 | 0.0 | 6.3 | 38.6k | 156 | 9 | 3.4k | getExternalObjectPlanContext ×4 0.0 s |
| 3 | 1 | find-attributes, find-attributes, find-attributes | 4.3 | 0.0 | 4.3 | 42.2k | 86 | 17 | 1.6k | getExternalObjectPlanContext ×3 0.0 s |
| 4 | 1 | create-or-replace-groups | 22.8 | 3.6 | 19.1 | 43.8k | 1029 | 352 | 10.6k | getExternalObjectPlanContext ×6 0.2 s, getExternalObjectGroups ×7 0.1 s, loadExternalObjectGroupLayout ×2 1.1 s, externalObjectGroupOperation ×2 0.6 s |
| 5 | 1 | place-group | 7.9 | 0.9 | 7.0 | 55.5k | 151 | 113 | 5.9k | getExternalObjectPlanContext ×2 0.0 s, getExternalObjectGroups ×5 0.1 s, loadExternalObjectGroupLayout ×1 0.4 s |
| 6 | 1 | — (stop) | 7.1 | 0.0 | 7.1 | 61.6k | 105 | 0 | – |  |

## 13 gpt-6-astra — image-kitchen-left-wall

`.temp/result/mcp-test-2026-10-11_11-41-48/gpt-6-astra/45-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context, find-attributes | 4.5 | 0.0 | 4.5 | 7.5k | 75 | 0 | 57.6k | getExternalObjectPlanContext ×2 0.0 s |
| 2 | 1 | find-attributes, find-attributes, find-attributes | 22.6 | 0.0 | 22.6 | 65.2k | 66 | 0 | 2.0k | getExternalObjectPlanContext ×3 0.0 s |
| 3 | 1 | create-or-replace-groups | 14.3 | 4.2 | 10.0 | 67.2k | 514 | 56 | 6.4k | getExternalObjectPlanContext ×6 0.0 s, getExternalObjectGroups ×6 0.4 s, loadExternalObjectGroupLayout ×2 1.0 s, externalObjectGroupOperation ×1 0.5 s |
| 4 | 1 | — (stop) | 6.7 | 0.0 | 6.7 | 74.1k | 99 | 0 | – |  |

## 14 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/mcp-test-2026-10-11_11-41-48/gpt-6-astra/46-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context, find-attributes | 4.6 | 0.0 | 4.6 | 5.9k | 75 | 0 | 57.6k | getExternalObjectPlanContext ×2 0.0 s |
| 2 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 7.4 | 0.0 | 7.4 | 63.6k | 161 | 15 | 1.9k | getExternalObjectPlanContext ×4 0.0 s |
| 3 | 1 | create-or-replace-groups | 19.3 | 5.1 | 14.3 | 65.6k | 604 | 249 | 7.1k | getExternalObjectPlanContext ×6 0.0 s, getExternalObjectGroups ×6 0.2 s, loadExternalObjectGroupLayout ×2 1.6 s, externalObjectGroupOperation ×1 0.7 s |
| 4 | 1 | get-plan-context | 5.2 | 0.0 | 5.1 | 73.3k | 60 | 37 | 1.0k | getExternalObjectPlanContext ×1 0.0 s |
| 5 | 1 | — (stop) | 4.9 | 0.0 | 4.9 | 74.4k | 112 | 0 | – |  |

## 15 gpt-6-astra — image-planning-right-wall

`.temp/result/mcp-test-2026-10-11_11-41-48/gpt-6-astra/47-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 4.7 | 0.0 | 4.6 | 7.3k | 61 | 0 | 55.3k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | find-attributes | 5.2 | 0.0 | 5.2 | 62.7k | 21 | 0 | 0.0k | getExternalObjectPlanContext ×1 0.0 s |
| 3 | 1 | find-attributes, find-attributes, find-attributes | 6.1 | 0.0 | 6.1 | 62.7k | 66 | 0 | 3.4k | getExternalObjectPlanContext ×3 0.0 s |
| 4 | 1 | find-attributes | 16.5 | 0.0 | 16.5 | 66.2k | 513 | 439 | 0.6k | getExternalObjectPlanContext ×1 0.0 s |
| 5 | 1 | create-or-replace-groups | 28.6 | 9.1 | 19.5 | 67.3k | 1086 | 130 | 21.7k | getExternalObjectPlanContext ×6 0.6 s, getExternalObjectGroups ×9 0.3 s, loadExternalObjectGroupLayout ×3 2.4 s, undo ×1 0.0 s, externalObjectGroupOperation ×2 1.4 s |
| 6 | 1 | undo | 10.2 | 2.1 | 8.1 | 90.1k | 123 | 108 | 19.2k | getExternalObjectPlanContext ×1 0.0 s, getExternalObjectGroups ×1 0.0 s |
| 7 | 1 | undo | 7.7 | 2.1 | 5.7 | 109.4k | 21 | 6 | 19.2k | getExternalObjectPlanContext ×1 0.0 s, getExternalObjectGroups ×1 0.0 s |
| 8 | 1 | create-or-replace-groups | 22.9 | 3.8 | 19.1 | 128.6k | 1329 | 15 | 14.1k | getExternalObjectPlanContext ×4 0.1 s, getExternalObjectGroups ×5 0.1 s, loadExternalObjectGroupLayout ×1 0.7 s, externalObjectGroupOperation ×1 0.8 s |
| 9 | 1 | get-plan-images | 6.8 | 0.6 | 6.1 | 144.0k | 31 | 14 | 2.4k | getExternalObjectSnapshot ×1 0.6 s |
| 10 | 1 | — (stop) | 13.2 | 0.0 | 13.2 | 146.5k | 111 | 0 | – |  |

## 16 gpt-6-astra — image-only-no-text

`.temp/result/mcp-test-2026-10-11_11-41-48/gpt-6-astra/48-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context, find-attributes | 4.7 | 0.0 | 4.6 | 6.4k | 75 | 0 | 57.6k | getExternalObjectPlanContext ×2 0.0 s |
| 2 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 12.8 | 0.0 | 12.8 | 64.1k | 346 | 205 | 2.0k | getExternalObjectPlanContext ×4 0.0 s |
| 3 | 1 | create-or-replace-groups | 21.3 | 7.9 | 13.4 | 66.4k | 644 | 98 | 8.9k | getExternalObjectPlanContext ×6 0.1 s, getExternalObjectGroups ×6 0.3 s, loadExternalObjectGroupLayout ×2 2.1 s, externalObjectGroupOperation ×2 0.9 s |
| 4 | 1 | place-group | 8.1 | 0.9 | 7.3 | 76.0k | 131 | 73 | 5.9k | getExternalObjectPlanContext ×2 0.0 s, getExternalObjectGroups ×6 0.1 s, loadExternalObjectGroupLayout ×1 0.7 s |
| 5 | 1 | — (stop) | 6.2 | 0.0 | 6.2 | 82.1k | 130 | 0 | – |  |

## 17 Mistral-Large-3 — image-kitchen-left-wall

`.temp/result/mcp-test-2026-10-12_10-23-42/Mistral-Large-3/45-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 2.1 | 0.0 | 2.1 | 9.5k | 33 | 0 | 40.3k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | create-or-replace-groups | 11.4 | 1.7 | 9.7 | 49.8k | 376 | 0 | 7.1k | getExternalObjectPlanContext ×5 0.0 s, getExternalObjectGroups ×6 0.3 s, loadExternalObjectGroupLayout ×2 1.3 s |
| 3 | 1 | — (stop) | 6.7 | 0.0 | 6.7 | 57.3k | 340 | 0 | – |  |

## 18 Mistral-Large-3 — image-kitchen-back-right-corner

`.temp/result/mcp-test-2026-10-12_10-23-42/Mistral-Large-3/46-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 1.7 | 0.0 | 1.7 | 7.9k | 33 | 0 | 40.3k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | create-or-replace-groups | 12.1 | 3.0 | 9.2 | 48.2k | 621 | 0 | 10.9k | getExternalObjectPlanContext ×5 0.0 s, getExternalObjectGroups ×6 0.1 s, loadExternalObjectGroupLayout ×2 2.7 s |
| 3 | 1 | — (stop) | 10.1 | 0.0 | 10.1 | 59.7k | 208 | 0 | – |  |

## 19 Mistral-Large-3 — image-planning-right-wall

`.temp/result/mcp-test-2026-10-12_10-23-42/Mistral-Large-3/47-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 2.3 | 0.0 | 2.3 | 9.3k | 33 | 0 | 40.3k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | create-or-replace-groups | 17.0 | 8.0 | 9.0 | 49.7k | 538 | 0 | 11.6k | getExternalObjectPlanContext ×6 0.1 s, getExternalObjectGroups ×6 0.2 s, loadExternalObjectGroupLayout ×2 3.5 s, externalObjectGroupOperation ×1 2.0 s |
| 3 | 1 | — (stop) | 11.8 | 0.0 | 11.8 | 61.8k | 235 | 0 | – |  |

## 20 Mistral-Large-3 — image-only-no-text

`.temp/result/mcp-test-2026-10-12_10-23-42/Mistral-Large-3/48-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 2.0 | 0.0 | 2.0 | 8.4k | 33 | 0 | 40.3k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | create-or-replace-groups, create-or-replace-groups, create-or-replace-groups | 29.7 | 16.2 | 13.5 | 48.8k | 699 | 0 | 16.0k | getExternalObjectPlanContext ×13 2.0 s, getExternalObjectGroups ×18 4.9 s, loadExternalObjectGroupLayout ×6 7.2 s |
| 3 | 1 | place-group | 19.2 | 6.0 | 13.2 | 65.5k | 562 | 0 | 10.3k | getExternalObjectPlanContext ×2 0.1 s, getExternalObjectGroups ×6 1.0 s, loadExternalObjectGroupLayout ×1 4.3 s |
| 4 | 1 | — (stop) | 13.5 | 0.0 | 13.5 | 76.3k | 447 | 0 | – |  |

## 21 gpt-6-astra — image-kitchen-left-wall

`.temp/result/mcp-test-2026-10-13_17-19-39/gpt-6-astra/45-image-kitchen-left-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context, find-attributes | 5.3 | 0.0 | 5.2 | 7.5k | 61 | 0 | 37.5k | getExternalObjectPlanContext ×2 0.0 s |
| 2 | 1 | find-attributes, find-attributes, find-attributes | 5.2 | 0.0 | 5.2 | 45.0k | 78 | 10 | 2.0k | getExternalObjectPlanContext ×3 0.0 s |
| 3 | 1 | create-or-replace-groups | 13.8 | 3.7 | 10.1 | 47.1k | 529 | 66 | 6.5k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.7 s |
| 4 | 1 | — (stop) | 10.8 | 0.0 | 10.8 | 54.1k | 89 | 0 | – |  |

## 22 gpt-6-astra — image-kitchen-back-right-corner

`.temp/result/mcp-test-2026-10-13_17-19-39/gpt-6-astra/46-image-kitchen-back-right-corner`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context, find-attributes | 5.4 | 0.0 | 5.4 | 5.9k | 75 | 0 | 59.6k | getExternalObjectPlanContext ×2 0.0 s |
| 2 | 1 | find-attributes, find-attributes, find-attributes | 6.1 | 0.0 | 6.0 | 65.6k | 140 | 11 | 1.5k | getExternalObjectPlanContext ×3 0.0 s |
| 3 | 1 | create-or-replace-groups | 18.2 | 4.7 | 13.5 | 67.3k | 616 | 229 | 8.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 2.6 s |
| 4 | 1 | change-module-attribute | 11.0 | 2.6 | 8.4 | 75.9k | 167 | 108 | 0.2k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.6 s |
| 5 | 1 | change-module-attribute | 8.0 | 3.0 | 5.0 | 76.3k | 71 | 16 | 0.1k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 0.9 s |
| 6 | 1 | get-plan-context | 4.3 | 0.0 | 4.2 | 76.4k | 23 | 0 | 8.7k | getExternalObjectPlanContext ×1 0.0 s |
| 7 | 1 | — (stop) | 6.2 | 0.0 | 6.2 | 85.2k | 127 | 0 | – |  |

## 23 gpt-6-astra — image-planning-right-wall

`.temp/result/mcp-test-2026-10-13_17-19-39/gpt-6-astra/47-image-planning-right-wall`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 4.1 | 0.0 | 4.1 | 7.3k | 47 | 0 | 35.2k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 5.9 | 0.0 | 5.8 | 42.6k | 82 | 0 | 4.1k | getExternalObjectPlanContext ×4 0.0 s |
| 3 | 1 | find-attributes, find-attributes, find-attributes | 18.5 | 0.0 | 18.4 | 46.8k | 579 | 453 | 1.4k | getExternalObjectPlanContext ×3 0.0 s |
| 4 | 1 | create-or-replace-groups | 18.6 | 6.0 | 12.5 | 48.7k | 973 | 0 | 22.9k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 4.0 s |
| 5 | 1 | create-or-replace-groups | 22.7 | 3.7 | 18.9 | 72.6k | 1329 | 58 | 14.3k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 1.7 s |
| 6 | 1 | get-plan-images | 8.3 | 0.6 | 7.8 | 88.3k | 33 | 16 | 2.4k | getExternalObjectSnapshot ×1 0.6 s |
| 7 | 1 | — (stop) | 8.9 | 0.0 | 8.9 | 90.7k | 131 | 0 | – |  |

## 24 gpt-6-astra — image-only-no-text

`.temp/result/mcp-test-2026-10-13_17-19-39/gpt-6-astra/48-image-only-no-text`

| Step | Turn | Tools | Step s | Tools s | Model s | Input | Output | Reasoning | Result tokens | Planner calls |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | get-authoring-rules, get-plan-context | 4.3 | 0.0 | 4.2 | 6.4k | 47 | 0 | 35.2k | getExternalObjectPlanContext ×1 0.0 s |
| 2 | 1 | find-attributes, find-attributes, find-attributes, find-attributes | 9.3 | 0.0 | 9.2 | 41.7k | 215 | 74 | 4.0k | getExternalObjectPlanContext ×4 0.0 s |
| 3 | 1 | find-attributes | 3.7 | 0.0 | 3.7 | 45.9k | 31 | 10 | 0.3k | getExternalObjectPlanContext ×1 0.0 s |
| 4 | 1 | create-or-replace-groups | 16.9 | 3.1 | 13.8 | 46.2k | 761 | 214 | 9.1k | getExternalObjectPlanContext ×2 0.1 s, externalObjectGroupOperation ×1 3.0 s |
| 5 | 1 | place-group | 8.3 | 1.5 | 6.8 | 56.1k | 142 | 104 | 5.9k | getExternalObjectPlanContext ×2 0.0 s, externalObjectGroupOperation ×1 1.4 s |
| 6 | 1 | — (stop) | 7.3 | 0.0 | 7.3 | 62.2k | 123 | 0 | – |  |
