export const installModelRequestPacing = async (page, intervalMs) => {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 0) {
    throw new Error('HI_MCP_REQUEST_INTERVAL_MS must be a nonnegative integer');
  }
  if (intervalMs === 0) return;
  await page.addInitScript((interval) => {
    if (window !== window.top) return;
    const originalFetch = window.fetch.bind(window);
    let nextRequestAt = 0;
    window.hiModelRequestPacing = [];
    window.fetch = async (input, init) => {
      const url = new URL(
        typeof input === 'string' || input instanceof URL ? input : input.url,
        location.href
      );
      if (
        init?.method === 'POST' &&
        /\/openai\/v1\/(responses|chat\/completions)$/.test(url.pathname)
      ) {
        const start = performance.now();
        const wait = Math.max(0, nextRequestAt - start);
        nextRequestAt = Math.max(start, nextRequestAt) + interval;
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        window.hiModelRequestPacing.push({ waitMs: performance.now() - start });
      }
      return originalFetch(input, init);
    };
  }, intervalMs);
};
