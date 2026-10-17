import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseStepFailure } from '../mcp-test-navigation.js';

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
