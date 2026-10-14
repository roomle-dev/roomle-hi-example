import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A planning skill in the Agent Skills format: a directory with SKILL.md and supporting files. */
export interface Skill {
  name: string;
  description: string;
  dir: string;
  files: string[];
}

export const SKILLS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  'skills'
);
export const SKILL_FILE = 'SKILL.md';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
const FIELD = /^([A-Za-z][\w-]*):\s*(.*)$/;

const unquoted = (value: string): string =>
  /^'.*'$|^".*"$/.test(value) ? value.slice(1, -1) : value;

const frontmatterOf = (text: string, file: string): Record<string, string> => {
  const block = FRONTMATTER.exec(text)?.[1];
  if (block === undefined) {
    throw new Error(`${file}: no frontmatter`);
  }
  const fields: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const field = FIELD.exec(line);
    if (!field) {
      throw new Error(`${file}: the frontmatter line "${line}" is not a field`);
    }
    fields[field[1]] = unquoted(field[2].trim());
  }
  return fields;
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
      const { name, description } = frontmatterOf(
        readFileSync(file, 'utf8'),
        file
      );
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
        dir: skillDir,
        files: [SKILL_FILE, ...supporting],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

/** One line per skill: its name and its description. */
export const skillIndex = (skills: Skill[]): string =>
  skills.map((skill) => `- ${skill.name}: ${skill.description}`).join('\n');

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
  if (!skill.files.includes(file)) {
    throw new Error(
      `Unknown file "${file}" of the skill ${name} - its files are ${skill.files.join(', ')}`
    );
  }
  return readFileSync(join(skill.dir, file), 'utf8').replace(/\r\n/g, '\n');
};

export const skills = loadSkills();
