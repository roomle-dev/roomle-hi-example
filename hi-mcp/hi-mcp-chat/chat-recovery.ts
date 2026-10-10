import type { ModelMessage, Tool, ToolSet, ToolExecutionOptions } from 'ai';

const READ_ONLY_TOOLS = new Set([
  'get-plan-context',
  'get-authoring-rules',
  'find-attributes',
  'get-price',
  'get-order-data',
  'get-plan-images',
]);

const TOOL_LABELS: Record<string, string> = {
  'create-or-replace-groups': 'Create or replace groups',
  'place-group': 'Move group',
  'change-module-attribute': 'Change module attribute',
  'change-group-attribute': 'Change group attribute',
  'delete-group': 'Delete group',
  'delete-article-in-place': 'Delete article',
  'delete-article-and-compact': 'Delete article and close the gap',
  'merge-article-into-group': 'Add article to group',
  'insert-article-into-group': 'Insert article',
  'exchange-root-module': 'Replace article',
  'swap-root-modules': 'Swap articles',
  'merge-groups': 'Merge groups',
  undo: 'Undo',
  redo: 'Redo',
};

interface Outcome {
  toolCallId: string;
  toolName: string;
  input: unknown;
  tool: Tool;
  status: 'pending' | 'returned' | 'threw';
  result?: any;
  error?: unknown;
}

const textOf = (value: unknown): string => {
  if (value instanceof Error) return value.message;
  try {
    return typeof value === 'string'
      ? value
      : (JSON.stringify(value) ?? String(value));
  } catch {
    return Object.prototype.toString.call(value);
  }
};

const resultData = (result: any): any => {
  if (result?.structuredContent !== undefined) return result.structuredContent;
  const text = result?.content
    ?.filter((part: any) => part.type === 'text')
    .map((part: any) => part.text)
    .join('\n');
  if (text === undefined) return result;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const resultDetails = (data: any): string[] => {
  if (!data || typeof data !== 'object')
    return data == null ? [] : [textOf(data)];
  const details: string[] = [];
  for (const group of data.groups ?? []) {
    const articles = (group.roots ?? []).map(
      (root: any) => root.articleName ?? root.articleId ?? root.id
    );
    details.push(
      `group ${group.id}${articles.length ? ` (${articles.join(', ')})` : ''}`
    );
  }
  for (const key of [
    'groupId',
    'groupIds',
    'deletedGroupId',
    'removedGroupIds',
    'rootModuleId',
    'changedModuleIds',
    'attributeId',
    'value',
    'attributes',
    'groupAttributes',
    'skippedAttributes',
  ]) {
    if (data[key] !== undefined) details.push(`${key}: ${textOf(data[key])}`);
  }
  if (data.hint) details.push(textOf(data.hint));
  for (const correction of data.corrections ?? [])
    details.push(`Correction: ${textOf(correction)}`);
  for (const omitted of data.notLoaded ?? [])
    details.push(`Not loaded: ${textOf(omitted)}`);
  return details;
};

/** Records tool execution independently of whether the model finishes its step. */
export const createChatRecovery = (tools: ToolSet) => {
  const outcomes: Outcome[] = [];
  const recordedTools: ToolSet = Object.fromEntries(
    Object.entries(tools).map(([toolName, tool]) => {
      if (!tool.execute) return [toolName, tool];
      const execute = tool.execute.bind(tool);
      return [
        toolName,
        {
          ...tool,
          execute: async (
            input: unknown,
            options: ToolExecutionOptions<unknown>
          ) => {
            const outcome: Outcome = {
              toolName,
              toolCallId: options.toolCallId,
              input,
              tool,
              status: 'pending',
            };
            outcomes.push(outcome);
            try {
              const result = await execute(input, options);
              outcome.result = result;
              outcome.status = 'returned';
              return result;
            } catch (error) {
              outcome.error = error;
              outcome.status = 'threw';
              throw error;
            }
          },
        },
      ];
    })
  );

  const summary = (): string => {
    const lines = [
      "The assistant's reply was interrupted. Any text above is incomplete.",
    ];
    if (
      outcomes.some(
        (outcome) =>
          outcome.toolName === 'get-plan-context' &&
          outcome.status === 'returned' &&
          !outcome.result?.isError
      )
    ) {
      lines.push('The plan context was read.');
    }
    const writes = outcomes.filter(
      (outcome) => !READ_ONLY_TOOLS.has(outcome.toolName)
    );
    if (!writes.length)
      lines.push(
        'No plan-changing tool ran, so nothing was created or changed.'
      );
    else {
      for (const outcome of writes) {
        const label = TOOL_LABELS[outcome.toolName] ?? outcome.toolName;
        if (outcome.status === 'returned' && !outcome.result?.isError) {
          const details = resultDetails(resultData(outcome.result));
          lines.push(
            `- Completed ${label}: ${details.length ? details.join('; ') : 'the tool returned successfully.'}`
          );
        } else {
          const detail =
            outcome.status === 'threw'
              ? textOf(outcome.error)
              : outcome.status === 'returned'
                ? textOf(resultData(outcome.result))
                : 'no result was received';
          lines.push(
            `- Unconfirmed ${label}: ${detail}. Read the plan before trying this operation again.`
          );
        }
      }
      lines.push(
        'These are the recorded tool outcomes; no operation was repeated automatically.'
      );
    }
    return lines.join('\n\n');
  };

  const messages = async (): Promise<ModelMessage[]> => {
    const messages: ModelMessage[] = [];
    for (const outcome of outcomes.filter(
      (outcome) => outcome.status !== 'pending'
    )) {
      const { toolCallId, toolName, input } = outcome;
      let output;
      try {
        output =
          outcome.status === 'threw'
            ? { type: 'error-text' as const, value: textOf(outcome.error) }
            : outcome.tool.toModelOutput
              ? await outcome.tool.toModelOutput({
                  toolCallId,
                  input,
                  output: outcome.result,
                })
              : { type: 'json' as const, value: outcome.result };
      } catch {
        output = { type: 'text' as const, value: textOf(outcome.result) };
      }
      messages.push(
        {
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId, toolName, input }],
        },
        {
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, toolName, output }],
        }
      );
    }
    return messages;
  };

  return { tools: recordedTools, summary, messages };
};
