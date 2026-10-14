import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadSkills, readSkillFile, skillIndex } from '../skills';

let root: string;

const write = (path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

const writeSkill = (
  dir: string,
  frontmatter: string,
  files: Record<string, string> = {}
) => {
  write(`${dir}/SKILL.md`, `---\n${frontmatter}\n---\n\n# ${dir}\n`);
  for (const [path, text] of Object.entries(files)) {
    write(`${dir}/${path}`, text);
  }
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'hi-skills-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('loadSkills', () => {
  it('loads a skill with its name, description and files, SKILL.md first', () => {
    writeSkill('a', 'name: a\ndescription: Plan an a.', {
      'references/b.md': '# B\n',
      'references/a.md': '# A\n',
    });
    writeSkill('b', 'name: b\ndescription: Plan a b.');
    expect(
      loadSkills(root).map(({ name, description, files }) => ({
        name,
        description,
        files,
      }))
    ).toEqual([
      {
        name: 'a',
        description: 'Plan an a.',
        files: ['SKILL.md', 'references/a.md', 'references/b.md'],
      },
      { name: 'b', description: 'Plan a b.', files: ['SKILL.md'] },
    ]);
  });

  it('reads single-quoted and double-quoted descriptions and CRLF line endings', () => {
    write(
      'a/SKILL.md',
      "---\r\nname: a\r\ndescription: 'Plan: an a.'\r\n---\r\n\r\n# A\r\n"
    );
    write('b/SKILL.md', '---\nname: "b"\ndescription: "Plan a \'b\'."\n---\n');
    expect(loadSkills(root).map((skill) => skill.description)).toEqual([
      'Plan: an a.',
      "Plan a 'b'.",
    ]);
  });

  it('reads the YAML of Agent Skills frontmatter: block scalars, multi-line values, comments and nested fields', () => {
    writeSkill(
      'a',
      'name: a\ndescription: |\n  Plan an a.\n  Use it for a rooms.\nmetadata:\n  author: x\n  version: "1"'
    );
    writeSkill(
      'b',
      '# the b skill\nname: b\ndescription: >-\n  Plan a b\n  in two lines.\n\n  A second paragraph.\nlicense: MIT'
    );
    writeSkill('c', 'name: c\ndescription: Plan a c\n  over two lines.');
    expect(loadSkills(root).map((skill) => skill.description)).toEqual([
      'Plan an a.\nUse it for a rooms.',
      'Plan a b in two lines.\nA second paragraph.',
      'Plan a c over two lines.',
    ]);
  });

  it('ignores a file beside the skill directories and hidden files inside a skill', () => {
    write('README.md', '# Skills\n');
    writeSkill('a', 'name: a\ndescription: Plan an a.', {
      '.DS_Store': 'x',
      'references/.hidden.md': 'x',
    });
    write('.git/SKILL.md', 'x');
    expect(loadSkills(root)).toHaveLength(1);
    expect(loadSkills(root)[0].files).toEqual(['SKILL.md']);
  });

  it.each([
    [
      'a name that differs from its directory',
      'name: b\ndescription: x',
      /the name "b" differs from its directory "a"/,
    ],
    ['no description', 'name: a', /no description/],
    [
      'a frontmatter line that is not a field',
      'name: a\ndescription: x\n- y',
      /the frontmatter line "- y" is not a field/,
    ],
    [
      'a nested description',
      'name: a\ndescription:\n  en: x',
      /no description/,
    ],
  ])('fails the load for %s and names the file', (_, frontmatter, message) => {
    writeSkill('a', frontmatter);
    expect(() => loadSkills(root)).toThrow(message);
    expect(() => loadSkills(root)).toThrow(join(root, 'a', 'SKILL.md'));
  });

  it('fails the load for a SKILL.md without frontmatter', () => {
    write('a/SKILL.md', '# A\n');
    expect(() => loadSkills(root)).toThrow(/no frontmatter/);
  });

  it('fails the load for a directory without SKILL.md', () => {
    write('a/references/a.md', '# A\n');
    expect(() => loadSkills(root)).toThrow(/SKILL\.md/);
  });
});

describe('readSkillFile', () => {
  beforeEach(() => {
    writeSkill('a', 'name: a\ndescription: Plan an a.');
    write('a/references/a.md', '# A\r\nline\r\n');
  });

  it('serves SKILL.md by default and a file by its path with LF line endings', () => {
    const skills = loadSkills(root);
    expect(readSkillFile(skills, 'a')).toBe(
      '---\nname: a\ndescription: Plan an a.\n---\n\n# a\n'
    );
    expect(readSkillFile(skills, 'a', 'references/a.md')).toBe('# A\nline\n');
  });

  it('serves a path the way a skill links it, with a leading ./', () => {
    const skills = loadSkills(root);
    expect(readSkillFile(skills, 'a', './references/a.md')).toBe('# A\nline\n');
    expect(readSkillFile(skills, 'a', './SKILL.md')).toBe(
      readSkillFile(skills, 'a')
    );
  });

  it('answers an unknown skill with the skills available', () => {
    writeSkill('b', 'name: b\ndescription: Plan a b.');
    expect(() => readSkillFile(loadSkills(root), 'c')).toThrow(
      'Unknown skill "c" - the skills are a, b'
    );
  });

  it.each(['../../server.ts', '/etc/passwd', 'references', 'references/b.md'])(
    'answers the path %s with the files of the skill',
    (file) => {
      expect(() => readSkillFile(loadSkills(root), 'a', file)).toThrow(
        `Unknown file "${file}" of the skill a - its files are SKILL.md, references/a.md`
      );
    }
  );
});

describe('the skills of the server', () => {
  const ROOM_SKILLS = [
    'kitchen-planning',
    'kitchen-planning-fr',
    'living-room-planning',
  ];
  const SKILLS = ['image-planning', ...ROOM_SKILLS];

  it('holds the image skill alone and the kitchen, the French kitchen and the living-room skill, each with its planning reference and source catalog', () => {
    expect(loadSkills().map(({ name, files }) => ({ name, files }))).toEqual([
      { name: 'image-planning', files: ['SKILL.md'] },
      ...ROOM_SKILLS.map((name) => ({
        name,
        files: [
          'SKILL.md',
          'references/planning-reference.md',
          'references/source-catalog.md',
        ],
      })),
    ]);
  });

  it('serves every reference a room skill links to by the path it links with', () => {
    const skills = loadSkills().filter((skill) =>
      ROOM_SKILLS.includes(skill.name)
    );
    for (const skill of skills) {
      const links = [
        ...readSkillFile(skills, skill.name).matchAll(
          /\]\(((?:\.\/)?references\/[^)]+)\)/g
        ),
      ].map((link) => link[1]);
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(readSkillFile(skills, skill.name, link)).toMatch(/^# /);
      }
    }
  });

  it('tells the agent to plan from an image as close to it as possible, with the image as the brief over the room skills', () => {
    const skill = readSkillFile(loadSkills(), 'image-planning');
    expect(skill).toContain('The image is the brief.');
    expect(skill).toContain('A photo is enough for a concept.');
    expect(skill).toContain('Plan each piece as one group.');
    expect(skill).toContain(
      'Do not change what the image shows for them, unless the user asks for an improved planning.'
    );
    expect(skill).not.toMatch(/\]\(/);
  });

  it('lists every skill on a line of its own in the index', () => {
    const skills = loadSkills();
    const lines = skillIndex(skills).split('\n');
    expect(lines).toHaveLength(SKILLS.length);
    skills.forEach((skill, index) =>
      expect(lines[index]).toBe(`- ${skill.name}: ${skill.description}`)
    );
  });
});
