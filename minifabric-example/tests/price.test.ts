import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateTotalSum, createCoalescingTaskRunner } from '../src/price.ts';

describe('calculateTotalSum', () => {
  it('takes the total price item of a level', () => {
    assert.equal(
      calculateTotalSum({
        items: [
          { totalPrice: 10 },
          { type: 'Price', priceType: 'Total', totalPrice: 99.99 },
        ],
      }),
      99.99
    );
  });

  it('sums the items in cents, recursing into items without a price', () => {
    assert.equal(
      calculateTotalSum({
        items: [{ totalPrice: 0.1 }, { items: [{ totalPrice: 0.2 }] }],
      }),
      0.3
    );
    assert.equal(
      calculateTotalSum({
        items: [
          { totalPrice: 1 },
          { type: 'Price', priceType: 'Net', totalPrice: 5 },
        ],
      }),
      6
    );
  });

  it('is 0 without items', () => {
    assert.equal(calculateTotalSum(undefined), 0);
    assert.equal(calculateTotalSum({ items: [] }), 0);
  });
});

describe('createCoalescingTaskRunner', () => {
  it('coalesces the triggers during a run into one follow-up run', async () => {
    let runs = 0;
    let release = () => {};
    const run = createCoalescingTaskRunner(async () => {
      runs += 1;
      if (runs === 1) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
    });

    const first = run();
    void run();
    void run();
    release();
    await first;

    assert.equal(runs, 2);
    await run();
    assert.equal(runs, 3);
  });

  it('keeps running after a failed run', async (t) => {
    const error = t.mock.method(console, 'error', () => {});
    let runs = 0;
    const run = createCoalescingTaskRunner(async () => {
      runs += 1;
      throw new Error('price');
    });
    await run();
    await run();
    assert.equal(runs, 2);
    assert.equal(error.mock.callCount(), 2);
  });
});
