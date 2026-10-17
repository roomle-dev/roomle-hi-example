export const recordNavigations = (page) => {
  const entries = [];
  const previousUrls = new Map();
  let phase = 'loading';
  page.on('framenavigated', (frame) => {
    const url = frame.url();
    const previousUrl = previousUrls.get(frame);
    const entry = {
      at: new Date().toISOString(),
      phase,
      mainFrame: frame === page.mainFrame(),
      url,
      fragmentOnly:
        previousUrl !== undefined &&
        previousUrl !== url &&
        previousUrl.split('#')[0] === url.split('#')[0],
    };
    previousUrls.set(frame, url);
    entries.push(entry);
    console.log(`[run-hi-mcp-prompt] navigation ${JSON.stringify(entry)}`);
  });
  return { entries, setPhase: (value) => (phase = value) };
};

export const isNavigationInterrupted = (run) =>
  Boolean(
    run &&
    ((!run.planSnapshotId &&
      run.errors?.some((error) =>
        /Execution context was destroyed|because of a navigation|Frame was detached/i.test(
          error
        )
      )) ||
      (run.snapshotCaptured === false &&
        run.navigations?.some(
          ({ phase, fragmentOnly }) =>
            (phase === 'chat' || phase === 'snapshot') && !fragmentOnly
        )))
  );

const STEP_FAILURE_LINE =
  /^\[hi-chat\] step (\d+) failed after (\d+) ms: (.+)$/;

// A failed provider step as the chat logs it: the step, its duration and the
// cause chain of the error.
export const parseStepFailure = (line) => {
  const match = line.match(STEP_FAILURE_LINE);
  return (
    match && {
      step: Number(match[1]),
      durationMs: Number(match[2]),
      causes: match[3],
    }
  );
};

// The failed provider steps of a session by turn. The chat logs a failure on
// its error output, which arrives independently of the turn's response, so a
// record that comes after the response still belongs to the turn last started:
// a failed step ends the conversation.
export const recordStepFailures = () => {
  const entries = [];
  let turn;
  return {
    startTurn: (index) => {
      turn = index;
    },
    read: (line) => {
      const failure = parseStepFailure(line);
      if (failure && turn !== undefined) {
        entries.push({ turn, ...failure });
      }
    },
    ofTurn: (index) =>
      entries
        .filter((entry) => entry.turn === index)
        .map(({ turn: _turn, ...entry }) => entry),
  };
};

const TRANSPORT_FAILURE =
  /Failed to process successful response|ECONNRESET|socket hang up|fetch failed|terminated|AI_APICallError/i;

// A provider or transport failure: the model call or the connection dropped
// mid-stream, so the run says nothing about the planning. A run that completed
// without errors never matches, and a real planning defect is not retried.
export const isTransportFailure = (run) =>
  Boolean(
    run &&
    (run.errors?.some((error) => TRANSPORT_FAILURE.test(error)) ||
      run.turns?.some((turn) =>
        turn.stepFailures?.some(({ causes }) => TRANSPORT_FAILURE.test(causes))
      ))
  );
