import { stepCountIs, type LanguageModelUsage } from 'ai';

export const MAX_CHAT_STEPS = 16;

/**
 * The step loop of a chat turn: tool calls are executed and sent back to the
 * model for up to MAX_CHAT_STEPS steps. The last step may not call a tool, so
 * a turn that uses every step still ends with the model's answer.
 */
export const chatSteps = {
  stopWhen: stepCountIs(MAX_CHAT_STEPS),
  prepareStep: ({ stepNumber }: { stepNumber: number }) =>
    stepNumber === MAX_CHAT_STEPS - 1
      ? { toolChoice: 'none' as const }
      : undefined,
};

interface StepUsage {
  usage?: Pick<
    LanguageModelUsage,
    'inputTokens' | 'outputTokens' | 'outputTokenDetails'
  >;
  toolCalls?: { toolName?: string; input?: unknown }[];
  finishReason?: unknown;
}

/**
 * Logs what the model produced in every step - the tokens in, out and spent
 * on reasoning, the tools it called with the size of their input, and the
 * step's duration - so a long turn shows where its time goes.
 */
export const logStepUsage = (log: (line: string) => void = console.log) => {
  let step = 0;
  let startedAt = Date.now();
  return (result: StepUsage) => {
    step += 1;
    const tools = (result.toolCalls ?? []).map(
      (call) =>
        `${call.toolName} (${JSON.stringify(call.input ?? {}).length} chars)`
    );
    const finish =
      typeof result.finishReason === 'string'
        ? result.finishReason
        : JSON.stringify(result.finishReason ?? '');
    const usage = result.usage;
    log(
      `[hi-chat] step ${step}: ${usage?.inputTokens ?? 0} in, ` +
        `${usage?.outputTokens ?? 0} out, ${usage?.outputTokenDetails.reasoningTokens ?? 0} reasoning tokens; ` +
        `${tools.length > 0 ? `tools: ${tools.join(', ')}` : 'no tool'}; ${finish}; ${Date.now() - startedAt} ms`
    );
    startedAt = Date.now();
  };
};

// AbortSignal.timeout rejects with a TimeoutError, a manual abort with an
// AbortError; the SDK may wrap either as the cause of its own error.
export const isTurnTimeout = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { name, cause } = error as { name?: string; cause?: unknown };
  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    (cause !== error && isTurnTimeout(cause))
  );
};

export const turnTimeoutMessage = (timeoutMs: number): string =>
  `the turn took longer than ${Math.round(timeoutMs / 60_000)} minutes and was ended - the plan holds what the tools changed so far`;
