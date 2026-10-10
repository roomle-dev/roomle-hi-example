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
