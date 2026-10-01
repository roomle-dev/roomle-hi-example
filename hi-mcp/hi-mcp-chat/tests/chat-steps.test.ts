import { jsonSchema, streamText, tool } from 'ai';
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { chatSteps, MAX_CHAT_STEPS } from '../chat-steps';

type StreamPart =
  Awaited<ReturnType<MockLanguageModelV3['doStream']>>['stream'] extends ReadableStream<infer Part>
    ? Part
    : never;

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

const answer: StreamPart[] = [
  { type: 'text-start', id: 'answer' },
  { type: 'text-delta', id: 'answer', delta: 'Done - the fridge is still missing.' },
  { type: 'text-end', id: 'answer' },
  { type: 'finish', usage, finishReason: { unified: 'stop', raw: 'stop' } },
];

const toolCall = (toolCallId: string): StreamPart[] => [
  { type: 'tool-call', toolCallId, toolName: 'get-plan-context', input: '{}' },
  { type: 'finish', usage, finishReason: { unified: 'tool-calls', raw: 'tool_calls' } },
];

// gpt-5-mini makes one tool call per step and keeps calling tools as long as
// it may.
const modelThatAlwaysCallsATool = () => {
  let calls = 0;
  return new MockLanguageModelV3({
    doStream: async ({ toolChoice }) => ({
      stream: convertArrayToReadableStream(
        toolChoice?.type === 'none' ? answer : toolCall(`call-${++calls}`),
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
      model.doStreamCalls.map((call) => call.toolChoice?.type === 'none'),
    ).toEqual([...Array(MAX_CHAT_STEPS - 1).fill(false), true]);
  });
});
