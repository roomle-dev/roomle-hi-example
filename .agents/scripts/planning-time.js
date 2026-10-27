// The planner's history events in the page, with the page's time: the planner
// reports one per step of a plan change, and a tool call that changes nothing,
// reads the plan or opens doors reports none.
export const recordPlanChanges = (page) =>
  page.evaluate(() => {
    const { callbacks } = window.instance.extended;
    const previous = callbacks.onHistoryChange;
    window.hiPlanChanges = [];
    callbacks.onHistoryChange = (...args) => {
      window.hiPlanChanges.push(Date.now());
      return previous?.apply(callbacks, args);
    };
  });

// For a prompt sent at startedAt: the ms until the plan first changed, null
// when it did not change.
export const collectFirstPlanChange = async (page, startedAt) => {
  const before = await page.evaluate(() => window.hiPlanChanges.length);
  return async () => {
    const changedAt = await page.evaluate(
      (index) => window.hiPlanChanges[index] ?? null,
      before
    );
    return changedAt === null ? null : changedAt - startedAt;
  };
};

// The time of a test's turns, without the moments between them: planningMs
// from the first prompt until the last answer, firstResultMs from the first
// prompt until the plan first changed. planChanged is false when no turn
// changed the plan and null for turns recorded before the plan changes were.
export const summarizePlanningTime = (turns) => {
  const durations = turns.map((turn) => turn.durationMs);
  const planningMs =
    durations.length > 0 && durations.every(Number.isFinite)
      ? durations.reduce((sum, ms) => sum + ms, 0)
      : null;
  let elapsedMs = 0;
  for (const turn of turns) {
    if (turn.firstPlanChangeMs === undefined) {
      return { planningMs, firstResultMs: null, planChanged: null };
    }
    if (turn.firstPlanChangeMs !== null) {
      return {
        planningMs,
        firstResultMs: elapsedMs + turn.firstPlanChangeMs,
        planChanged: true,
      };
    }
    elapsedMs += turn.durationMs;
  }
  return {
    planningMs,
    firstResultMs: null,
    planChanged: turns.length > 0 ? false : null,
  };
};
