import { describe, expect, it } from 'vitest';
import {
  IMAGES_FOLLOW_NOTE,
  moveToolResultFilesToUserMessages,
  toolResultFilesAsUserMessages,
} from '../tool-result-images';

type Prompt = Parameters<typeof moveToolResultFilesToUserMessages>[0];

const perspectiveImage = {
  type: 'file' as const,
  mediaType: 'image/png',
  data: { type: 'data' as const, data: 'cGVyc3BlY3RpdmU=' },
};
const topImage = {
  type: 'file' as const,
  mediaType: 'image/png',
  data: { type: 'data' as const, data: 'dG9w' },
};

const userTurn: Prompt[number] = {
  role: 'user',
  content: [{ type: 'text', text: 'plan a kitchen in the back right corner' }],
};
const toolCalls: Prompt[number] = {
  role: 'assistant',
  content: [
    {
      type: 'tool-call',
      toolCallId: 'call-images',
      toolName: 'get-plan-images',
      input: {},
    },
    {
      type: 'tool-call',
      toolCallId: 'call-price',
      toolName: 'get-price',
      input: {},
    },
  ],
};
const priceResult = {
  type: 'tool-result' as const,
  toolCallId: 'call-price',
  toolName: 'get-price',
  output: {
    type: 'content' as const,
    value: [{ type: 'text' as const, text: '{"total":1200}' }],
  },
};

describe('moveToolResultFilesToUserMessages', () => {
  it('moves the images of a tool result into a user message after the tool message', () => {
    const prompt: Prompt = [
      userTurn,
      toolCalls,
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-images',
            toolName: 'get-plan-images',
            output: { type: 'content', value: [perspectiveImage, topImage] },
          },
          priceResult,
        ],
      },
    ];
    expect(moveToolResultFilesToUserMessages(prompt)).toEqual([
      userTurn,
      toolCalls,
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-images',
            toolName: 'get-plan-images',
            output: {
              type: 'content',
              value: [{ type: 'text', text: IMAGES_FOLLOW_NOTE }],
            },
          },
          priceResult,
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Images of the tool result above:' },
          perspectiveImage,
          topImage,
        ],
      },
    ]);
  });

  it('keeps the text parts of a tool result beside the note', () => {
    const [toolMessage] = moveToolResultFilesToUserMessages([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-images',
            toolName: 'get-plan-images',
            output: {
              type: 'content',
              value: [{ type: 'text', text: 'rendered' }, topImage],
            },
          },
        ],
      },
    ]);
    expect(toolMessage).toMatchObject({
      content: [
        {
          output: {
            value: [
              { type: 'text', text: 'rendered' },
              { type: 'text', text: IMAGES_FOLLOW_NOTE },
            ],
          },
        },
      ],
    });
  });

  it('leaves a prompt without files unchanged', () => {
    const prompt: Prompt = [
      userTurn,
      toolCalls,
      { role: 'tool', content: [priceResult] },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'The kitchen costs 1200.' }],
      },
    ];
    const moved = moveToolResultFilesToUserMessages(prompt);
    expect(moved).toEqual(prompt);
    moved.forEach((message, index) => expect(message).toBe(prompt[index]));
  });
});

describe('toolResultFilesAsUserMessages', () => {
  it('transforms only the prompt of the call parameters', async () => {
    const params = {
      prompt: [
        {
          role: 'tool' as const,
          content: [
            {
              type: 'tool-result' as const,
              toolCallId: 'call-images',
              toolName: 'get-plan-images',
              output: { type: 'content' as const, value: [topImage] },
            },
          ],
        },
      ],
      maxOutputTokens: 1000,
    };
    const transformed = await toolResultFilesAsUserMessages.transformParams!({
      type: 'stream',
      params,
      model: {} as never,
    });
    expect(transformed.maxOutputTokens).toBe(1000);
    expect(transformed.prompt.map(({ role }) => role)).toEqual([
      'tool',
      'user',
    ]);
  });
});
