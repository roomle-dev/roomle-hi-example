import { describe, expect, it } from 'vitest';
import { relationsToDocking } from '../group-layout';

const article = (
  articleId: string,
  category: string,
  height?: number,
  moduleId = 'mr_StorageunitSingle'
) => ({
  articleId,
  category,
  libraryId: 'Furniture_Smith',
  cornerArticle: false,
  rootModules: [
    {
      module: { id: moduleId },
      dimensions:
        height === undefined
          ? []
          : [{ id: 'mod_Height', name: 'Height', value: height }],
      mainAttributes: [],
      dockingVectors: [],
      subModules: [],
    },
  ],
});

const ARTICLES = [
  article('UTB60', 'Kitchen | Base Units | Storage', 720),
  article('US2A60', 'Kitchen | Base Units | Storage', 720),
  article('UHS60', 'Kitchen | Base Units | Storage', 720),
  article('SUB2A90', 'Kitchen | Base Units | Sink', 720),
  article('H2TB60', 'Kitchen | Tall Units | Storage', 2100),
  article('HK60', 'Kitchen | Tall Units | Appliance', 2100),
  article('OTB60', 'Kitchen | Wall Units | Storage', 720),
  article('O2TB90', 'Kitchen | Wall Units | Storage', 720),
  {
    ...article(
      'UERTB90',
      'Kitchen | Base Units | Corner',
      720,
      'mr_CornerunitStraight'
    ),
    cornerArticle: true,
  },
  article('DU', 'Kitchen | Appliances', undefined, 'mr_Hood'),
  article('LWU', 'Living | Wallunits', 400),
];

const compile = (roots: any[], articles: any[] = ARTICLES) => {
  const group = { libraryId: 'Furniture_Smith', roots };
  const corrections: string[] = [];
  const errors = relationsToDocking(
    group,
    articles,
    'posGroups[0]',
    corrections
  );
  return { group, corrections, errors };
};

// Every docking entry as "root.vector -> root.vector mode offset".
const entriesOf = (group: any): string[] =>
  group.roots.flatMap((root: any) =>
    (root.contextData?.dockedRoots ?? []).flatMap((context: any) =>
      context.dockedRoots.map(
        (entry: any) =>
          `${root.id}.${context.ownDockingVector} -> ${entry.id}.${entry.dockingVector}` +
          `${entry.mode ? ` ${entry.mode}` : ''} ${JSON.stringify(entry.offset)}`
      )
    )
  );

const root = (
  id: string,
  articleId: string,
  relation: Record<string, unknown> = {}
) => ({
  id,
  articleId,
  ...relation,
});

describe('relationsToDocking', () => {
  it('docks rightOf and leftOf on the side vectors of the named unit', () => {
    const { group, corrections } = compile([
      root('b1', 'UTB60'),
      root('b2', 'UTB60', { rightOf: 'b1' }),
      root('b0', 'UTB60', { leftOf: 'b1' }),
    ]);
    expect(entriesOf(group)).toEqual([
      'b1.RightBottom -> b2.LeftBottom StartStart [0,0,0]',
      'b1.LeftBottom -> b0.RightBottom StartStart [0,0,0]',
    ]);
    expect(
      group.roots.some(
        (candidate: any) => 'rightOf' in candidate || 'leftOf' in candidate
      )
    ).toBe(false);
    expect(corrections).toEqual([]);
  });

  it('hangs a wall unit beside a tall unit by the Top vectors', () => {
    const { group } = compile([
      root('t1', 'H2TB60'),
      root('w1', 'OTB60', { rightOf: 't1' }),
      root('w0', 'OTB60', { leftOf: 't1' }),
    ]);
    expect(entriesOf(group)).toEqual([
      't1.RightTop -> w1.LeftTop StartStart [0,0,0]',
      't1.LeftTop -> w0.RightTop StartStart [0,0,0]',
    ]);
  });

  it('docks wall units and the range hood beside each other by the Bottom vectors', () => {
    const { group } = compile([
      root('b1', 'UTB60'),
      root('w1', 'OTB60', { above: 'b1' }),
      root('h1', 'DU', { rightOf: 'w1' }),
      root('w2', 'OTB60', { rightOf: 'h1' }),
    ]);
    expect(entriesOf(group)).toContain(
      'w1.RightBottom -> h1.LeftBottom StartStart [0,0,0]'
    );
    expect(entriesOf(group)).toContain(
      'h1.RightBottom -> w2.LeftBottom StartStart [0,0,0]'
    );
  });

  it('stacks onTop by the Top vector of the aligned side, lifted by gapMm', () => {
    const { group } = compile([
      root('t1', 'H2TB60'),
      root('a1', 'UTB60', { onTop: 't1' }),
      root('t2', 'H2TB60', { rightOf: 't1' }),
      root('a2', 'UTB60', { onTop: 't2', align: 'right', gapMm: 20 }),
      root('t3', 'H2TB60', { rightOf: 't2' }),
      root('a3', 'UTB60', { onTop: 't3', align: 'back' }),
    ]);
    expect(entriesOf(group)).toEqual(
      expect.arrayContaining([
        't1.LeftTop -> a1.LeftBottom StartStart [0,0,0]',
        't2.RightTop -> a2.RightBottom StartStart [0,20,0]',
        't3.BackTop -> a3.BackBottom StartStart [0,0,0]',
      ])
    );
  });

  it('stacks a chain of units and puts several units on one back vector', () => {
    const { group, corrections } = compile([
      root('s1', 'UTB60'),
      root('s2', 'UTB60', { onTop: 's1' }),
      root('s3', 'UTB60', { onTop: 's2' }),
      root('b1', 'UTB60', { rightOf: 's1' }),
      root('p1', 'OTB60', { onTop: 'b1', align: 'back' }),
      root('p2', 'OTB60', { onTop: 'b1', align: 'back' }),
    ]);
    expect(entriesOf(group)).toEqual(
      expect.arrayContaining([
        's1.LeftTop -> s2.LeftBottom StartStart [0,0,0]',
        's2.LeftTop -> s3.LeftBottom StartStart [0,0,0]',
        'b1.BackTop -> p1.BackBottom StartStart [0,0,0]',
        'b1.BackTop -> p2.BackBottom StartStart [0,0,0]',
      ])
    );
    expect(corrections).toEqual([]);
  });

  it('hangs a wall unit above a base unit at the top line of the tall units', () => {
    const withTall = compile([
      root('t1', 'H2TB60'),
      root('b1', 'UTB60', { rightOf: 't1' }),
      root('w1', 'OTB60', { above: 'b1' }),
    ]);
    expect(entriesOf(withTall.group)).toContain(
      'b1.LeftTop -> w1.LeftBottom StartStart [0,660,0]'
    );

    const withoutTall = compile([
      root('b1', 'UTB60'),
      root('w1', 'OTB60', { above: 'b1' }),
    ]);
    expect(entriesOf(withoutTall.group)).toEqual([
      'b1.LeftTop -> w1.LeftBottom StartStart [0,660,0]',
    ]);

    const withGap = compile([
      root('b1', 'UTB60'),
      root('w1', 'OTB60', { above: 'b1', gapMm: 500 }),
    ]);
    expect(entriesOf(withGap.group)).toEqual([
      'b1.LeftTop -> w1.LeftBottom StartStart [0,500,0]',
    ]);

    const onTall = compile([
      root('t1', 'H2TB60'),
      root('w1', 'OTB60', { above: 't1' }),
    ]);
    expect(entriesOf(onTall.group)).toEqual([
      't1.LeftTop -> w1.LeftBottom StartStart [0,0,0]',
    ]);
  });

  it('docks behind by the back vectors, without a mode', () => {
    const { group } = compile([
      root('f1', 'UTB60'),
      root('k1', 'UTB60', { behind: 'f1' }),
    ]);
    expect(entriesOf(group)).toEqual([
      'f1.BackBottom -> k1.BackBottom [0,0,0]',
    ]);
  });

  it('writes the entry on the root the planner reaches first, mirrored with the offset negated', () => {
    const { group } = compile([
      root('b1', 'UTB60', { rightOf: 'b2' }),
      root('b2', 'UTB60'),
      root('a1', 'UTB60', { onTop: 'b3', gapMm: 50 }),
      root('b3', 'UTB60', { rightOf: 'b1' }),
    ]);
    expect(entriesOf(group)).toEqual(
      expect.arrayContaining([
        'b1.LeftBottom -> b2.RightBottom StartStart [0,0,0]',
        'b1.RightBottom -> b3.LeftBottom StartStart [0,0,0]',
        'b3.LeftTop -> a1.LeftBottom StartStart [0,50,0]',
      ])
    );
    const mirrored = compile([
      root('a1', 'UTB60', { onTop: 'b1', gapMm: 50 }),
      root('b1', 'UTB60'),
    ]);
    expect(entriesOf(mirrored.group)).toEqual([
      'a1.LeftBottom -> b1.LeftTop StartStart [0,-50,0]',
    ]);
  });

  it('builds an L-shaped and a U-shaped kitchen from corner articles', () => {
    const l = compile([
      root('c1', 'UERTB90'),
      root('r1', 'UTB60', { rightOf: 'c1' }),
      root('l1', 'UTB60', { leftOf: 'c1' }),
      root('l2', 'UTB60', { leftOf: 'l1' }),
    ]);
    expect(entriesOf(l.group)).toEqual([
      'c1.RightBottom -> r1.LeftBottom StartStart [0,0,0]',
      'c1.LeftBottom -> l1.RightBottom StartStart [0,0,0]',
      'l1.LeftBottom -> l2.RightBottom StartStart [0,0,0]',
    ]);
    const u = compile([
      root('c1', 'UERTB90'),
      root('b1', 'UTB60', { rightOf: 'c1' }),
      root('c2', 'UERTB90', { rightOf: 'b1' }),
      root('b2', 'UTB60', { rightOf: 'c2' }),
    ]);
    expect(entriesOf(u.group)).toEqual([
      'c1.RightBottom -> b1.LeftBottom StartStart [0,0,0]',
      'b1.RightBottom -> c2.LeftBottom StartStart [0,0,0]',
      'c2.RightBottom -> b2.LeftBottom StartStart [0,0,0]',
    ]);
  });

  it('compiles the full kitchen of the gpt-6-astra test run to the docking the model wrote', () => {
    const { group, corrections } = compile([
      root('c', 'UERTB90'),
      root('p', 'US2A60', { rightOf: 'c' }),
      root('o', 'UHS60', { rightOf: 'p' }),
      root('b', 'UTB60', { rightOf: 'o' }),
      root('f', 'HK60', { rightOf: 'b' }),
      root('s', 'SUB2A90', { leftOf: 'c' }),
      root('d', 'US2A60', { leftOf: 's' }),
      root('w1', 'OTB60', { above: 'p' }),
      root('h', 'DU', { rightOf: 'w1' }),
      root('w2', 'OTB60', { rightOf: 'h' }),
      root('w3', 'O2TB90', { above: 's' }),
      root('w4', 'OTB60', { above: 'd' }),
    ]);
    // the model's own entries of mcp-test-2026-10-02_13-47-02, with 660 for its 650
    expect(entriesOf(group).sort()).toEqual(
      [
        'c.RightBottom -> p.LeftBottom StartStart [0,0,0]',
        'c.LeftBottom -> s.RightBottom StartStart [0,0,0]',
        'p.RightBottom -> o.LeftBottom StartStart [0,0,0]',
        'p.LeftTop -> w1.LeftBottom StartStart [0,660,0]',
        'o.RightBottom -> b.LeftBottom StartStart [0,0,0]',
        'b.RightBottom -> f.LeftBottom StartStart [0,0,0]',
        's.LeftBottom -> d.RightBottom StartStart [0,0,0]',
        's.LeftTop -> w3.LeftBottom StartStart [0,660,0]',
        'd.LeftTop -> w4.LeftBottom StartStart [0,660,0]',
        'w1.RightBottom -> h.LeftBottom StartStart [0,0,0]',
        'h.RightBottom -> w2.LeftBottom StartStart [0,0,0]',
      ].sort()
    );
    expect(corrections).toEqual([]);
  });

  it('continues the row of its kind for a unit without a relation, and reports it', () => {
    const { group, corrections } = compile([
      root('b1', 'UTB60'),
      root('b2', 'UTB60'),
      root('w1', 'OTB60', { above: 'b1' }),
      root('w2', 'OTB60'),
    ]);
    expect(entriesOf(group)).toEqual(
      expect.arrayContaining([
        'b1.RightBottom -> b2.LeftBottom StartStart [0,0,0]',
        'w1.RightBottom -> w2.LeftBottom StartStart [0,0,0]',
      ])
    );
    expect(corrections).toEqual([
      "posGroups[0]: root 'b2' names no neighbour - it was put rightOf 'b1'",
      "posGroups[0]: root 'w2' names no neighbour - it was put rightOf 'w1'",
    ]);
  });

  it('hangs the first wall unit without a relation beside the tall unit, or above a floor unit', () => {
    const beside = compile([
      root('t1', 'H2TB60'),
      root('b1', 'UTB60', { rightOf: 't1' }),
      root('w1', 'OTB60'),
    ]);
    expect(entriesOf(beside.group)).toContain(
      't1.RightTop -> w1.LeftTop StartStart [0,0,0]'
    );
    const above = compile([
      root('b1', 'UTB60'),
      root('b2', 'UTB60', { rightOf: 'b1' }),
      root('w1', 'OTB60'),
    ]);
    expect(entriesOf(above.group)).toContain(
      'b1.LeftTop -> w1.LeftBottom StartStart [0,660,0]'
    );
    expect(above.corrections).toEqual([
      "posGroups[0]: root 'w1' names no neighbour - it was put above 'b1'",
    ]);
  });

  it('replaces a relation to an unknown root, to the root itself or one that closes a ring', () => {
    const { group, corrections } = compile([
      root('b1', 'UTB60', { leftOf: 'b3' }),
      root('b2', 'UTB60', { rightOf: 'nope' }),
      root('b3', 'UTB60', { rightOf: 'b3' }),
      root('b4', 'UTB60', { rightOf: 'b1' }),
      root('b5', 'UTB60', { rightOf: 'b4' }),
      root('b6', 'UTB60', { rightOf: 'b5' }),
    ]);
    expect(corrections).toEqual(
      expect.arrayContaining([
        `posGroups[0]: root 'b2': rightOf "nope" names no other root of the group - ignored`,
        `posGroups[0]: root 'b3': rightOf "b3" names no other root of the group - ignored`,
        "posGroups[0]: root 'b2' names no neighbour - it was put rightOf 'b1'",
      ])
    );
    const ring = compile([
      root('a', 'UTB60', { leftOf: 'c' }),
      root('b', 'UTB60', { rightOf: 'a' }),
      root('c', 'UTB60', { rightOf: 'b' }),
    ]);
    expect(ring.corrections).toEqual([
      "posGroups[0]: root 'c': rightOf 'b' closes a ring of relations - dropped",
    ]);
    expect(entriesOf(ring.group)).toHaveLength(2);
    expect(entriesOf(group)).toHaveLength(5);
  });

  it('corrects the intent of a floor unit above a unit and of a wall unit beside a base unit', () => {
    const { group, corrections } = compile([
      root('b1', 'UTB60'),
      root('b2', 'UTB60', { above: 'b1' }),
      root('w1', 'OTB60', { rightOf: 'b1' }),
    ]);
    expect(entriesOf(group)).toEqual([
      'b1.RightBottom -> b2.LeftBottom StartStart [0,0,0]',
      'b1.LeftTop -> w1.LeftBottom StartStart [0,660,0]',
    ]);
    expect(corrections).toEqual([
      "posGroups[0]: root 'b2' is no wall unit - it stands rightOf 'b1' instead of above it",
      "posGroups[0]: wall unit 'w1' hangs above the floor unit 'b1' instead of rightOf it",
    ]);
  });

  it('reports behind a corner article, gapMm beside a unit and a second relation field', () => {
    const { group, corrections } = compile([
      root('c1', 'UERTB90'),
      root('b1', 'UTB60', { behind: 'c1' }),
      root('b2', 'UTB60', { rightOf: 'c1', gapMm: 30 }),
      root('b3', 'UTB60', { rightOf: 'b2', leftOf: 'c1' }),
    ]);
    expect(corrections).toEqual([
      "posGroups[0]: root 'b1': a corner article has no back to dock behind - ignored",
      "posGroups[0]: root 'b2': gapMm only lifts a unit onTop or above - ignored",
      "posGroups[0]: root 'b3' names rightOf and leftOf - only rightOf was used",
      "posGroups[0]: root 'b1' names no neighbour - it was put rightOf 'c1'",
    ]);
    expect(entriesOf(group)).toContain(
      'b2.RightBottom -> b3.LeftBottom StartStart [0,0,0]'
    );
  });

  it('puts a floor unit that names a wall unit into the floor row', () => {
    // gpt-5.4-mini, image kitchen 06: one chain from the tall unit over the wall units to the base units
    const { group, corrections } = compile([
      root('t1', 'H2TB60'),
      root('w1', 'OTB60', { rightOf: 't1' }),
      root('w2', 'OTB60', { rightOf: 'w1' }),
      root('b1', 'UTB60', { rightOf: 'w2' }),
      root('b2', 'UTB60', { rightOf: 'b1' }),
    ]);
    expect(entriesOf(group)).toEqual(
      expect.arrayContaining([
        't1.RightTop -> w1.LeftTop StartStart [0,0,0]',
        'w1.RightBottom -> w2.LeftBottom StartStart [0,0,0]',
        't1.RightBottom -> b1.LeftBottom StartStart [0,0,0]',
        'b1.RightBottom -> b2.LeftBottom StartStart [0,0,0]',
      ])
    );
    expect(entriesOf(group)).not.toContain(
      'w2.RightBottom -> b1.LeftBottom StartStart [0,0,0]'
    );
    expect(corrections).toEqual([
      "posGroups[0]: floor unit 'b1' cannot stand rightOf the wall unit 'w2' - it continues the floor row",
      "posGroups[0]: root 'b1' names no neighbour - it was put rightOf 't1'",
    ]);
  });

  it('hangs a range hood beside a tall unit above the floor unit on that side', () => {
    // gpt-6-astra, image kitchen 07: the hood's Top vector is its chimney top
    const { group, corrections } = compile([
      root('t1', 'H2TB60'),
      root('h1', 'DU', { rightOf: 't1' }),
      root('w1', 'OTB60', { rightOf: 'h1' }),
      root('b1', 'UTB60', { rightOf: 't1' }),
    ]);
    expect(entriesOf(group)).toEqual(
      expect.arrayContaining([
        'b1.LeftTop -> h1.LeftBottom StartStart [0,660,0]',
        'h1.RightBottom -> w1.LeftBottom StartStart [0,0,0]',
      ])
    );
    expect(entriesOf(group).join()).not.toContain('h1.LeftTop');
    expect(corrections).toEqual([
      "posGroups[0]: range hood 'h1' hangs above 'b1', rightOf the tall unit 't1'",
    ]);

    const alone = compile([
      root('t1', 'H2TB60'),
      root('h1', 'DU', { leftOf: 't1' }),
    ]);
    expect(entriesOf(alone.group)).toEqual([
      't1.LeftTop -> h1.RightTop StartStart [0,0,0]',
    ]);
    expect(alone.corrections).toEqual([
      "posGroups[0]: range hood 'h1' hangs leftOf the tall unit 't1' by its top edge - put it above the floor unit below it",
    ]);
  });

  it('hangs a range hood without a relation above a base unit, not beside or on the tall unit', () => {
    const { group, corrections } = compile([
      root('t1', 'H2TB60'),
      root('b1', 'UTB60', { rightOf: 't1' }),
      root('h1', 'DU'),
    ]);
    expect(entriesOf(group)).toContain(
      'b1.LeftTop -> h1.LeftBottom StartStart [0,660,0]'
    );
    expect(corrections).toEqual([
      "posGroups[0]: root 'h1' names no neighbour - it was put above 'b1'",
    ]);
  });

  it('counts the Living wall units as wall units', () => {
    const { group } = compile([
      root('b1', 'UTB60'),
      root('l1', 'LWU', { rightOf: 'b1' }),
    ]);
    expect(entriesOf(group)).toEqual([
      'b1.LeftTop -> l1.LeftBottom StartStart [0,980,0]',
    ]);
  });

  it('starts with a floor unit when the list starts with a wall unit', () => {
    const { group } = compile([
      root('w1', 'OTB60', { above: 'b1' }),
      root('b1', 'UTB60'),
    ]);
    expect(group.roots.map((candidate: any) => candidate.id)).toEqual([
      'b1',
      'w1',
    ]);
    expect(entriesOf(group)).toEqual([
      'b1.LeftTop -> w1.LeftBottom StartStart [0,660,0]',
    ]);
  });

  it('leaves a group without relations as it is', () => {
    const roots = [
      {
        id: 'b1',
        articleId: 'UTB60',
        contextData: {
          dockedRoots: [
            {
              ownDockingVector: 'RightBottom',
              dockedRoots: [{ id: 'b2', dockingVector: 'LeftBottom' }],
            },
          ],
        },
      },
      { id: 'b2', articleId: 'UTB60' },
      { id: 'b3', articleId: 'UTB60' },
    ];
    const before = structuredClone(roots);
    const { group, corrections } = compile(roots);
    expect(group.roots).toEqual(before);
    expect(corrections).toEqual([]);
  });

  it('adds related units to a group docked with contextData', () => {
    const { group, corrections } = compile([
      {
        id: 'b1',
        articleId: 'UTB60',
        contextData: {
          dockedRoots: [
            {
              ownDockingVector: 'RightBottom',
              dockedRoots: [{ id: 'b2', dockingVector: 'LeftBottom' }],
            },
          ],
        },
      },
      { id: 'b2', articleId: 'UTB60' },
      root('b3', 'UTB60', { rightOf: 'b2' }),
    ]);
    expect(entriesOf(group)).toEqual([
      'b1.RightBottom -> b2.LeftBottom undefined',
      'b2.RightBottom -> b3.LeftBottom StartStart [0,0,0]',
    ]);
    expect(corrections).toEqual([]);
  });
});
