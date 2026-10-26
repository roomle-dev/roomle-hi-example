const USAGE_PREFIX = '[planning-assistant] usage ';
const COUNTS = ['inputTokens', 'outputTokens', 'totalTokens'];

export const unavailableUsage = () => ({
  status: 'unavailable',
  inputTokens: null,
  outputTokens: null,
  totalTokens: null,
});

export const summarizeUsage = (records) => {
  const counts = Object.fromEntries(
    COUNTS.map((key) => {
      const known = records
        .map((record) => record?.[key])
        .filter((value) => Number.isSafeInteger(value) && value >= 0);
      return [
        key,
        known.length ? known.reduce((sum, value) => sum + value, 0) : null,
      ];
    })
  );
  const measured = Object.values(counts).some((count) => count !== null);
  return {
    status: measured
      ? records.every(
          (record) =>
            record?.status === 'complete' &&
            COUNTS.every(
              (key) => Number.isSafeInteger(record[key]) && record[key] >= 0
            )
        )
        ? 'complete'
        : 'partial'
      : 'unavailable',
    ...counts,
  };
};

export const collectPromptUsage = (page) => {
  const records = [];
  const pending = [];
  const usageWarnings = [];
  const onConsole = (message) => {
    const text = message.text();
    if (!text.startsWith(USAGE_PREFIX)) return;
    pending.push(
      (async () => {
        if (!(await message.args()[0].evaluate(() => window === window.top)))
          return;
        const record = JSON.parse(text.slice(USAGE_PREFIX.length));
        const valid =
          typeof record?.provider === 'string' &&
          typeof record?.model === 'string' &&
          ['complete', 'partial', 'unavailable'].includes(record.status) &&
          COUNTS.every(
            (key) =>
              record[key] === null ||
              (Number.isSafeInteger(record[key]) && record[key] >= 0)
          ) &&
          (record.status !== 'complete' ||
            COUNTS.every((key) => record[key] !== null)) &&
          (record.status !== 'unavailable' ||
            COUNTS.every((key) => record[key] === null));
        if (!valid) throw new Error('invalid usage record');
        records.push({
          provider: record.provider,
          model: record.model,
          status: record.status,
          ...Object.fromEntries(COUNTS.map((key) => [key, record[key]])),
          ...(record.diagnostics?.version === 1
            ? { diagnostics: record.diagnostics }
            : {}),
        });
      })().catch(() =>
        usageWarnings.push(
          'Could not read a valid planning-assistant usage record.'
        )
      )
    );
  };
  page.on('console', onConsole);
  return async () => {
    page.off('console', onConsole);
    await Promise.all(pending);
    if (records.length !== 1) {
      usageWarnings.push(
        records.length
          ? 'Duplicate planning-assistant usage records; counts are unavailable.'
          : 'No planning-assistant usage record; counts are unavailable.'
      );
    }
    return {
      usage:
        records.length === 1 && !usageWarnings.length
          ? records[0]
          : unavailableUsage(),
      usageWarnings,
    };
  };
};
