import { describe, expect, it } from 'vitest';
import {
  catalogArticleOf,
  cornerPointOfRoot,
  cornerPointsByArticle,
  findAnchorRoot,
  isCornerArticle,
  toRepositioningData,
} from '../group-placement';

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

const anchorOf = (roots: any[], rootId?: string) =>
  toRepositioningData(
    roots,
    { ...PLACEMENT, ...(rootId && { rootId }) },
    articles,
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
      expect(anchorOf(lShape, start)).toEqual({
        ...PLACEMENT,
        rootId: 'c1',
        rootRelPos: [261, 0, 0],
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

  it('adds no offset for a corner point at the origin or an unmeasured one', () => {
    for (const articleId of ['corner-at-origin', 'corner-unmeasured']) {
      const roots = lShape.map((candidate) =>
        candidate.id === 'c1' ? { ...candidate, articleId } : candidate,
      );
      expect(anchorOf(roots, 'r2')).toEqual({ ...PLACEMENT, rootId: 'c1' });
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

describe('cornerPointOfRoot and cornerPointsByArticle', () => {
  const cornerRoot = {
    articleId: 'EUERTB90',
    dockInfos: [
      { id: 'LeftBackTop', start: [-261, 720, 0], end: [-261, 720, 661] },
      { id: 'LeftBackBottom', start: [-261, 0, 0], end: [-261, 0, 661] },
      { id: 'RightBottom', start: [900, 0, 0], end: [900, 0, 561] },
    ],
  };

  it('reads the root-local corner point from the bottom corner vector', () => {
    expect(cornerPointOfRoot(cornerRoot)).toEqual([-261, 0, 0]);
    expect(cornerPointOfRoot({ dockInfos: [{ id: 'LeftBottom', start: [0, 0, 0] }] })).toBeUndefined();
    expect(cornerPointOfRoot({})).toBeUndefined();
  });

  it('collects one corner point per article from the calculated groups', () => {
    const groups = [
      { roots: [{ articleId: 'unit', dockInfos: [{ id: 'LeftBottom', start: [0, 0, 0] }] }] },
      { roots: [cornerRoot, { ...cornerRoot, dockInfos: [{ id: 'LeftBackBottom', start: [-9, 0, 0] }] }] },
    ];
    expect([...cornerPointsByArticle(groups)]).toEqual([['EUERTB90', [-261, 0, 0]]]);
  });

  it('prefers the corner point from the plan over the catalog and negates it', () => {
    const cornerPoints = new Map([['EUERTB90', [-261, 0, 0] as [number, number, number]]]);
    const emptyPlanL = lShape.map((candidate) =>
      candidate.id === 'c1' ? { ...candidate, articleId: 'EUERTB90' } : candidate,
    );
    expect(toRepositioningData(emptyPlanL, PLACEMENT, articles, cornerPoints)).toEqual({
      ...PLACEMENT,
      rootId: 'c1',
      rootRelPos: [261, 0, 0],
    });
  });
});
