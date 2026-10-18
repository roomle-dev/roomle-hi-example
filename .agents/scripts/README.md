# Scripts

Agent utility scripts for automating repository tasks: link checking, test running, data fetching, report generation, benchmark execution.

## Guidelines

- Scripts are written in the repository's primary scripting language (JavaScript/Node.js).
- Each script does one thing and does it well.
- Scripts are referenced from skills and `AGENTS.md` so the agent knows they exist and when to run them.
- Naming: kebab-case, descriptive verbs (`check-markdown-links.js`, `run-hi-mcp-tests.js`).
- No production code here. No one-off throwaway scripts (those go in `.temp/`).

## Current Scripts

| Script | Description |
|---|---|
| [`run-hi-mcp-prompt.js`](run-hi-mcp-prompt.js) | Run a single prompt through the chat with a real model and planner |
| [`run-hi-mcp-tests.js`](run-hi-mcp-tests.js) | Run the tests of `docs/test-prompts.json` and write an evaluated report |
| [`update-planning-results.js`](update-planning-results.js) | Regenerate `docs/planning-results.md` from kitchen images |
| [`benchmark-hi-mcp-runs.js`](benchmark-hi-mcp-runs.js) | Benchmark test runs: per-step timing, token counts, model and tool time |
| [`check-markdown-links.js`](check-markdown-links.js) | Check markdown links across the repository |
| [`build-test-report.js`](build-test-report.js) | Build the test report from run results |
| [`extract-dominant-color-from-image.js`](extract-dominant-color-from-image.js) | Extract the dominant color from an image |
| [`extract-run-facts.js`](extract-run-facts.js) | Extract facts from a test run |
| [`fetch-hi-library-data.js`](fetch-hi-library-data.js) | Fetch HI library data (articles, attributes, materials) |
| [`generate-article-catalog.js`](generate-article-catalog.js) | Generate the article catalog |
| [`generate-attributes-table.js`](generate-attributes-table.js) | Generate the attributes table |
| [`mcp-test-navigation.js`](mcp-test-navigation.js) | Navigate the MCP test infrastructure |
| [`render-report-pdf.js`](render-report-pdf.js) | Render a report to PDF |
