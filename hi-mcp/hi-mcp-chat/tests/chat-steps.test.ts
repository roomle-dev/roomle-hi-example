import { jsonSchema, streamText, tool } from 'ai';
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';
import {
  chatSteps,
  isTurnTimeout,
  logStepUsage,
  MAX_CHAT_STEPS,
  turnTimeoutMessage,
} from '../chat-steps';

type StreamPart =
  Awaited<
    ReturnType<MockLanguageModelV3['doStream']>
  >['stream'] extends ReadableStream<infer Part>
    ? Part
    : never;

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

const answer: StreamPart[] = [
  { type: 'text-start', id: 'answer' },
  {
    type: 'text-delta',
    id: 'answer',
    delta: 'Done - the fridge is still missing.',
  },
  { type: 'text-end', id: 'answer' },
  { type: 'finish', usage, finishReason: { unified: 'stop', raw: 'stop' } },
];

const toolCall = (toolCallId: string): StreamPart[] => [
  { type: 'tool-call', toolCallId, toolName: 'get-plan-context', input: '{}' },
  {
    type: 'finish',
    usage,
    finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
  },
];

// gpt-5-mini makes one tool call per step and keeps calling tools as long as
// it may.
const modelThatAlwaysCallsATool = () => {
  let calls = 0;
  return new MockLanguageModelV3({
    doStream: async ({ toolChoice }) => ({
      stream: convertArrayToReadableStream(
        toolChoice?.type === 'none' ? answer : toolCall(`call-${++calls}`)
      ),
    }),
  });
};

const tools = {
  'get-plan-context': tool({
    inputSchema: jsonSchema({ type: 'object', properties: {} }),
    execute: async () => ({ rooms: [] }),
  }),
};

describe('chatSteps', () => {
  it('ends a turn that uses every step with the model answer', async () => {
    const model = modelThatAlwaysCallsATool();

    const result = streamText({
      model,
      messages: [{ role: 'user', content: 'plan a kitchen' }],
      tools,
      ...chatSteps,
    });

    expect(await result.text).toBe('Done - the fridge is still missing.');
    expect(model.doStreamCalls).toHaveLength(MAX_CHAT_STEPS);
    expect(
      model.doStreamCalls.map((call) => call.toolChoice?.type === 'none')
    ).toEqual([...Array(MAX_CHAT_STEPS - 1).fill(false), true]);
  });

  it('logs the usage of every step', async () => {
    // issue 17: what the model did in a long turn was not logged
    const log = vi.fn();
    const result = streamText({
      model: modelThatAlwaysCallsATool(),
      messages: [{ role: 'user', content: 'plan a kitchen' }],
      tools,
      ...chatSteps,
      onStepEnd: logStepUsage(log),
    });
    await result.text;
    expect(log).toHaveBeenCalledTimes(MAX_CHAT_STEPS);
    expect(log.mock.calls[0][0]).toMatch(
      /^\[hi-chat\] step 1: 1 in, 1 out, 0 reasoning tokens; tools: get-plan-context \(2 chars\); tool-calls; \d+ ms$/
    );
    expect(log.mock.calls[MAX_CHAT_STEPS - 1][0]).toMatch(
      /^\[hi-chat\] step 16: 1 in, 1 out, 0 reasoning tokens; no tool; stop; \d+ ms$/
    );
  });

  it('ends a turn that never answers after the turn timeout', async () => {
    // a model that answers only when the turn is aborted
    const model = new MockLanguageModelV3({
      doStream: ({ abortSignal }) =>
        new Promise((_, reject) => {
          abortSignal?.addEventListener('abort', () =>
            reject(abortSignal.reason)
          );
        }),
    });
    const result = streamText({
      model,
      messages: [{ role: 'user', content: 'plan a kitchen' }],
      tools,
      ...chatSteps,
      abortSignal: AbortSignal.timeout(50),
    });
    // the SDK ends the stream with an abort part, without an error
    const types: string[] = [];
    for await (const part of result.stream) {
      types.push(part.type);
    }
    expect(types).toEqual(['start', 'abort']);
    expect(isTurnTimeout(new DOMException('timed out', 'TimeoutError'))).toBe(
      true
    );
    expect(
      isTurnTimeout(
        new Error('wrapped', {
          cause: new DOMException('aborted', 'AbortError'),
        })
      )
    ).toBe(true);
    expect(isTurnTimeout(new Error('refused'))).toBe(false);
    expect(turnTimeoutMessage(5 * 60_000)).toBe(
      'the turn took longer than 5 minutes and was ended - the plan holds what the tools changed so far'
    );
  });
});
