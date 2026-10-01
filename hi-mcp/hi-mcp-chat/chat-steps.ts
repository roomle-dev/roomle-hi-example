import { stepCountIs } from 'ai';

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
