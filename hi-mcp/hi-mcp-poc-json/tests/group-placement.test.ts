import { describe, expect, it } from 'vitest';
import {
  catalogArticleOf,
  cornerFrameOfRoot,
  cornerVariantKey,
  findAnchorRoot,
  isCornerArticle,
  toRepositioningData,
} from '../group-placement';
import type { CornerFrame } from '../group-placement';

const articles = [
  { articleId: 'unit', libraryId: 'lib-1', cornerArticle: false },
  {
    articleId: 'corner',
    libraryId: 'lib-1',
    cornerArticle: true,
    cornerPoint: [-261, 0, 0],
  },
  {
    articleId: 'corner-at-origin',
    libraryId: 'lib-1',
    cornerArticle: true,
    cornerPoint: [0, 0, 0],
  },
  { articleId: 'corner-unmeasured', libraryId: 'lib-1', cornerArticle: true },
  // the catalog of an empty plan: no calculated root yet, so no flag and no corner point
  {
    articleId: 'EUERTB90',
    libraryId: 'lib-1',
    category: 'Kitchen handleless | Base Units | Corner',
    cornerArticle: false,
    rootModules: [{ module: { id: 'mr_CornerunitStraight' } }],
  },
  {
    articleId: 'corner-by-module',
    libraryId: 'lib-1',
    category: 'Kitchen | Base Units | Storage',
    rootModules: [{ module: { id: 'mr_CornerunitStraight' } }],
  },
];

const PLACEMENT = {
  posGroup: [4815, 0, -3765] as [number, number, number],
  posRotationY: 270,
};

const dock = (ownDockingVector: string, id: string, dockingVector: string) => ({
  ownDockingVector,
  dockedRoots: [{ id, dockingVector, mode: 'StartStart', offset: [0, 0, 0] }],
});
const toTheRight = (id: string) => dock('RightBottom', id, 'LeftBottom');
const toTheLeft = (id: string) => dock('LeftBottom', id, 'RightBottom');
const onTop = (id: string) => dock('LeftTop', id, 'LeftBottom');
const backToBack = (id: string) => dock('BackBottom', id, 'BackBottom');

const root = (id: string, articleId = 'unit', ...entries: object[]) => ({
  id,
  articleId,
  ...(entries.length > 0 && { contextData: { dockedRoots: entries } }),
});

// the frame the server learns for a left-handed corner article by probing it
const LEFT_HANDED: CornerFrame = { point: [-261, 0, 0], turnY: 0 };
const FRAMES = new Map([[cornerVariantKey({ articleId: 'corner' }), LEFT_HANDED]]);

const anchorOf = (roots: any[], rootId?: string) =>
  toRepositioningData(
    roots,
    { ...PLACEMENT, ...(rootId && { rootId }) },
    articles,
    FRAMES,
  );

// the L of the authoring rules' example 3
const lShape = [
  root('c1', 'corner', toTheRight('r1'), toTheLeft('l1')),
  root('r1', 'unit', toTheRight('r2')),
  root('r2'),
  root('l1', 'unit', toTheLeft('l2')),
  root('l2'),
];

describe('catalogArticleOf', () => {
  it('finds the article by id and, when the root names one, by library', () => {
    expect(catalogArticleOf(articles, { articleId: 'corner' })).toBe(
      articles[1],
    );
    expect(
      catalogArticleOf(articles, { articleId: 'corner', libraryId: 'lib-2' }),
    ).toBeUndefined();
  });
});

describe('isCornerArticle', () => {
  it('recognises a corner article by its flag, its category or its module name', () => {
    expect(isCornerArticle(articles, { articleId: 'corner' })).toBe(true);
    expect(isCornerArticle(articles, { articleId: 'EUERTB90' })).toBe(true);
    expect(isCornerArticle(articles, { articleId: 'corner-by-module' })).toBe(true);
    expect(isCornerArticle(articles, { articleId: 'unit' })).toBe(false);
    expect(isCornerArticle(articles, { articleId: 'unknown' })).toBe(false);
  });
});

describe('findAnchorRoot', () => {
  const notCorner = () => false;

  it('anchors a single root at itself', () => {
    expect(findAnchorRoot([root('u1')], undefined, notCorner).id).toBe('u1');
  });

  it('terminates on a cyclic docking', () => {
    const roots = [
      root('u1', 'unit', toTheRight('u2')),
      root('u2', 'unit', toTheRight('u1')),
    ];
    expect(['u1', 'u2']).toContain(findAnchorRoot(roots, 'u1', notCorner).id);
  });
});

describe('toRepositioningData', () => {
  const row = [
    root('u1', 'unit', toTheRight('u2')),
    root('u2', 'unit', toTheRight('u3')),
    root('u3'),
  ];

  it('passes posGroup and posRotationY through and adds no offset for a straight unit', () => {
    expect(anchorOf([root('u1')])).toEqual({ ...PLACEMENT, rootId: 'u1' });
  });

  it('anchors a row at its leftmost root, from the first root or from rootId', () => {
    expect(anchorOf(row).rootId).toBe('u1');
    expect(anchorOf(row, 'u3').rootId).toBe('u1');
  });

  it('anchors a row authored and listed right to left at its leftmost root', () => {
    const rightToLeft = [
      root('u3', 'unit', toTheLeft('u2')),
      root('u2', 'unit', toTheLeft('u1')),
      root('u1'),
    ];
    expect(anchorOf(rightToLeft).rootId).toBe('u1');
  });

  it('reads the reciprocal entries a returned group carries', () => {
    const reciprocal = [
      root('u1', 'unit', toTheRight('u2')),
      root('u2', 'unit', toTheLeft('u1'), toTheRight('u3')),
      root('u3', 'unit', toTheLeft('u2')),
    ];
    expect(anchorOf(reciprocal, 'u2').rootId).toBe('u1');
  });

  it('steps down from a wall unit to the base row below it', () => {
    const kitchen = [
      root('b1', 'unit', toTheRight('b2'), onTop('w1')),
      root('b2', 'unit', onTop('w2')),
      root('w1'),
      root('w2'),
    ];
    expect(anchorOf(kitchen, 'w2').rootId).toBe('b1');
  });

  it('steps down from a wall-unit row where only one unit sits on a base unit', () => {
    const kitchen = [
      root('w2'),
      root('w1', 'unit', toTheRight('w2')),
      root('b1', 'unit', onTop('w1')),
    ];
    expect(anchorOf(kitchen).rootId).toBe('b1');
  });

  it('anchors a group of wall units only at its leftmost wall unit', () => {
    const wallUnits = [root('w1', 'unit', toTheRight('w2')), root('w2')];
    expect(anchorOf(wallUnits, 'w2').rootId).toBe('w1');
  });

  it.each(['c1', 'r1', 'r2', 'l1', 'l2'])(
    'anchors the L at the corner article by its corner point, from %s',
    (start) => {
      // at 270 the root-local offset [261, 0, 0] points towards room +z
      expect(anchorOf(lShape, start)).toEqual({
        posGroup: [4815, 0, -3504],
        posRotationY: 270,
        rootId: 'c1',
      });
    },
  );

  it('anchors the L at the corner article on an empty plan, where the catalog has no flag yet', () => {
    // plan snapshot ps_qid6jsck322rq3g2stszoxzue4uwnxw: the agent placed the L at the back
    // right corner with 270, the server anchored l2 and turned the kitchen by 90 degrees
    const emptyPlanL = lShape.map((candidate) =>
      candidate.id === 'c1' ? { ...candidate, articleId: 'EUERTB90' } : candidate,
    );
    for (const start of [undefined, 'c1', 'l2', 'r2']) {
      expect(anchorOf(emptyPlanL, start)).toEqual({ ...PLACEMENT, rootId: 'c1' });
    }
  });

  it('adds no offset and no turn without a learned frame, whatever corner point the catalog has', () => {
    for (const articleId of ['corner', 'corner-at-origin', 'corner-unmeasured']) {
      const roots = lShape.map((candidate) =>
        candidate.id === 'c1' ? { ...candidate, articleId } : candidate,
      );
      expect(
        toRepositioningData(roots, { ...PLACEMENT, rootId: 'r2' }, articles),
      ).toEqual({ ...PLACEMENT, rootId: 'c1' });
    }
  });

  it('anchors a U at the corner article met first, walking left before right', () => {
    const uShape = [
      root('c1', 'corner', toTheRight('r1'), toTheLeft('b1')),
      root('r1'),
      root('b1', 'unit', toTheLeft('c2')),
      root('c2', 'corner', toTheLeft('l1')),
      root('l1'),
    ];
    expect(anchorOf(uShape).rootId).toBe('c1');
    expect(anchorOf(uShape, 'c2').rootId).toBe('c2');
    expect(anchorOf(uShape, 'b1').rootId).toBe('c2');
    expect(anchorOf(uShape, 'r1').rootId).toBe('c1');
    expect(anchorOf(uShape, 'l1').rootId).toBe('c2');
  });

  it('stays in the row of the start root in an island and never crosses back to back', () => {
    const island = [
      root('f1', 'unit', toTheRight('f2'), backToBack('k1')),
      root('f2'),
      root('k1', 'unit', toTheRight('k2')),
      root('k2'),
    ];
    expect(anchorOf(island, 'f2').rootId).toBe('f1');
    expect(anchorOf(island, 'k2').rootId).toBe('k1');
  });

  it('ignores docking entries naming roots that are not in the group', () => {
    const roots = [
      root('u1', 'unit', toTheLeft('worktop'), onTop('toekick')),
      root('u2', 'unit', toTheLeft('u1')),
    ];
    expect(anchorOf(roots, 'u2').rootId).toBe('u1');
  });
});

// root-local docking vectors of the corner articles as the planner calculates them
const LEFT_HANDED_ROOT = {
  articleId: 'UERTB90',
  dockInfos: [
    { id: 'LeftBackBottom', start: [-261, 0, 0], end: [-261, 0, 661] },
    { id: 'LeftBackTop', start: [-261, 820, 0], end: [-261, 820, 661] },
    { id: 'RightBottom', start: [900, 0, 0], end: [900, 0, 561] },
    { id: 'RightBackBottom', start: [-261, 0, 0], end: [900, 0, 0] },
    { id: 'LeftBottom', start: [-261, 0, 661], end: [300, 0, 661] },
  ],
};
const RIGHT_HANDED_ROOT = {
  articleId: 'UELTB90',
  dockInfos: [
    { id: 'LeftBottom', start: [0, 0, 0], end: [0, 0, 561] },
    { id: 'RightBackBottom', start: [1161, 0, 0], end: [1161, 0, 661] },
    { id: 'LeftBackBottom', start: [1161, 0, 0], end: [0, 0, 0] },
    { id: 'LeftBackTop', start: [1161, 820, 0], end: [0, 820, 0] },
    { id: 'RightBottom', start: [1161, 0, 661], end: [600, 0, 661] },
  ],
};

// the planner's rotationY convention, as in group-placement.ts
const rotated = ([x, y, z]: number[], degrees: number): number[] => {
  const radians = (degrees * Math.PI) / 180;
  return [
    x * Math.cos(radians) + z * Math.sin(radians),
    y,
    -x * Math.sin(radians) + z * Math.cos(radians),
  ];
};

describe('cornerFrameOfRoot', () => {
  it('reads the corner point and no turn from a left-handed corner article', () => {
    expect(cornerFrameOfRoot(LEFT_HANDED_ROOT)).toEqual({ point: [-261, 0, 0], turnY: 0 });
  });

  it('reads the corner point on the right and a turn of 270 from a right-handed one', () => {
    expect(cornerFrameOfRoot(RIGHT_HANDED_ROOT)).toEqual({ point: [1161, 0, 0], turnY: 270 });
  });

  it('takes the frame from the one corner vector there is, bottom before top', () => {
    const only = (root: any, id: string) => ({
      dockInfos: root.dockInfos.filter((dockInfo: any) => dockInfo.id === id),
    });
    expect(cornerFrameOfRoot(only(LEFT_HANDED_ROOT, 'LeftBackTop'))).toEqual({
      point: [-261, 820, 0],
      turnY: 0,
    });
    expect(cornerFrameOfRoot(only(RIGHT_HANDED_ROOT, 'LeftBackBottom'))).toEqual({
      point: [1161, 0, 0],
      turnY: 270,
    });
  });

  it('has no frame without corner vectors', () => {
    expect(cornerFrameOfRoot({ dockInfos: [{ id: 'LeftBottom', start: [0, 0, 0], end: [0, 0, 561] }] })).toBeUndefined();
    expect(cornerFrameOfRoot({})).toBeUndefined();
  });
});

describe('cornerVariantKey', () => {
  it('tells articles, attribute overrides and libraries apart, whatever the attribute order', () => {
    const right = { id: 'mod_CarcaseDirection', value: 'Right' };
    const handle = { id: 'mod_HandleDesign', value: '10' };
    const key = (root: any, libraryId?: string) => cornerVariantKey(root, libraryId);
    expect(key({ articleId: 'UERTB90', attributes: [right, handle] })).toBe(
      key({ articleId: 'UERTB90', attributes: [handle, right] }),
    );
    expect(key({ articleId: 'UERTB90', attributes: [right] })).not.toBe(key({ articleId: 'UERTB90' }));
    expect(key({ articleId: 'UERTB90' })).not.toBe(key({ articleId: 'UELTB90' }));
    expect(key({ articleId: 'UERTB90' }, 'lib-1')).not.toBe(key({ articleId: 'UERTB90' }, 'lib-2'));
    expect(key({ articleId: 'UERTB90', libraryId: 'lib-1' }, 'lib-2')).toBe(key({ articleId: 'UERTB90' }, 'lib-1'));
  });
});

describe('toRepositioningData with a corner frame', () => {
  const catalog = [
    ...articles,
    { articleId: 'UERTB90', libraryId: 'lib-1', category: 'Kitchen | Base Units | Corner' },
    { articleId: 'UELTB90', libraryId: 'lib-1', category: 'Kitchen | Base Units | Corner' },
  ];
  const framesOf = (root: any) =>
    new Map([[cornerVariantKey(root), cornerFrameOfRoot(root) as CornerFrame]]);

  it('turns a right-handed corner article by 90 degrees and puts its corner point into the corner', () => {
    // plan of "test the mcp" 17:48, prompt 04: UELTB90 at 270 stood behind the back wall
    const roots = [root('c1', 'UELTB90')];
    expect(toRepositioningData(roots, PLACEMENT, catalog, framesOf(RIGHT_HANDED_ROOT))).toEqual({
      posGroup: [3654, 0, -3765],
      posRotationY: 0,
      rootId: 'c1',
    });
  });

  it.each([0, 90, 180, 270])(
    'puts the corner point of either hand into the corner at %d degrees, the right-handed one turned by 90',
    (rotation) => {
      const placement = { posGroup: [1000, 0, -2000] as [number, number, number], posRotationY: rotation };
      for (const [cornerRoot, turn] of [[LEFT_HANDED_ROOT, 0], [RIGHT_HANDED_ROOT, 90]] as const) {
        const repositioning = toRepositioningData(
          [root('c1', cornerRoot.articleId)],
          placement,
          catalog,
          framesOf(cornerRoot),
        );
        expect(repositioning.posRotationY).toBe((rotation + turn) % 360);
        const frame = cornerFrameOfRoot(cornerRoot) as CornerFrame;
        const cornerInRoom = rotated(frame.point, repositioning.posRotationY).map(
          (value, axis) => Math.round(value + repositioning.posGroup[axis]),
        );
        expect(cornerInRoom).toEqual([1000, 0, -2000]);
      }
    },
  );

  it('uses the frame of the variant the agent authored, not of the bare article', () => {
    // plan of "test the mcp" 16:04, prompt 04: UERTB90 with the carcase direction Right
    const overridden = {
      ...root('c1', 'UERTB90'),
      attributes: [{ id: 'mod_CarcaseDirection', value: 'Right' }],
    };
    const frames = new Map([
      [cornerVariantKey({ articleId: 'UERTB90' }), LEFT_HANDED],
      [cornerVariantKey(overridden), cornerFrameOfRoot(RIGHT_HANDED_ROOT) as CornerFrame],
    ]);
    expect(toRepositioningData([overridden], PLACEMENT, catalog, frames)).toEqual({
      posGroup: [3654, 0, -3765],
      posRotationY: 0,
      rootId: 'c1',
    });
    expect(toRepositioningData([root('c1', 'UERTB90')], PLACEMENT, catalog, frames)).toEqual({
      posGroup: [4815, 0, -3504],
      posRotationY: 270,
      rootId: 'c1',
    });
  });

  it('serves no frame to another article of the same module', () => {
    const roots = [root('c1', 'UELTB90')];
    expect(toRepositioningData(roots, PLACEMENT, catalog, framesOf(LEFT_HANDED_ROOT))).toEqual({
      ...PLACEMENT,
      rootId: 'c1',
    });
  });

  it.each([
    [0, [261, 0, 0]],
    [90, [0, 0, -261]],
    [180, [-261, 0, 0]],
    [270, [0, 0, 261]],
  ])('adds the rotated origin offset of a left-handed corner article at %d degrees', (rotation, shift) => {
    const roots = [root('c1', 'UERTB90')];
    const placement = { posGroup: [1000, 0, -2000] as [number, number, number], posRotationY: rotation };
    expect(toRepositioningData(roots, placement, catalog, framesOf(LEFT_HANDED_ROOT)).posGroup).toEqual([
      1000 + shift[0],
      0 + shift[1],
      -2000 + shift[2],
    ]);
  });
});
