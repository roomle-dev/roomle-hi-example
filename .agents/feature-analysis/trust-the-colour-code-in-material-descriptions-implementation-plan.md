# RML-18063: implementation plan — trust the colour code in material descriptions

> **Type**: Implementation plan (step 4 of the [change workflow](../../AGENTS.md#suggested-change-workflow))
> **Analysis**: [trust-the-colour-code-in-material-descriptions.md](trust-the-colour-code-in-material-descriptions.md) — the library data, the served rule and the tooling this plan rests on
> **Date**: 2026-10-07
> **Author**: AI Assistant
> **Status**: Steps 1 to 4 done (2026-10-07), step 5 waits for a yes — see the [close-out of the analysis](trust-the-colour-code-in-material-descriptions.md#close-out)
> **Branch**: `feat/trust-colour-code-in-material-desc-RML-18063` (roomle-hi-example only)

---

## Decisions for the review

| # | Question | Recommendation | The plan below assumes |
|---|---|---|---|
| 1 | A new decision D53, or D8 extended | D53: today's decisions are numbered on (D51, D52), and D8's date, source and test reference stay true as they are | D53 |
| 2 | A prompt test that shows the agent choosing by the code | Yes, as step 5 — it is the only check of the acceptance criterion "the agent takes the colour from the desc"; the unit test guards the text only | step 5 is done only after a yes |

## Step 1 — the served text and its unit test

Test first: the new test fails on the current text, then the text changes.

### `hi-mcp/hi-mcp-server/tests/hi-mcp-server.test.ts`

A new test right after `it('limits the desc-over-image rule to the catalog images')` (line 382),
with the helpers of that file (`connectClient`, `createMockPlannerApi`, `textOf`):

```ts
it('tells the agent that a colour code in a desc is the colour of the value', async () => {
  const client = await connectClient(createMockPlannerApi());
  const rules = textOf(
    await client.callTool({ name: 'get-authoring-rules', arguments: {} })
  );
  const { tools } = await client.listTools();
  const descriptionOf = (name: string) =>
    tools.find((tool) => tool.name === name)?.description;

  expect(rules).toContain(
    'A colour code in the desc of an attribute value - Cloudy blue (#506080) - is the colour of that value'
  );
  expect(rules).toContain('not by the name');
  expect(rules).toContain('or the colour of a value, from a catalog image');
  expect(descriptionOf('get-plan-context')).toContain(
    'a colour code in the desc of an attribute value (#rrggbb) is the colour of that value'
  );
  expect(descriptionOf('find-attributes')).toContain(
    'pick a dark, a light or a blue value by its code'
  );
});
```

The two existing tests stay unchanged and keep passing: the rule keeps `Every desc`,
`is authoritative` and `authoritative over the catalog images of the master data (imageUrl)`, the
description of `get-plan-context` keeps `trust them over the catalog images (imageUrl)`, and no text
says `any image` or `any other picture`. The new text adds no "kitchen" (the test at line 466
allows at most seven).

### `hi-mcp/hi-mcp-server/hi-mcp-server.ts`

**The rule, line 9** — one sentence added, the next one widened to the colour:

Old:

```text
- Every desc - of an article, a root, a module, an attribute and an attribute value - is authoritative: trust it for what that article, module or value is, and trust dimensions for how big an article is. Both are authoritative over the catalog images of the master data (imageUrl): never take the kind or the size of an article from a catalog image. A desc says what an article is, not where the user may put it.
```

New:

```text
- Every desc - of an article, a root, a module, an attribute and an attribute value - is authoritative: trust it for what that article, module or value is, and trust dimensions for how big an article is. A colour code in the desc of an attribute value - Cloudy blue (#506080) - is the colour of that value: take it as it is, and tell light from dark and one hue from another by it, not by the name. All of them are authoritative over the catalog images of the master data (imageUrl): never take the kind or the size of an article, or the colour of a value, from a catalog image. A desc says what an article is, not where the user may put it.
```

**`get-plan-context`, lines 175–176** — the sentence on trusted descs gets the code:

```ts
'explicitly; the same compacted attribute vocabulary is searched by find-attributes. Every desc is ' +
'authoritative and dimensions give the size - trust them over the catalog images (imageUrl); a colour ' +
'code in the desc of an attribute value (#rrggbb) is the colour of that value. Use it before ' +
'authoring or modifying groups.',
```

**`find-attributes`, lines 196–200** — one sentence at the end:

```ts
'of get-plan-context (root modules and their customer-facing attributes). Use it to find the attribute ' +
'for a requested property, e.g. the front colour, and the value to set. The desc of a value carries ' +
'its colour code where the library gives one - Cloudy blue (#506080) -, the colour of that value: ' +
'pick a dark, a light or a blue value by its code.',
```

No executor changes: the desc reaches the agent as the library delivers it (analysis 2.1).

Verify: `npm test` and `npm run typecheck` at the `hi-mcp` root — the new test fails before the
text change and passes after it, every other test passes.

## Step 2 — the colour script, the materials skill and `materials.md`

### `.agents/scripts/extract-dominant-color-from-image.js`

| Where | Change |
|---|---|
| new `colorCodeOf(desc)` | the first `#rrggbb` of the desc, upper-cased, else `null` — the regular expression `generateMarkdown` uses today, now defined once; exported beside the others |
| `extractAllColors` | per value: a desc with a code gives the colour, nothing is downloaded, the progress line reads `Cloudy blue: #506080 (from desc)`; only a value without a code is downloaded and analysed with Sharp as today |
| `generateMarkdown` | `hasColorCode` becomes `colorCodeOf(desc)`; the "Color Extraction" section of the header template is rewritten (below) |
| `--list-colors` | the heading reads "Material Colors (from the desc, else from the thumbnail)" |
| the file's header comment | one line: `--all` takes the colour from the desc of a value and analyses the thumbnail only for a value without a code |

The single-URL and `--verify` modes stay: they analyse an image given by hand.

The new "Color Extraction" section of the generated `materials.md`:

```markdown
## Color Extraction

The "Suggested Color" column is the color code of the description where the description carries one
(`#RRGGBB`, e.g. `Cloudy blue (#506080)`): the library states the color of the value, and the code is
taken as it is. Only a material whose description has no code gets a color calculated from the
pixels of its thumbnail:

1. Downloading the thumbnail image from the URL
2. Resizing to 100x100px (maintains color distribution)
3. Sampling pixels across the image
4. Quantizing colors by grouping similar RGB values
5. Finding the most frequent color

The calculation uses Node.js with the Sharp library. With the library data of 2026-10-07 every
material in this table carries its code, so no thumbnail is analysed.
```

### `.agents/skills/hi-furniture-smith-materials.md`

| Section | Change |
|---|---|
| Overview | the color code comes from the description; only a material without a code is calculated from the pixels of its thumbnail. The "IMPORTANT" line says the same |
| Data Flow | "Take the color code of the description" before "Download thumbnail images", which applies only to materials without a code |
| Step 3 | "Download all 21 thumbnail images" and the timing line become: take the code of every description that carries one, download and analyse only the thumbnails of materials without one — none with today's data |
| Color Extraction Algorithm | the order: the description's code first, the Sharp algorithm for a material without one. "Why Accuracy Matters" stays: it shows why a name is no source of a color |
| Calculated Colors and Current Materials | both 21-row tables go — `materials.md` lists 48 materials since the refresh — and a pointer to `materials.md` replaces them |
| Materials Table Structure, column 5 | Source: the description's code, else calculated from the thumbnail's pixels |

### `docs/library-information/materials.md`

Regenerated from the repository root:

```bash
node .agents/scripts/extract-dominant-color-from-image.js --all
```

Verify: the run prints `(from desc)` for all 48 materials and downloads nothing; `git diff` of
`materials.md` shows only the "Color Extraction" section — the table and the expiry date of the
signatures stay byte for byte, because every code equals the color calculated before (analysis
2.2). Checked while planning: `generateMarkdown` of today's script, fed with the codes of the descs
instead of downloaded colors, reproduces today's `materials.md` byte for byte — 48 materials, none
without a code.

## Step 3 — the documentation

| File | Change |
|---|---|
| `docs/hi-mcp-behaviour.md` §3, "Information for the agent" | a row **D53** after D8: *A `#rrggbb` code in the desc of an attribute value is the colour of that value, taken as it is; the agent tells light from dark and one hue from another by it, not by the name. The rule, `get-plan-context` and `find-attributes` say so. The agent never sees a thumbnail (D7); the library tooling takes the code from the desc and analyses a thumbnail only for a value without one* — 2026-10-07, [RML-18063](https://roomle.atlassian.net/browse/RML-18063), in effect — rules `hi-mcp-server.ts:9`, guarded by `it('tells the agent that a colour code in a desc is the colour of the value')` |
| `docs/hi-mcp-behaviour.md` §5.2 | **Trusted descriptions** (D8, D53) — a colour code in the desc of a value is its colour; a desc says what an article is, not where the user may put it |
| `docs/hi-mcp-behaviour.md` §5.4, row `masterData` | `selections` with value, name and desc — the desc of a colour value ends with its code, e.g. `Cloudy blue (#506080)` (D53) |
| `docs/hi-mcp-behaviour.md` §6, `find-attributes` | one sentence: the desc of a colour value carries its code, and the description tells the agent to choose by it (D53) |
| `docs/hi-mcp-server.md`, bullet "Every `desc` is authoritative" | a colour code in the desc of an attribute value — `Cloudy blue (#506080)` — is the colour of that value; the agent takes it as it is and chooses light, dark or a hue by it, not by the name |
| `docs/hi-mcp-server.md`, `find-attributes` | the desc of a colour value carries its code, the colour of that value |
| `.agents/skills/hi-mcp-tools.md`, "Trusted descriptions" and `find-attributes` | the same two sentences; "It is in `get-authoring-rules` and in the description of `get-plan-context`" also names `find-attributes` |

§8 stays as it is: no guard, no correction, no feedback message.

## Step 4 — verification and close-out

```bash
cd hi-mcp && npm test && npm run typecheck
cd .. && npm run lint && npm run format:check
node .agents/scripts/check-markdown-links.js <every changed .md>
```

Then the analysis gets the status `Implemented (not merged)` with a short close-out section, this
plan the status of its steps, and both index lines in `.agents/README.md` and
`.agents/feature-analysis/README.md` follow. The results go onto the ticket as a comment.

## Step 5 — a prompt test (only after a yes on decision 2)

A test in `docs/test-prompts.json` where the names mislead and the codes decide:

```json
{
  "id": "edit-darkest-wood-fronts",
  "title": "Choose a front colour by its code",
  "plan": "three-tall-units",
  "prompt": "make the fronts of the three tall units the darkest wood",
  "expect": "change-group-attribute: mod_FrontColor 229 (Dark oak, #101010) on every unit - by its code the darkest wood, darker than Dark walnut (#906040), Tiepolo walnut (#705040) and Oak (#704020)"
}
```

Why this prompt: "Dark walnut" and "Dark oak" both carry "dark" in the name, and walnut is the
darker wood in common knowledge, so an agent choosing by the name tends to Dark walnut; by the code
Dark oak is nearly black.

Its run, after a go on time and cost: two runs on `master` (old, from a worktree of `master` — the
runner starts the launcher of the working tree it lives in) and two on the branch (new) with
gpt-5.4-mini, the weakest planner of the three deployments in the RML-18043 runs, about 10 minutes
in all:

```bash
node .agents/scripts/run-hi-mcp-prompt.js gpt-5.4-mini "$AZURE_GPT_KEY" "make the fronts of the three tall units the darkest wood" --plan ps_qply732i7knwtkfjm1z86sa8vrt00ms
```

New passes when both runs set 229. If old already sets 229 in both runs, the test shows no
difference, and its result goes into the report as such.

## Commits

About three on the branch, none pushed before the review:

1. `docs: analyse trusting the colour code in material descriptions` — on the branch already
   (`3003c00`); this plan belongs with it and stays uncommitted until it is folded in.
2. `feat: trust the colour code in the desc of a material value` — steps 1 to 4: the served text
   and its test, the script, the skill, `materials.md`, the documentation, the close-out.
3. `test: add a test prompt that chooses a front colour by its code` — step 5, only after a yes.
