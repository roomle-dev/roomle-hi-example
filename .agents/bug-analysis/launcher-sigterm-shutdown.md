# Stop the example servers when the launcher receives SIGTERM

> **Status:** Fixed locally — SIGTERM and SIGINT release the page, MCP and chat ports
> **Date:** 2026-10-09
> **Former backlog item:** Deployment and session issues, item 6

## Affected repositories

- **roomle-hi-example:** launch the MCP and chat server processes directly, cover signal shutdown with a process-level regression test, update the launcher reference and remove the verified backlog item.

## Symptom and root cause

At baseline `49e4ebd`, `minimal-hi-example/start.mjs:181-237` spawned npm workspace commands
for MCP and chat. Those commands started `vite-node` descendants. `shutdown` at lines 274-281
sent SIGTERM to the npm children, then exited. npm forwarded it to its immediate shell child,
but reaching the actual server depended on that shell's process handling. On Linux the static
server stopped while server descendants continued holding ports.
Terminal Ctrl+C reached the process group, hiding the defect during ordinary interactive use.
The MCP server's stdin guard did not help with inherited terminal or `/dev/null` stdin; chat
had no such guard.

The process-level SIGTERM regression passed on macOS with Node 23.5.0/npm 11.16.0, but failed
on Linux with Node 22/npm 10.9.9. On Linux all three endpoints became ready and the launcher
exited with code 0, but its server ports were still occupied 15 seconds later. The test's
process-group cleanup removed the remaining processes. This establishes the platform-dependent
wrapper failure rather than assuming npm always loses the signal.

## Plan and assumptions

The workspace start scripts each ran one vite-node entry point, with no prestart/poststart hooks.
The chosen fix kept those scripts for standalone use and made the launcher resolve the installed
vite-node CLI from each workspace after the existing build gate, spawning it with
`process.execPath`, the workspace's working directory and its existing environment. This made
`child.kill()` address the server itself. Provider/key forwarding, ports, origins, browser
handling and Cloudflare mode kept their existing meanings.

Direct Node launch is smaller and portable compared with detached POSIX process groups plus
separate Windows process-tree termination. It also needs no dependency or package-script change.
SIGTERM means an orderly launcher stop; SIGKILL and unrelated crash cleanup are outside this item.

## Verification plan

- Add a process-level regression in the existing HI MCP test suite: run the actual launcher with
  MCP and chat on unused ports, inherited `/dev/null` stdin, `--no-open` and a dummy provider key.
  Wait for the page, MCP and chat endpoints; signal only the launcher PID; verify it exits with
  zero and releases all three ports. Run for SIGTERM and SIGINT on POSIX.
- Reproduce the SIGTERM port leak before changing production code. The test owns a detached
  process group for failure cleanup, so its baseline cannot leave test servers behind.
- Run the focused regression, existing workspace tests/typechecks, root formatting and lint,
  and link/whitespace checks. No model requests or ligna-store changes are needed.
- Update the living launcher reference and MCP skill. Remove item 6 and its index rows only
  after verification; retain this local-fix analysis until the change lands on master.

## Implementation and verification

`startServer` resolves `vite-node/vite-node.mjs` through the workspace manifest with Node's
module resolver, then invokes it with the launcher's Node executable. Both existing server
launch functions use it. Their environments, exit monitoring and signal handlers stay in place;
no npm script, dependency or lockfile changes were needed.

The real process regression in `hi-mcp-server/tests/example-launcher.test.ts` passes both signals
on macOS and Linux. It waits for page HTTP 200, the MCP server's HTTP 404 on `/`, and chat health
HTTP 200, then sends the signal only to the launcher PID. The launcher exits with code 0 and
all three ports can be bound again before failure-cleanup runs. The dummy Mistral key is used
only to start chat; no chat turn or model request is sent. The test runs on POSIX and skips
Windows because its failure cleanup uses a POSIX process group; Windows was not verified.

The Linux check used a tracked repository archive, the cached Node 22 image and a fresh
install from the root lockfile. The same regression failed before the code change due to occupied
server ports, and passes after it. Its polling budget accommodates slower CI startup/typechecking.

The full Linux suite passed 595 tests in 16 files. Server, client, chat and Cloudflare typechecks
passed, as did root lint, Prettier, whitespace and markdown-link checks (`bad 0`).

The launcher references and MCP skill describe direct server children and signal shutdown. Item
6 and its index rows are removed after verification. This analysis remains until the fix lands
on master. SIGKILL and unrelated crash cleanup remain outside the verified SIGTERM/SIGINT scope.
