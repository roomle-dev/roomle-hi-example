import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { describe, test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const launcherPath = fileURLToPath(new URL('../start.mjs', import.meta.url));

const unusedPort = async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
};

const waitUntil = async (condition, diagnostic) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await condition()) {
      return;
    }
    await setTimeout(50);
  }
  throw new Error(`Launcher check timed out: ${diagnostic()}`);
};

const canBind = (port) =>
  new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });

// The status of a request to this machine that names another site as its
// Host, as a page of a DNS-rebinding site sends it (fetch cannot set Host).
const statusWithHost = (port, path, host) =>
  new Promise((resolve, reject) => {
    request(
      { host: '127.0.0.1', port, path, headers: { host } },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      }
    )
      .on('error', reject)
      .end();
  });

// Starts the launcher with the arguments on an unused page port and waits
// until it serves the page.
const startLauncher = async (args, env = {}) => {
  const port = await unusedPort();
  const launcher = spawn(
    process.execPath,
    [launcherPath, '--no-open', ...args],
    {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, EXAMPLE_PORT: String(port), ...env },
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
  const fetchPath = (path) =>
    fetch(`http://127.0.0.1:${port}${path}`, {
      signal: AbortSignal.timeout(1000),
    });
  const kill = () => {
    try {
      process.kill(-launcher.pid, 'SIGKILL');
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

describe('example launcher', { skip: process.platform === 'win32' }, () => {
  for (const dev of [false, true]) {
    test(`passes the exact model id of the provider in ${dev ? 'dev' : 'start'} mode`, async () => {
      const model = 'ft:gpt-4o:roomle:Kitchen:abc';
      const example = await startLauncher(
        [`openai:${model}`, 'openai-test-key', ...(dev ? ['--dev'] : [])],
        { EXAMPLE_SERVER_URL: undefined }
      );
      try {
        assert.deepEqual(
          await (
            await example.fetchPath('/planning-assistant-config.json')
          ).json(),
          {
            provider: 'openai',
            model,
            apiKey: 'openai-test-key',
            readsImages: true,
          }
        );
        assert.ok(example.output().includes(`Model:    openai ${model}`));
        assert.ok(example.output().includes('&chat=true'));
        assert.equal(
          example
            .output()
            .includes(encodeURIComponent('http://localhost:5173/')),
          dev
        );
        assert.ok(!example.output().includes('openai-test-key'));
      } finally {
        example.kill();
      }
    });
  }

  for (const [args, message] of [
    [['mistral', 'test-key'], /"mistral" is no <provider>:<model-id>/],
    [['gpt-6-astra', 'test-key'], /"gpt-6-astra" is no <provider>:<model-id>/],
    [['claude:claude-sonnet-4-5', 'test-key'], /provider: anthropic, azure/],
    [['openai:', 'test-key'], /"openai:" is no <provider>:<model-id>/],
    [['openai-compatible:planning', 'test-key'], /--base-url/],
    [['azure:gpt-6-astra'], /missing API key/],
    [['azure:gpt-6-astra', 'test-key', '--unknown'], /--unknown/],
  ]) {
    test(`rejects ${args.join(' ')} before starting the server`, async () => {
      const launcher = spawn(process.execPath, [
        launcherPath,
        ...args,
        '--no-open',
      ]);
      let error = '';
      launcher.stderr.on('data', (chunk) => {
        error += chunk;
      });
      assert.deepEqual(await once(launcher, 'exit'), [1, null]);
      assert.match(error, message);
      assert.ok(!error.includes('test-key'));
    });
  }

  test(
    'serves the planning assistant config of the model to this machine',
    { timeout: 90_000 },
    async () => {
      const withModel = await startLauncher([
        'azure:gpt-6-astra',
        'test-key',
        '--cache-breakpoint',
      ]);
      const withoutModel = await startLauncher([]);
      try {
        const config = await withModel.fetchPath(
          '/planning-assistant-config.json'
        );
        assert.equal(config.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await config.json(), {
          provider: 'azure',
          model: 'gpt-6-astra',
          apiKey: 'test-key',
          baseUrl: 'https://dfhifoundrysweden.services.ai.azure.com/openai/v1',
          referenceCacheBreakpoint: true,
          readsImages: true,
        });
        assert.ok(withModel.output().includes('&chat=true'));
        assert.ok(!withModel.output().includes('test-key'));
        assert.equal(
          (await withoutModel.fetchPath('/planning-assistant-config.json'))
            .status,
          404
        );
        // without a model the launcher starts only the example: chat=false
        assert.ok(withoutModel.output().includes('&chat=false'));
        assert.ok(!withoutModel.output().includes('&chat=true'));
        assert.equal(
          await statusWithHost(
            withModel.port,
            '/planning-assistant-config.json',
            `rebinding.example:${withModel.port}`
          ),
          403
        );
      } finally {
        withModel.kill();
        withoutModel.kill();
      }
    }
  );

  test('passes the options of an azure deployment', async () => {
    const example = await startLauncher([
      'azure:mistral-large-3',
      'test-key',
      '--base-url',
      'https://other.services.ai.azure.com/openai/v1',
      '--chat-completions',
      '--reasoning-effort',
      'high',
    ]);
    try {
      assert.deepEqual(
        await (
          await example.fetchPath('/planning-assistant-config.json')
        ).json(),
        {
          provider: 'azure',
          model: 'mistral-large-3',
          apiKey: 'test-key',
          baseUrl: 'https://other.services.ai.azure.com/openai/v1',
          chatCompletions: true,
          reasoningEffort: 'high',
          readsImages: true,
        }
      );
    } finally {
      example.kill();
    }
  });

  test('uses the next free port when the requested port is taken', async () => {
    const blocker = createServer();
    await new Promise((resolve) => blocker.listen(0, resolve));
    const { port } = blocker.address();
    const launcher = spawn(process.execPath, [launcherPath, '--no-open'], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, EXAMPLE_PORT: String(port) },
    });
    let output = '';
    launcher.stdout.on('data', (chunk) => {
      output += chunk;
    });
    launcher.stderr.on('data', (chunk) => {
      output += chunk;
    });
    const kill = () => {
      try {
        process.kill(-launcher.pid, 'SIGKILL');
      } catch {}
    };
    try {
      await waitUntil(
        () => output.includes('Example:'),
        () => `the launcher did not report its URL\n${output}`
      );
      assert.ok(
        output.includes(`port ${port} is already in use`),
        `no port fallback note\n${output}`
      );
      const usedPort = Number(
        new URL(output.match(/Example:\s+(\S+)/)[1]).port
      );
      assert.notEqual(usedPort, port);
      assert.ok(output.includes(`localhost:${usedPort}/`));
      assert.ok(output.includes('&chat=false'));
      const page = await fetch(`http://127.0.0.1:${usedPort}/`, {
        signal: AbortSignal.timeout(1000),
      });
      assert.ok(page.ok);
      assert.equal(
        (
          await fetch(
            `http://127.0.0.1:${usedPort}/planning-assistant-config.json`,
            {
              signal: AbortSignal.timeout(1000),
            }
          )
        ).status,
        404
      );
    } finally {
      kill();
      await new Promise((resolve) => blocker.close(resolve));
    }
  });

  for (const signal of ['SIGTERM', 'SIGINT']) {
    test(
      `releases the page port when only the launcher receives ${signal}`,
      { timeout: 90_000 },
      async () => {
        const { launcher, port, exited, kill, output } = await startLauncher([
          'mistral:mistral-large-latest',
          'test-key',
        ]);
        try {
          launcher.kill(signal);
          await waitUntil(
            async () =>
              launcher.exitCode !== null || launcher.signalCode !== null,
            () => `launcher did not exit\n${output()}`
          );
          assert.deepEqual(await exited, [0, null]);
          await waitUntil(
            () => canBind(port),
            () => `the page port is still occupied\n${output()}`
          );
        } finally {
          kill();
        }
      }
    );
  }
});
