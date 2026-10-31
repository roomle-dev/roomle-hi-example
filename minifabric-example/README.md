# Quickstart — HI Minifabric Example (TypeScript)

The HI planner with the library `nobilia_Minifabrik` through Roomle's demo proxy, a settings panel
for the testing credentials, the AI kitchen generation and the AI Planning Assistant. How it is
built: [.agents/context/minifabric-example.md](../.agents/context/minifabric-example.md).

**1. Once:** install Node 22.12+ and run `npm install` in the repository root.

**2. Start it** — the Vite dev server serves the page on :3400 and opens the browser:

```bash
npm run start:minifabric   # in the repository root; or `npm run dev` in minifabric-example/
```

**3. Plan.** The planner opens with the default plan and the nobilia library. The settings panel on
the left takes your own API key, library ID, subscription ID and endpoint URL instead of the demo
proxy's placeholder credentials, the locale and the parameter level; **Reload** stores them in the
browser and reloads the page. **Actions:** Send to OM, Calc Price, Load layout (an article layout
JSON file), Generate with AI. The AI chat opens with the button at the bottom of the planner.

URL parameters: `locale` (or `language`), `apiKey`, `libraryId` (or `library_id`),
`subscriptionId`, `endpointUrl`, `user_right` (`Simple`, `Advanced`, `Master`), `plan_id`,
`server_url` (the planner's server, `https://www.roomle.com/t/bo-test/` by default) and
`debug=true`.

The demo proxy itself is in [`proxy-server/`](./proxy-server/README.md).
