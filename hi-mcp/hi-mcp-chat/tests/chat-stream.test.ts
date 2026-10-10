import { jsonSchema, modelMessageSchema, tool, type ToolSet } from 'ai';
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getChatConfig } from '../chat-config';
import { createStreamChat } from '../chat-stream';
import { createChatRecovery } from '../chat-recovery';

const mocks = vi.hoisted(() => ({
  model: undefined as unknown,
  tools: {} as ToolSet,
  close: vi.fn(),
}));
vi.mock('@ai-sdk/azure', () => ({ createAzure: () => () => mocks.model }));
vi.mock('@ai-sdk/mcp', () => ({
  createMCPClient: async () => ({
    tools: async () => mocks.tools,
    close: mocks.close,
  }),
}));

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
type Part =
  Awaited<
    ReturnType<MockLanguageModelV3['doStream']>
  >['stream'] extends ReadableStream<infer P>
    ? P
    : never;
const finish = (reason: 'stop' | 'tool-calls'): Part => ({
  type: 'finish',
  usage,
  finishReason: { unified: reason, raw: reason },
});
const call = (name: string, id = name): Part => ({
  type: 'tool-call',
  toolCallId: id,
  toolName: name,
  input: '{}',
});
const text = (answer: string): Part[] => [
  { type: 'text-start', id: 'answer' },
  { type: 'text-delta', id: 'answer', delta: answer },
  { type: 'text-end', id: 'answer' },
];
const mcpResult = (result: unknown, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(result) }],
  isError,
});
const fakeTool = (execute: () => Promise<unknown>) =>
  tool({
    inputSchema: jsonSchema({ type: 'object', properties: {} }),
    execute,
  });
const response = async (timeout = 1000) => {
  const streamChat = createStreamChat(
    getChatConfig({
      HI_CHAT_PROVIDER: 'gpt-5-mini',
      HI_CHAT_TOKEN: 'test',
      HI_CHAT_TURN_TIMEOUT_MS: String(timeout),
    })
  );
  return (
    await streamChat([{ role: 'user', content: 'Add cabinets' }], 'test-page')
  ).text();
};
const failingModel = (calls: Part[], mode: 'error' | 'throw' = 'error') => {
  let step = 0;
  return new MockLanguageModelV3({
    doStream: async () => {
      if (step++ === 0)
        return {
          stream: convertArrayToReadableStream([
            ...calls,
            finish('tool-calls'),
          ]),
        };
      const error = new Error('Failed to process successful response');
      if (mode === 'error')
        return {
          stream: convertArrayToReadableStream([{ type: 'error', error }]),
        };
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.error(error);
          },
        }),
      };
    },
  });
};

afterEach(() => {
  vi.restoreAllMocks();
  mocks.close.mockClear();
});

describe('chat response recovery', () => {
  it.each(['error', 'throw'] as const)(
    'explains a failure after reading the context (%s)',
    async (mode) => {
      const read = vi.fn(async () => mcpResult({ rooms: [] }));
      mocks.tools = { 'get-plan-context': fakeTool(read) };
      mocks.model = failingModel([call('get-plan-context')], mode);
      const answer = await response();
      expect(answer).toContain('[error] Failed to process successful response');
      expect(answer).toContain('reply was interrupted');
      expect(answer).toContain('plan context was read');
      expect(answer).toContain('nothing was created or changed');
      expect(read).toHaveBeenCalledTimes(1);
      expect(mocks.close).toHaveBeenCalledTimes(1);
    }
  );

  it('reports actual partial success and corrections without repeating a write', async () => {
    const write = vi.fn(async () =>
      mcpResult({
        groups: [{ id: 'group-1', roots: [{ articleId: 'catalog-cabinet' }] }],
        corrections: ['Width set to 600 mm'],
        notLoaded: [{ index: 1, errors: ['Unknown article missing-cabinet'] }],
      })
    );
    mocks.tools = { 'create-or-replace-groups': fakeTool(write) };
    mocks.model = failingModel([call('create-or-replace-groups')]);
    const answer = await response();
    expect(answer).toContain('group-1');
    expect(answer).toContain('catalog-cabinet');
    expect(answer).toContain('Width set to 600 mm');
    expect(answer).toContain('Unknown article missing-cabinet');
    expect(answer).not.toContain('nothing was created or changed');
    expect(write).toHaveBeenCalledTimes(1);
    expect((mocks.model as MockLanguageModelV3).doStreamCalls).toHaveLength(2);
  });

  it('marks an error result or thrown write as unconfirmed beside a successful write', async () => {
    mocks.tools = {
      'delete-group': fakeTool(async () =>
        mcpResult({ removedGroupIds: ['old-group'] })
      ),
      'place-group': fakeTool(async () =>
        mcpResult('Planner call timed out', true)
      ),
      'insert-article-into-group': fakeTool(async () => {
        throw new Error('Bridge disconnected');
      }),
    };
    mocks.model = failingModel(
      Object.keys(mocks.tools).map((name) => call(name))
    );
    const answer = await response();
    expect(answer).toContain('old-group');
    expect(answer).toContain('Unconfirmed');
    expect(answer).toContain('Planner call timed out');
    expect(answer).toContain('Bridge disconnected');
    expect(answer).toContain('Read the plan before');
    expect(answer).not.toContain('nothing was created or changed');
  });

  it('keeps partial text, emits one recovery notice, and survives throwing diagnostics', async () => {
    mocks.tools = {};
    const error = Object.assign(new Error('Provider failed'), {
      value: { count: 1n },
    });
    mocks.model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          ...text('I started planning.'),
          { type: 'error', error },
        ]),
      }),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('Logger failed');
    });
    const answer = await response();
    expect(answer).toContain('I started planning.');
    expect(answer.match(/reply was interrupted/g)).toHaveLength(1);
    expect(answer).toContain('nothing was created or changed');
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it('reports a write whose request was aborted as unconfirmed on timeout', async () => {
    const write = vi.fn(
      (_input, { abortSignal }) =>
        new Promise((_, reject) => {
          abortSignal.addEventListener('abort', () =>
            reject(abortSignal.reason)
          );
        })
    );
    mocks.tools = {
      'create-or-replace-groups': tool({
        inputSchema: jsonSchema({ type: 'object', properties: {} }),
        execute: write,
      }),
    };
    mocks.model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          call('create-or-replace-groups'),
          finish('tool-calls'),
        ]),
      }),
    });
    const answer = await response(50);
    expect(answer).toContain('Unconfirmed');
    expect(answer).not.toContain('nothing was created or changed');
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('keeps a successful answer unchanged', async () => {
    mocks.tools = {};
    mocks.model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          ...text('The cabinets are ready.'),
          finish('stop'),
        ]),
      }),
    });
    expect(await response()).toBe('The cabinets are ready.');
  });

  it('keeps a completed write successful when its completion log throws', async () => {
    const written = mcpResult({ groups: [{ id: 'created-group', roots: [] }] });
    const write = vi.fn(async () => written);
    mocks.tools = { 'create-or-replace-groups': fakeTool(write) };
    let step = 0;
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: convertArrayToReadableStream(
          step++ === 0
            ? [call('create-or-replace-groups'), finish('tool-calls')]
            : [...text('The cabinets are ready.'), finish('stop')]
        ),
      }),
    });
    mocks.model = model;
    const log = vi.spyOn(console, 'log').mockImplementation((message) => {
      if (String(message).startsWith('[hi-chat] tool done:')) {
        throw new Error('Completion logger failed');
      }
    });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await response()).toBe(
      '\n[tool] create-or-replace-groups\nThe cabinets are ready.'
    );
    expect(write).toHaveBeenCalledTimes(1);
    expect(model.doStreamCalls).toHaveLength(2);
    expect(model.doStreamCalls[1].prompt).toContainEqual(
      expect.objectContaining({
        role: 'tool',
        content: [
          expect.objectContaining({
            type: 'tool-result',
            toolCallId: 'create-or-replace-groups',
            toolName: 'create-or-replace-groups',
            output: { type: 'json', value: written },
          }),
        ],
      })
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('[hi-chat] tool done: create-or-replace-groups')
    );
    expect(errorLog).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it('retains a tool result when the SDK cannot convert it into a model message', async () => {
    const write = vi.fn(async () => {
      return mcpResult({ groups: [{ id: 'group-in-failed-step', roots: [] }] });
    });
    mocks.tools = {
      'create-or-replace-groups': {
        ...fakeTool(write),
        toModelOutput: () => {
          throw new Error('Tool output conversion failed');
        },
      },
    };
    mocks.model = failingModel([call('create-or-replace-groups')]);
    const answer = await response();
    expect(answer).toContain('group-in-failed-step');
    expect(answer).toContain('reply was interrupted');
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('retains only completed message pairs when another write is still pending', async () => {
    const recovery = createChatRecovery({
      'delete-group': fakeTool(async () =>
        mcpResult({ removedGroupIds: ['group-removed'] })
      ),
      'place-group': fakeTool(() => new Promise(() => {})),
    });
    const options = { toolCallId: 'done', messages: [], context: {} };
    await recovery.tools['delete-group'].execute!({}, options);
    void recovery.tools['place-group'].execute!(
      {},
      { ...options, toolCallId: 'pending' }
    );
    expect(recovery.summary()).toContain('group-removed');
    expect(recovery.summary()).toContain('Unconfirmed Move group');
    const messages = await recovery.messages();
    expect(messages).toHaveLength(2);
    expect(JSON.stringify(messages)).toContain('done');
    expect(JSON.stringify(messages)).not.toContain('pending');
    messages.forEach((message) => modelMessageSchema.parse(message));
  });

  it('keeps the actual result in valid history when tool output conversion fails', async () => {
    const recovery = createChatRecovery({
      'create-or-replace-groups': {
        ...fakeTool(async () =>
          mcpResult({ groups: [{ id: 'created-group', roots: [] }] })
        ),
        toModelOutput: () => {
          throw new Error('Conversion failed');
        },
      },
    });
    await recovery.tools['create-or-replace-groups'].execute!(
      {},
      {
        toolCallId: 'created',
        messages: [],
        context: {},
      }
    );
    const messages = await recovery.messages();
    messages.forEach((message) => modelMessageSchema.parse(message));
    expect(JSON.stringify(messages[1])).toContain('created-group');
    expect(recovery.summary()).toContain('created-group');
  });
});
