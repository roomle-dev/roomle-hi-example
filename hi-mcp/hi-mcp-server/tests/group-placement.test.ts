import { describe, expect, it } from 'vitest';
import {
  anchorFrameOfRoot,
  anchorVariantKey,
  catalogArticleOf,
  findAnchorRoot,
  isCornerArticle,
  positionInPlacementFrame,
  toRepositioningData,
} from '../group-placement';
import type { AnchorFrame, RepositioningData } from '../group-placement';

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

// the planner's rotationY convention, as in group-placement.ts
const rotated = ([x, y, z]: number[], degrees: number): number[] => {
  const radians = (degrees * Math.PI) / 180;
  return [
    x * Math.cos(radians) + z * Math.sin(radians),
    y,
    -x * Math.sin(radians) + z * Math.cos(radians),
  ];
};

const round = (point: number[]) => point.map((value) => Math.round(value) + 0);

// The group position the planner derives from a repositioning for an anchor at
// the group origin (_applyRepositioningData: G = T(posGroup, posRotationY) ·
// T(rootRelPos, rootRelRotationY) · R_root⁻¹, R_root the identity).
const plannerGroupOf = (repositioning: RepositioningData) => ({
  pos: round(
    rotated(
      repositioning.rootRelPos ?? [0, 0, 0],
      repositioning.posRotationY
    ).map((value, axis) => value + repositioning.posGroup[axis])
  ),
  rotationY:
    (repositioning.posRotationY + (repositioning.rootRelRotationY ?? 0)) % 360,
});

// where a root-local point of the anchor lands in the room
const roomPointOf = (repositioning: RepositioningData, point: number[]) => {
  const group = plannerGroupOf(repositioning);
  return round(
    rotated(point, group.rotationY).map(
      (value, axis) => value + group.pos[axis]
    )
  );
};

// the frame the server learns for a left-handed corner article by probing it
const LEFT_HANDED: AnchorFrame = { point: [-261, 0, 0], turnY: 0 };
const FRAMES = new Map([
  [anchorVariantKey({ articleId: 'corner' }), LEFT_HANDED],
]);

const anchorOf = (roots: any[], rootId?: string) =>
  toRepositioningData(
    roots,
    { ...PLACEMENT, ...(rootId && { rootId }) },
    articles,
    FRAMES
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
      articles[1]
    );
    expect(
      catalogArticleOf(articles, { articleId: 'corner', libraryId: 'lib-2' })
    ).toBeUndefined();
  });
});

describe('isCornerArticle', () => {
  it('recognises a corner article by its flag, its category or its module name', () => {
    expect(isCornerArticle(articles, { articleId: 'corner' })).toBe(true);
    expect(isCornerArticle(articles, { articleId: 'EUERTB90' })).toBe(true);
    expect(isCornerArticle(articles, { articleId: 'corner-by-module' })).toBe(
      true
    );
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
      expect(anchorOf(lShape, start)).toEqual({
        ...PLACEMENT,
        rootId: 'c1',
        rootRelPos: [261, 0, 0],
        rootRelRotationY: 0,
      });
      // at 270 the root-local offset [261, 0, 0] points towards room +z
      expect(plannerGroupOf(anchorOf(lShape, start))).toEqual({
        pos: [4815, 0, -3504],
        rotationY: 270,
      });
    }
  );

  it('anchors the L at the corner article on an empty plan, where the catalog has no flag yet', () => {
    // plan snapshot ps_qid6jsck322rq3g2stszoxzue4uwnxw: the agent placed the L at the back
    // right corner with 270, the server anchored l2 and turned the kitchen by 90 degrees
    const emptyPlanL = lShape.map((candidate) =>
      candidate.id === 'c1'
        ? { ...candidate, articleId: 'EUERTB90' }
        : candidate
    );
    for (const start of [undefined, 'c1', 'l2', 'r2']) {
      expect(anchorOf(emptyPlanL, start)).toEqual({
        ...PLACEMENT,
        rootId: 'c1',
      });
    }
  });

  it('adds no offset and no turn without a learned frame, whatever corner point the catalog has', () => {
    for (const articleId of [
      'corner',
      'corner-at-origin',
      'corner-unmeasured',
    ]) {
      const roots = lShape.map((candidate) =>
        candidate.id === 'c1' ? { ...candidate, articleId } : candidate
      );
      expect(
        toRepositioningData(roots, { ...PLACEMENT, rootId: 'r2' }, articles)
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

// root-local docking vectors as the planner calculates the articles (Furniture_Smith)
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
const HOOD_ROOT = {
  articleId: 'DU',
  dockInfos: [
    { id: 'LeftBottom', start: [-299, 0, 0], end: [-299, 0, 501] },
    { id: 'LeftTop', start: [-299, 741, 0], end: [-299, 741, 501] },
    { id: 'RightBottom', start: [299, 0, 0], end: [299, 0, 501] },
    { id: 'RightTop', start: [299, 741, 0], end: [299, 741, 501] },
  ],
};
const TV_ROOT = {
  articleId: 'SM_TV',
  dockInfos: [
    { id: 'LeftBottom', start: [-635, 0, -40], end: [-635, 0, 1] },
    { id: 'RightBottom', start: [635, 0, -40], end: [635, 0, 1] },
  ],
};
const CABINET_ROOT = {
  articleId: 'UTB60',
  dockInfos: [
    { id: 'LeftBottom', start: [0, 0, 0], end: [0, 0, 561] },
    { id: 'RightTop', start: [600, 820, 0], end: [600, 820, 561] },
    { id: 'BackBottom', start: [0, 0, 0], end: [600, 0, 0] },
  ],
};

describe('anchorFrameOfRoot', () => {
  it.each([
    ['a cabinet: its origin', CABINET_ROOT, { point: [0, 0, 0], turnY: 0 }],
    [
      'a range hood: its left edge',
      HOOD_ROOT,
      { point: [-299, 0, 0], turnY: 0 },
    ],
    [
      'a TV panel: its left edge, 40 mm behind the origin',
      TV_ROOT,
      { point: [-635, 0, -40], turnY: 0 },
    ],
    [
      'a left-handed corner article: its corner point',
      LEFT_HANDED_ROOT,
      { point: [-261, 0, 0], turnY: 0 },
    ],
    [
      'a right-handed corner article: its corner point on the right, turned by 270',
      RIGHT_HANDED_ROOT,
      { point: [1161, 0, 0], turnY: 270 },
    ],
  ])(
    'puts the frame at the docking corner of %s',
    (_case, calculatedRoot, frame) => {
      expect(anchorFrameOfRoot(calculatedRoot)).toEqual(frame);
    }
  );

  it('takes the turn from the one corner vector there is, bottom before top', () => {
    const only = (root: any, id: string) => ({
      dockInfos: root.dockInfos.filter((dockInfo: any) => dockInfo.id === id),
    });
    expect(anchorFrameOfRoot(only(LEFT_HANDED_ROOT, 'LeftBackTop'))).toEqual({
      point: [-261, 820, 0],
      turnY: 0,
    });
    expect(
      anchorFrameOfRoot(only(RIGHT_HANDED_ROOT, 'LeftBackBottom'))
    ).toEqual({
      point: [1161, 0, 0],
      turnY: 270,
    });
  });

  it('is the identity for a root without docking vectors', () => {
    expect(anchorFrameOfRoot({})).toEqual({ point: [0, 0, 0], turnY: 0 });
    expect(anchorFrameOfRoot({ dockInfos: [{ id: 'LeftBottom' }] })).toEqual({
      point: [0, 0, 0],
      turnY: 0,
    });
  });
});

describe('anchorVariantKey', () => {
  it('tells articles, attribute overrides and libraries apart, whatever the attribute order', () => {
    const right = { id: 'mod_CarcaseDirection', value: 'Right' };
    const handle = { id: 'mod_HandleDesign', value: '10' };
    const key = (root: any, libraryId?: string) =>
      anchorVariantKey(root, libraryId);
    expect(key({ articleId: 'UERTB90', attributes: [right, handle] })).toBe(
      key({ articleId: 'UERTB90', attributes: [handle, right] })
    );
    expect(key({ articleId: 'UERTB90', attributes: [right] })).not.toBe(
      key({ articleId: 'UERTB90' })
    );
    expect(key({ articleId: 'UERTB90' })).not.toBe(
      key({ articleId: 'UELTB90' })
    );
    expect(key({ articleId: 'UERTB90' }, 'lib-1')).not.toBe(
      key({ articleId: 'UERTB90' }, 'lib-2')
    );
    expect(key({ articleId: 'UERTB90', libraryId: 'lib-1' }, 'lib-2')).toBe(
      key({ articleId: 'UERTB90' }, 'lib-1')
    );
  });
});

describe('toRepositioningData with an anchor frame', () => {
  const catalog = [
    ...articles,
    {
      articleId: 'UERTB90',
      libraryId: 'lib-1',
      category: 'Kitchen | Base Units | Corner',
    },
    {
      articleId: 'UELTB90',
      libraryId: 'lib-1',
      category: 'Kitchen | Base Units | Corner',
    },
    { articleId: 'DU', libraryId: 'lib-1', category: 'Kitchen | Appliances' },
    { articleId: 'SM_TV', libraryId: 'lib-1', category: 'Living | Wallunits' },
    {
      articleId: 'UTB60',
      libraryId: 'lib-1',
      category: 'Kitchen | Base Units | Storage',
    },
  ];
  const framesOf = (root: any) =>
    new Map([[anchorVariantKey(root), anchorFrameOfRoot(root)]]);
  const repositioningOf = (calculatedRoot: any, placement = PLACEMENT) =>
    toRepositioningData(
      [root('a1', calculatedRoot.articleId)],
      placement,
      catalog,
      framesOf(calculatedRoot)
    );

  it('passes the placement on as it is and hands the frame to the planner as rootRelPos and rootRelRotationY', () => {
    expect(repositioningOf(HOOD_ROOT)).toEqual({
      ...PLACEMENT,
      rootId: 'a1',
      rootRelPos: [299, 0, 0],
      rootRelRotationY: 0,
    });
    expect(repositioningOf(RIGHT_HANDED_ROOT)).toEqual({
      ...PLACEMENT,
      rootId: 'a1',
      rootRelPos: [0, 0, 1161],
      rootRelRotationY: 90,
    });
  });

  it('adds nothing for an anchor whose docking corner is its origin', () => {
    expect(repositioningOf(CABINET_ROOT)).toEqual({
      ...PLACEMENT,
      rootId: 'a1',
    });
  });

  it('turns a right-handed corner article by 90 degrees and puts its corner point into the corner', () => {
    // plan of "test the mcp" 17:48, prompt 04: UELTB90 at 270 stood behind the back wall
    expect(plannerGroupOf(repositioningOf(RIGHT_HANDED_ROOT))).toEqual({
      pos: [3654, 0, -3765],
      rotationY: 0,
    });
  });

  it.each([0, 90, 180, 270])(
    'puts the docking corner of every offset article on posGroup at %d degrees',
    (rotation) => {
      const placement = {
        posGroup: [1000, 0, -2000] as [number, number, number],
        posRotationY: rotation,
      };
      for (const calculatedRoot of [
        HOOD_ROOT,
        TV_ROOT,
        LEFT_HANDED_ROOT,
        RIGHT_HANDED_ROOT,
        CABINET_ROOT,
      ]) {
        const repositioning = repositioningOf(calculatedRoot, placement);
        expect(
          roomPointOf(repositioning, anchorFrameOfRoot(calculatedRoot).point)
        ).toEqual([1000, 0, -2000]);
      }
    }
  );

  it.each([0, 90, 180, 270])(
    'turns the right-handed corner article by 90 degrees more at %d degrees',
    (rotation) => {
      const placement = {
        posGroup: [1000, 0, -2000] as [number, number, number],
        posRotationY: rotation,
      };
      expect(
        plannerGroupOf(repositioningOf(LEFT_HANDED_ROOT, placement)).rotationY
      ).toBe(rotation);
      expect(
        plannerGroupOf(repositioningOf(RIGHT_HANDED_ROOT, placement)).rotationY
      ).toBe((rotation + 90) % 360);
    }
  );

  it('uses the frame of the variant the agent authored, not of the bare article', () => {
    // plan of "test the mcp" 16:04, prompt 04: UERTB90 with the carcase direction Right
    const overridden = {
      ...root('c1', 'UERTB90'),
      attributes: [{ id: 'mod_CarcaseDirection', value: 'Right' }],
    };
    const frames = new Map([
      [anchorVariantKey({ articleId: 'UERTB90' }), LEFT_HANDED],
      [anchorVariantKey(overridden), anchorFrameOfRoot(RIGHT_HANDED_ROOT)],
    ]);
    expect(
      plannerGroupOf(
        toRepositioningData([overridden], PLACEMENT, catalog, frames)
      )
    ).toEqual({
      pos: [3654, 0, -3765],
      rotationY: 0,
    });
    expect(
      plannerGroupOf(
        toRepositioningData([root('c1', 'UERTB90')], PLACEMENT, catalog, frames)
      )
    ).toEqual({
      pos: [4815, 0, -3504],
      rotationY: 270,
    });
  });

  it('serves no frame to another article of the same module', () => {
    const roots = [root('c1', 'UELTB90')];
    expect(
      toRepositioningData(roots, PLACEMENT, catalog, framesOf(LEFT_HANDED_ROOT))
    ).toEqual({
      ...PLACEMENT,
      rootId: 'c1',
    });
  });

  it.each([
    [0, [261, 0, 0]],
    [90, [0, 0, -261]],
    [180, [-261, 0, 0]],
    [270, [0, 0, 261]],
  ])(
    'moves the group origin of a left-handed corner article by its rotated offset at %d degrees',
    (rotation, shift) => {
      const placement = {
        posGroup: [1000, 0, -2000] as [number, number, number],
        posRotationY: rotation,
      };
      expect(
        plannerGroupOf(repositioningOf(LEFT_HANDED_ROOT, placement)).pos
      ).toEqual([1000 + shift[0], 0 + shift[1], -2000 + shift[2]]);
    }
  );
});

describe('positionInPlacementFrame', () => {
  const calculated = (
    calculatedRoot: any,
    articlePos = [0, 0, 0],
    extra: object = {}
  ) => ({
    ...calculatedRoot,
    id: calculatedRoot.articleId,
    articlePos,
    rotationY: 0,
    ...extra,
  });

  it('reports a hood group by its left edge, as it was placed, wherever the planner keeps the origin', () => {
    // just created: the group origin is the hood's centre
    expect(
      positionInPlacementFrame(
        { pos: [2299, 0, -2000], rotationY: 0, roots: [calculated(HOOD_ROOT)] },
        { x: [-299, 299], z: [0, 501], widthMm: 598, depthMm: 501 }
      )
    ).toEqual({
      pos: [2000, 0, -2000],
      rotationY: 0,
      footprint: { x: [0, 598], z: [0, 501], widthMm: 598, depthMm: 501 },
    });
    // reloaded (ps_qouy1f7diacd5ogftqoumxrpdkfu5bb): the origin is the left edge
    expect(
      positionInPlacementFrame(
        {
          pos: [4815, 1530, -2864],
          rotationY: -90,
          roots: [calculated(HOOD_ROOT, [299, 0, 0])],
        },
        { x: [0, 598], z: [0, 501], widthMm: 598, depthMm: 501 }
      )
    ).toEqual({
      pos: [4815, 1530, -2864],
      rotationY: 270,
      footprint: { x: [0, 598], z: [0, 501], widthMm: 598, depthMm: 501 },
    });
  });

  it('reports a right-handed corner kitchen by its corner point and the rotation it was placed with', () => {
    const unit = {
      ...calculated(CABINET_ROOT, [1161, 0, 661], { rotationY: 270 }),
      id: 'u1',
    };
    const corner = {
      ...calculated(RIGHT_HANDED_ROOT),
      contextData: { dockedRoots: [dock('RightBottom', 'u1', 'LeftBottom')] },
    };
    expect(
      positionInPlacementFrame(
        { pos: [2000, 0, -839], rotationY: 90, roots: [unit, corner] },
        { x: [0, 1161], z: [0, 1291], widthMm: 1161, depthMm: 1291 }
      )
    ).toEqual({
      pos: [2000, 0, -2000],
      rotationY: 0,
      footprint: { x: [0, 1291], z: [0, 1161], widthMm: 1291, depthMm: 1161 },
    });
  });

  it('reports a row by its leftmost floor unit and leaves out the generated roots', () => {
    const left = {
      ...calculated(CABINET_ROOT),
      id: 'u1',
      contextData: { dockedRoots: [toTheRight('u2')] },
    };
    const right = { ...calculated(CABINET_ROOT, [600, 0, 0]), id: 'u2' };
    const worktop = {
      id: 'worktop',
      isGenerated: true,
      articlePos: [-10, 820, 0],
      rotationY: 0,
    };
    expect(
      positionInPlacementFrame(
        {
          pos: [4815, 0, -3765],
          rotationY: -90,
          roots: [worktop, right, left],
        },
        { x: [-10, 1210], z: [0, 617], widthMm: 1220, depthMm: 617 }
      )
    ).toEqual({
      pos: [4815, 0, -3765],
      rotationY: 270,
      footprint: { x: [-10, 1210], z: [0, 617], widthMm: 1220, depthMm: 617 },
    });
  });

  it('names the corner article pos belongs to in a group with two of them, as a placement does', () => {
    // a U: c1 (left-handed) at the origin, b1 on its LeftBottom, c2 on b1's LeftBottom
    const c1 = {
      ...calculated(LEFT_HANDED_ROOT),
      id: 'c1',
      contextData: { dockedRoots: [toTheLeft('b1')] },
    };
    const b1 = {
      ...calculated(CABINET_ROOT, [-261, 0, 661], { rotationY: 270 }),
      id: 'b1',
      contextData: { dockedRoots: [toTheLeft('c2')] },
    };
    const c2 = {
      ...calculated(LEFT_HANDED_ROOT, [-261, 0, 1261], { rotationY: 270 }),
      id: 'c2',
    };
    const position = positionInPlacementFrame({
      pos: [4815, 0, -3765],
      rotationY: 270,
      roots: [c1, b1, c2],
    });
    // c1's corner point lies 261 mm off its origin, which the group origin is at
    expect(position).toMatchObject({
      pos: [4815, 0, -4026],
      rotationY: 270,
      rootId: 'c1',
    });
    // one corner article: no rootId, as a placement needs none
    expect(
      positionInPlacementFrame({
        pos: [0, 0, 0],
        rotationY: 0,
        roots: [calculated(LEFT_HANDED_ROOT)],
      })
    ).not.toHaveProperty('rootId');
  });

  it('has no position for a group the planner has not positioned', () => {
    expect(
      positionInPlacementFrame({ roots: [calculated(CABINET_ROOT)] })
    ).toBeUndefined();
    expect(
      positionInPlacementFrame({ pos: [0, 0, 0], roots: [] })
    ).toBeUndefined();
  });
});
