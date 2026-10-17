import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseStepFailure,
  recordStepFailures,
} from '../mcp-test-navigation.js';

test('reads the step, the duration and the cause chain of a failed provider step', () => {
  assert.deepEqual(
    parseStepFailure(
      '[hi-chat] step 3 failed after 63315 ms: AI_APICallError: Failed to process successful response, status 200 <- caused by TypeError: terminated <- caused by Error: read ECONNRESET'
    ),
    {
      step: 3,
      durationMs: 63315,
      causes:
        'AI_APICallError: Failed to process successful response, status 200 <- caused by TypeError: terminated <- caused by Error: read ECONNRESET',
    }
  );
});

test('ignores the other lines of the chat', () => {
  assert.equal(
    parseStepFailure(
      '[hi-chat] step 3: 1200 in, 80 out, 0 reasoning tokens; no tool; stop; 900 ms'
    ),
    null
  );
});

test('keeps a failure logged after its turn ended with that turn', () => {
  const stepFailures = recordStepFailures();
  stepFailures.read(
    '[hi-chat] step 1 failed after 10 ms: Error: before the chat'
  );
  stepFailures.startTurn(0);
  stepFailures.startTurn(1);
  // the turn's response has ended; its failure arrives on the error output
  stepFailures.read(
    "[hi-chat] step 3 failed after 1200 ms: AI_APICallError: Item with id 'rs_1' not found., status 400"
  );
  assert.deepEqual(stepFailures.ofTurn(0), []);
  assert.deepEqual(stepFailures.ofTurn(1), [
    {
      step: 3,
      durationMs: 1200,
      causes: "AI_APICallError: Item with id 'rs_1' not found., status 400",
    },
  ]);
});
