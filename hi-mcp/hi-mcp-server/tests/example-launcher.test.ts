import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const launcherPath = fileURLToPath(
  new URL('../../../minimal-hi-example/start.mjs', import.meta.url)
);

const unusedPort = async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected a TCP address');
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
};

const waitUntil = async (
  condition: () => Promise<boolean>,
  diagnostic: () => string
) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await condition()) {
      return;
    }
    await setTimeout(50);
  }
  throw new Error(`Launcher check timed out: ${diagnostic()}`);
};

const canBind = (port: number) =>
  new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });

// Starts the launcher with the arguments on an unused page port and waits
// until it serves the page.
const startLauncher = async (args: string[]) => {
  const port = await unusedPort();
  const launcher = spawn(
    process.execPath,
    [launcherPath, '--no-open', ...args],
    {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, EXAMPLE_PORT: String(port) },
    }
  );
  let output = '';
  launcher.stdout.on('data', (chunk) => {
    output += chunk;
  });
  launcher.stderr.on('data', (chunk) => {
    output += chunk;
  });
  const exited = once(launcher, 'exit');
  const fetchPath = (path: string) =>
    fetch(`http://127.0.0.1:${port}${path}`, {
      signal: AbortSignal.timeout(1000),
    });
  const kill = () => {
    try {
      process.kill(-launcher.pid!, 'SIGKILL');
    } catch {}
  };
  try {
    await waitUntil(
      async () => {
        try {
          return (await fetchPath('/')).ok;
        } catch {
          return false;
        }
      },
      () => `the page was not served\n${output}`
    );
  } catch (error) {
    kill();
    throw error;
  }
  return { launcher, port, exited, fetchPath, kill, output: () => output };
};

describe.skipIf(process.platform === 'win32')('example launcher', () => {
  it('serves the planning assistant config of the model to this machine', async () => {
    const withModel = await startLauncher(['gpt-6-astra', 'test-key']);
    const withoutModel = await startLauncher([]);
    try {
      const config = await withModel.fetchPath(
        '/planning-assistant-config.json'
      );
      expect(config.headers.get('cache-control')).toBe('no-store');
      expect(await config.json()).toEqual({
        provider: 'azure',
        model: 'gpt-6-astra',
        apiKey: 'test-key',
        baseUrl: 'https://dfhifoundrysweden.services.ai.azure.com/openai/v1',
        chatCompletions: false,
        readsImages: true,
      });
      expect(withModel.output()).toContain('&chat=true');
      expect(withModel.output()).not.toContain('test-key');
      expect(
        (await withoutModel.fetchPath('/planning-assistant-config.json')).status
      ).toBe(404);
    } finally {
      withModel.kill();
      withoutModel.kill();
    }
  }, 90_000);

  it.each(['SIGTERM', 'SIGINT'] as const)(
    'releases the page port when only the launcher receives %s',
    async (signal) => {
      const { launcher, port, exited, kill, output } = await startLauncher([
        'mistral',
        'test-key',
      ]);
      try {
        launcher.kill(signal);
        await waitUntil(
          async () =>
            launcher.exitCode !== null || launcher.signalCode !== null,
          () => `launcher did not exit\n${output()}`
        );
        expect(await exited).toEqual([0, null]);
        await waitUntil(
          () => canBind(port),
          () => `the page port is still occupied\n${output()}`
        );
      } finally {
        kill();
      }
    },
    90_000
  );
});
