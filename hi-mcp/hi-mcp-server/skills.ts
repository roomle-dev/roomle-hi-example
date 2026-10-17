import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A planning skill in the Agent Skills format: a directory with SKILL.md and supporting files. */
export interface Skill {
  name: string;
  description: string;
  frontmatter: Record<string, string>;
  dir: string;
  files: string[];
}

/** A file of a skill as the Skills extension of MCP lists it: its URI, the digest and the size of the served text. */
export interface SkillManifestEntry {
  uri: string;
  digest: string;
  size: number;
}

export const SKILLS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  'skills'
);
export const SKILL_FILE = 'SKILL.md';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
const FIELD = /^([A-Za-z][\w-]*):\s*(.*)$/;
const BLOCK_SCALAR = /^[|>][+-]?$/;

interface Field {
  value: string;
  lines: string[];
}

const unquoted = (value: string): string =>
  /^'.*'$|^".*"$/.test(value) ? value.slice(1, -1) : value;

const folded = (lines: string[]): string =>
  lines
    .join('\n')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.split('\n').join(' '))
    .join('\n');

// The YAML of Agent Skills frontmatter: a plain, quoted, multi-line or block
// scalar per field; a field whose value is nested (metadata) is no scalar.
const scalarOf = ({ value, lines }: Field): string => {
  const content = lines.filter((line) => line.trim());
  if (BLOCK_SCALAR.test(value)) {
    const indent = Math.min(
      ...content.map((line) => line.length - line.trimStart().length)
    );
    const body = lines.map((line) => line.slice(indent));
    return (value.startsWith('|') ? body.join('\n') : folded(body)).trim();
  }
  if (!value) {
    return '';
  }
  return unquoted(
    [value, ...content.map((line) => line.trim())].join(' ').trim()
  );
};

const frontmatterOf = (text: string, file: string): Record<string, string> => {
  const block = FRONTMATTER.exec(text)?.[1];
  if (block === undefined) {
    throw new Error(`${file}: no frontmatter`);
  }
  const fields: Record<string, Field> = {};
  let current: Field | undefined;
  for (const line of block.split(/\r?\n/)) {
    const field = FIELD.exec(line);
    if (field) {
      current = { value: field[2].trim(), lines: [] };
      fields[field[1]] = current;
    } else if (current && /^(\s|$)/.test(line)) {
      current.lines.push(line);
    } else if (!line.startsWith('#')) {
      throw new Error(`${file}: the frontmatter line "${line}" is not a field`);
    }
  }
  return Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [key, scalarOf(field)])
  );
};

const filesBelow = (root: string, dir = root): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .flatMap((entry) =>
      entry.isDirectory()
        ? filesBelow(root, join(dir, entry.name))
        : [relative(root, join(dir, entry.name)).split(sep).join('/')]
    );

/** Reads every skill directory below dir; a broken skill fails the load and names its file. */
export const loadSkills = (dir = SKILLS_DIR): Skill[] =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => {
      const skillDir = join(dir, entry.name);
      const file = join(skillDir, SKILL_FILE);
      const frontmatter = frontmatterOf(readFileSync(file, 'utf8'), file);
      const { name, description } = frontmatter;
      if (name !== entry.name) {
        throw new Error(
          `${file}: the name "${name}" differs from its directory "${entry.name}"`
        );
      }
      if (!description) {
        throw new Error(`${file}: no description`);
      }
      const supporting = filesBelow(skillDir)
        .filter((path) => path !== SKILL_FILE)
        .sort();
      return {
        name,
        description,
        frontmatter,
        dir: skillDir,
        files: [SKILL_FILE, ...supporting],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

/** One line per skill: its name and its description. */
export const skillIndex = (skills: Skill[]): string =>
  skills.map((skill) => `- ${skill.name}: ${skill.description}`).join('\n');

const skillFileText = (skill: Skill, path: string): string =>
  readFileSync(join(skill.dir, path), 'utf8').replace(/\r\n/g, '\n');

/** The URI of a file of a skill in the skill:// scheme of the Skills extension of MCP. */
export const skillUri = (name: string, file: string = SKILL_FILE): string =>
  `skill://${name}/${file}`;

/** Per file of a skill, SKILL.md first: its URI, the SHA-256 digest and the byte size of the text it is served with. */
export const skillManifest = (skill: Skill): SkillManifestEntry[] =>
  skill.files.map((file) => {
    const bytes = Buffer.from(skillFileText(skill, file), 'utf8');
    return {
      uri: skillUri(skill.name, file),
      digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      size: bytes.byteLength,
    };
  });

/** A file of a skill by its path; only a file of the skill's list is read. */
export const readSkillFile = (
  skills: Skill[],
  name: string,
  file: string = SKILL_FILE
): string => {
  const skill = skills.find((candidate) => candidate.name === name);
  if (!skill) {
    throw new Error(
      `Unknown skill "${name}" - the skills are ${skills.map((candidate) => candidate.name).join(', ')}`
    );
  }
  const path = file.replace(/^(\.\/)+/, '');
  if (!skill.files.includes(path)) {
    throw new Error(
      `Unknown file "${file}" of the skill ${name} - its files are ${skill.files.join(', ')}`
    );
  }
  return skillFileText(skill, path);
};

export const skills = loadSkills();
