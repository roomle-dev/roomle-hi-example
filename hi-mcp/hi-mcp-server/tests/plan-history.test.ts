import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageBridge } from '../page-bridge';
import { connectPlanHistory, PlanHistory } from '../plan-history';
import { attachPage } from './fake-page-socket';

const call = (tool = 'delete-group') => ({
  tool,
  steps: 1,
  groupsBefore: '[]',
  groupsAfter: '[]',
});

describe('PlanHistory', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts the history events and wakes a waiter when the count is reached', async () => {
    const history = new PlanHistory();
    const waiting = history.waitForEvents(2, 1000);
    history.historyChanged();
    history.historyChanged();
    await expect(waiting).resolves.toBe(true);
    expect(history.events).toBe(2);
    await expect(history.waitForEvents(1, 1000)).resolves.toBe(true);

    vi.useFakeTimers();
    const tooLate = history.waitForEvents(3, 2000);
    vi.advanceTimersByTime(2000);
    await expect(tooLate).resolves.toBe(false);
  });

  it('forgets its records when the plan changes outside a tool call', () => {
    const history = new PlanHistory();
    history.record(call());
    history.begin();
    history.historyChanged();
    history.end();
    expect(history.lastDone()).toEqual(call());
    expect(history.changedInPlanner).toBe(false);

    history.historyChanged();
    expect(history.lastDone()).toBeUndefined();
    expect(history.changedInPlanner).toBe(true);
  });

  it('ends redo with a new record and starts over on reset', () => {
    const history = new PlanHistory();
    history.record(call('delete-group'));
    history.markUndone();
    expect(history.lastUndone()?.tool).toBe('delete-group');
    history.markRedone();
    expect(history.lastDone()?.tool).toBe('delete-group');
    history.markUndone();
    history.record(call('place-group'));
    expect(history.lastUndone()).toBeUndefined();

    history.historyChanged();
    history.reset();
    expect(history.lastDone()).toBeUndefined();
    expect(history.changedInPlanner).toBe(false);
  });

  it('wires itself to the page bridge', () => {
    const history = new PlanHistory();
    const bridge = new PageBridge();
    connectPlanHistory(bridge, history);
    const socket = attachPage(bridge);
    history.record(call());
    history.begin();
    socket.receive({
      kind: 'event',
      name: 'historyChange',
      undo: true,
      redo: false,
    });
    history.end();
    expect(history.events).toBe(1);

    attachPage(bridge);
    expect(history.lastDone()).toEqual(call());
    socket.close();
    attachPage(bridge);
    expect(history.lastDone()).toBeUndefined();
  });
});
