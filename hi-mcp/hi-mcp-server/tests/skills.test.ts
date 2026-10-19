import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadSkills,
  readSkillFile,
  skillIndex,
  skillManifest,
  skillUri,
} from '../skills';

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
    const loaded = loadSkills(root);
    expect(loaded.map((skill) => skill.description)).toEqual([
      'Plan an a.\nUse it for a rooms.',
      'Plan a b in two lines.\nA second paragraph.',
      'Plan a c over two lines.',
    ]);
    expect(loaded.map((skill) => skill.frontmatter)).toEqual([
      {
        name: 'a',
        description: 'Plan an a.\nUse it for a rooms.\n',
        metadata: { author: 'x', version: '1' },
      },
      {
        name: 'b',
        description: 'Plan a b in two lines.\nA second paragraph.',
        license: 'MIT',
      },
      { name: 'c', description: 'Plan a c over two lines.' },
    ]);
  });

  it('keeps the chomping of a block scalar and a value on the line after its field, as YAML reads them', () => {
    writeSkill(
      'a',
      'name: a\ndescription: >\n  Plan\n  an a.\n\n\nlicense: MIT'
    );
    writeSkill('b', 'name: b\ndescription: |+\n  Plan a b.\n\n\nlicense: MIT');
    writeSkill('c', 'name: c\ndescription:\n  Plan a c\n  on the next line.');
    expect(
      loadSkills(root).map((skill) => skill.frontmatter.description)
    ).toEqual([
      'Plan an a.\n',
      'Plan a b.\n\n\n',
      'Plan a c on the next line.',
    ]);
  });

  it('keeps every field of the frontmatter', () => {
    writeSkill('a', 'name: a\ndescription: Plan an a.\nlicense: MIT');
    expect(loadSkills(root)[0].frontmatter).toEqual({
      name: 'a',
      description: 'Plan an a.',
      license: 'MIT',
    });
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

describe('skillManifest', () => {
  const sha256 = (text: string) =>
    `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;

  it('lists every file of a skill under its skill:// URI, SKILL.md first', () => {
    writeSkill('a', 'name: a\ndescription: Plan an a.', {
      'references/b.md': '# B\n',
      'references/a.md': '# A\n',
    });
    const [skill] = loadSkills(root);
    expect(skillManifest(skill).map((entry) => entry.uri)).toEqual([
      'skill://a/SKILL.md',
      'skill://a/references/a.md',
      'skill://a/references/b.md',
    ]);
    expect(skillUri('a')).toBe('skill://a/SKILL.md');
  });

  it('digests and measures the text it serves: LF line endings, UTF-8 bytes', () => {
    writeSkill('a', 'name: a\ndescription: Plan an a.', {
      'references/a.md': '# Küche\r\nline\r\n',
    });
    const skills = loadSkills(root);
    const [skillFile, reference] = skillManifest(skills[0]);
    expect(reference).toEqual({
      uri: 'skill://a/references/a.md',
      digest: sha256('# Küche\nline\n'),
      size: 14,
    });
    expect(skillFile.digest).toBe(sha256(readSkillFile(skills, 'a')));
  });
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

  it('tells the agent to plan a kitchen without a named place with its sink near a water connection', () => {
    for (const name of ['kitchen-planning', 'kitchen-planning-fr']) {
      const skill = readSkillFile(loadSkills(), name);
      expect(skill).toContain(
        'When the user does not name a place for the kitchen, plan it so that the sink stands near a water connection of the plan, if the room has one.'
      );
    }
  });

  it('lists every skill on a line of its own in the index', () => {
    const skills = loadSkills();
    const lines = skillIndex(skills).split('\n');
    expect(lines).toHaveLength(SKILLS.length);
    skills.forEach((skill, index) =>
      expect(lines[index]).toBe(`- ${skill.name}: ${skill.description}`)
    );
  });

  it('meets the limits of the Skills extension', () => {
    for (const skill of loadSkills()) {
      const manifest = skillManifest(skill);
      expect(skill.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(skill.name.length).toBeLessThanOrEqual(64);
      expect([...skill.description].length).toBeLessThanOrEqual(1024);
      expect(manifest.length).toBeLessThanOrEqual(512);
      expect(
        manifest.reduce((total, entry) => total + entry.size, 0)
      ).toBeLessThanOrEqual(16 * 1024 * 1024);
    }
  });
});
