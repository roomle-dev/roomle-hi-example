import type { PageBridge } from './page-bridge';

/** A tool call that changed the plan, as the undo tool reverts it. */
export interface ToolCallRecord {
  tool: string;
  /** The planner steps the call put on the planner's undo history. */
  steps: number;
  /** The planner's raw groups before and after the call, as comparison keys. */
  groupsBefore: string;
  groupsAfter: string;
}

// The server's view of the planner's undo history: the history events the
// page relays and the tool calls that changed the plan, with the planner
// steps each made. An event while no tool call runs is a change the user made
// in the planner - the tool calls below it can no longer be undone safely, so
// they are forgotten.
export class PlanHistory {
  private _events = 0;
  private _inFlight = false;
  private _done: ToolCallRecord[] = [];
  private _undone: ToolCallRecord[] = [];
  private _changedInPlanner = false;
  private _waiters = new Set<() => void>();

  public get events(): number {
    return this._events;
  }

  public get changedInPlanner(): boolean {
    return this._changedInPlanner;
  }

  public historyChanged(): void {
    this._events += 1;
    if (!this._inFlight) {
      this.forget();
      this._changedInPlanner = true;
    }
    for (const wake of this._waiters) {
      wake();
    }
  }

  /** Resolves true once `count` events have arrived, false after the timeout. */
  public waitForEvents(count: number, timeoutMs: number): Promise<boolean> {
    if (this._events >= count) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const finish = (reached: boolean) => {
        clearTimeout(timer);
        this._waiters.delete(wake);
        resolve(reached);
      };
      const wake = () => {
        if (this._events >= count) {
          finish(true);
        }
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      this._waiters.add(wake);
    });
  }

  public begin(): void {
    this._inFlight = true;
  }

  public end(): void {
    this._inFlight = false;
  }

  /** A new change on top of the history ends redo, as in the planner. */
  public record(call: ToolCallRecord): void {
    this._done.push(call);
    this._undone = [];
    this._changedInPlanner = false;
  }

  public lastDone(): ToolCallRecord | undefined {
    return this._done.at(-1);
  }

  public lastUndone(): ToolCallRecord | undefined {
    return this._undone.at(-1);
  }

  public markUndone(): void {
    const call = this._done.pop();
    if (call) {
      this._undone.push(call);
    }
  }

  public markRedone(): void {
    const call = this._undone.pop();
    if (call) {
      this._done.push(call);
    }
  }

  public forget(): void {
    this._done = [];
    this._undone = [];
  }

  /** A page was accepted: its planner history starts empty. */
  public reset(): void {
    this.forget();
    this._changedInPlanner = false;
  }
}

export const planHistory = new PlanHistory();

export const connectPlanHistory = (
  bridge: PageBridge,
  history: PlanHistory
): void => {
  bridge.onHistoryChange(() => history.historyChanged());
  bridge.onPageAccepted(() => history.reset());
};
