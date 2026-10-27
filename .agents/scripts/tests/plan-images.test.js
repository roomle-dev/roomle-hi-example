import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planImageFiles } from '../plan-images.js';

const base64 = (text) => Buffer.from(text).toString('base64');

const imagesResult = (...images) => imagesResultOf('image/png', ...images);

const imagesResultOf = (mimeType, ...images) => ({
  content: [
    { type: 'text', text: 'Image 1: …' },
    ...images.map((image) => ({
      type: 'image',
      data: base64(image),
      mimeType,
    })),
  ],
});

test('names the images of every get-plan-images call by its turn and its order in the turn', () => {
  const files = planImageFiles([
    { turn: 0, result: imagesResult('o1', 't1') },
    { turn: 1, result: imagesResult('o2', 't2') },
    { turn: 1, result: imagesResult('o3', 't3') },
  ]);

  assert.deepEqual(
    files.map(({ turn, file, data }) => [turn, file, data.toString()]),
    [
      [0, 'turn-1-plan-images-1-perspective-object.png', 'o1'],
      [0, 'turn-1-plan-images-1-top.png', 't1'],
      [1, 'turn-2-plan-images-1-perspective-object.png', 'o2'],
      [1, 'turn-2-plan-images-1-top.png', 't2'],
      [1, 'turn-2-plan-images-2-perspective-object.png', 'o3'],
      [1, 'turn-2-plan-images-2-top.png', 't3'],
    ]
  );
});

test('names a JPEG image .jpg and a PNG image .png', () => {
  const files = planImageFiles([
    { turn: 0, result: imagesResultOf('image/jpeg', 'o1', 't1') },
    { turn: 0, result: imagesResultOf('image/png', 'o2', 't2') },
  ]);

  assert.deepEqual(
    files.map(({ file, data }) => [file, data.toString()]),
    [
      ['turn-1-plan-images-1-perspective-object.jpg', 'o1'],
      ['turn-1-plan-images-1-top.jpg', 't1'],
      ['turn-1-plan-images-2-perspective-object.png', 'o2'],
      ['turn-1-plan-images-2-top.png', 't2'],
    ]
  );
});

test('names the only image of a plan without groups the top view', () => {
  const files = planImageFiles([{ turn: 0, result: imagesResult('t1') }]);

  assert.deepEqual(
    files.map(({ file, data }) => [file, data.toString()]),
    [['turn-1-plan-images-1-top.png', 't1']]
  );
});

test('leaves out a result without images, such as an error', () => {
  assert.deepEqual(
    planImageFiles([
      {
        turn: 0,
        result: {
          content: [{ type: 'text', text: '{"error":"No images available"}' }],
        },
      },
      { turn: 0 },
    ]),
    []
  );
});
