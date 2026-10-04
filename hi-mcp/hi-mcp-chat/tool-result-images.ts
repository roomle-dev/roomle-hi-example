import type { LanguageModelMiddleware } from 'ai';

type Prompt = Parameters<
  NonNullable<LanguageModelMiddleware['transformParams']>
>[0]['params']['prompt'];
type ToolMessage = Extract<Prompt[number], { role: 'tool' }>;
type UserMessage = Extract<Prompt[number], { role: 'user' }>;
type FilePart = Extract<UserMessage['content'][number], { type: 'file' }>;

export const IMAGES_FOLLOW_NOTE =
  'The images of this result follow in the next message.';

const moveFilesOutOfToolMessage = (
  message: ToolMessage
): { message: ToolMessage; files: FilePart[] } => {
  const files: FilePart[] = [];
  const content = message.content.map((part) => {
    if (part.type !== 'tool-result' || part.output.type !== 'content') {
      return part;
    }
    const partFiles = part.output.value.filter(
      (item): item is FilePart => item.type === 'file'
    );
    if (partFiles.length === 0) {
      return part;
    }
    files.push(...partFiles);
    return {
      ...part,
      output: {
        ...part.output,
        value: [
          ...part.output.value.filter((item) => item.type !== 'file'),
          { type: 'text' as const, text: IMAGES_FOLLOW_NOTE },
        ],
      },
    };
  });
  return { message: { ...message, content }, files };
};

/**
 * Moves the files of every tool result (the images of get-plan-images) into a
 * user message right after the tool message.
 */
export const moveToolResultFilesToUserMessages = (prompt: Prompt): Prompt =>
  prompt.flatMap<Prompt[number]>((message) => {
    if (message.role !== 'tool') {
      return [message];
    }
    const moved = moveFilesOutOfToolMessage(message);
    if (moved.files.length === 0) {
      return [message];
    }
    const userMessage: UserMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'Images of the tool result above:' },
        ...moved.files,
      ],
    };
    return [moved.message, userMessage];
  });

// @ai-sdk/mistral sends a tool result's content as JSON text - the base64 of
// an image included - while Mistral reads images in user messages.
export const toolResultFilesAsUserMessages: LanguageModelMiddleware = {
  transformParams: async ({ params }) => ({
    ...params,
    prompt: moveToolResultFilesToUserMessages(params.prompt),
  }),
};
