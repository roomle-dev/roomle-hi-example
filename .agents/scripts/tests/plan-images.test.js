import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planImageFiles } from '../plan-images.js';

const base64 = (text) => Buffer.from(text).toString('base64');

test('names the images of every get-plan-images call by its turn and its order in the turn', () => {
  const files = planImageFiles([
    {
      turn: 0,
      result: { perspectiveImage: base64('p1'), topImage: base64('t1') },
    },
    {
      turn: 1,
      result: { perspectiveImage: base64('p2'), topImage: base64('t2') },
    },
    {
      turn: 1,
      result: { perspectiveImage: `data:image/png;base64,${base64('p3')}` },
    },
  ]);

  assert.deepEqual(
    files.map(({ turn, file, data }) => [turn, file, data.toString()]),
    [
      [0, 'turn-1-plan-images-1-perspective.png', 'p1'],
      [0, 'turn-1-plan-images-1-top.png', 't1'],
      [1, 'turn-2-plan-images-1-perspective.png', 'p2'],
      [1, 'turn-2-plan-images-1-top.png', 't2'],
      [1, 'turn-2-plan-images-2-perspective.png', 'p3'],
    ]
  );
});

test('leaves out a snapshot answer without images, such as the order data', () => {
  assert.deepEqual(
    planImageFiles([
      { turn: 0, result: { orderData: { groups: [] } } },
      { turn: 0 },
    ]),
    []
  );
});
