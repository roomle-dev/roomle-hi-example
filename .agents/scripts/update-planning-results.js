#!/usr/bin/env node
/**
 * Updates docs/planning-results.md: one planning of the HI chat per kitchen
 * image of docs/images (kitchen-<n>.png, .jpeg, .jpg or .webp), the image
 * sent alone on the default room of docs/test-prompts.json:
 *
 *   node .agents/scripts/update-planning-results.js [--model <provider>]
 *     [--key-env <NAME>] [--out <dir>] [--dev]
 *
 * Writes <out>/tests.json and runs it with run-hi-mcp-tests.js, which runs
 * every kitchen with run-hi-mcp-prompt.js, saves its plan snapshot and
 * continues an existing --out (stored kitchens are kept). When every kitchen
 * ran without errors (the snapshot is saved even after a failed chat) and has
 * a plan snapshot id and its images, copies the top, perspective and
 * perspective object image of each to docs/images/planning-results/ and
 * rewrites docs/planning-results.md; otherwise it names the kitchens without a
 * planning, leaves the document unchanged and exits 1. Defaults: the model
 * gpt-6-astra, its key in AZURE_GPT_KEY, the out directory
 * .temp/result/planning-results-<local time>/.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, relative, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const REPO_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEST_RUNNER = join(REPO_DIR, '.agents', 'scripts', 'run-hi-mcp-tests.js');
const TEST_PROMPTS = join(REPO_DIR, 'docs', 'test-prompts.json');
const IMAGE_DIR = join(REPO_DIR, 'docs', 'images');
const RESULT_IMAGE_DIR = join(IMAGE_DIR, 'planning-results');
const DOCUMENT = join(REPO_DIR, 'docs', 'planning-results.md');
const RESULT_DIR = join(REPO_DIR, '.temp', 'result');
const PLAN = 'default-room';
const STORE_PLAN_URL =
  'https://www.roomle.com/t/ligna-store-test/kitchens/?id=';
const KITCHEN_IMAGE = /^kitchen-(\d+)\.(png|jpe?g|webp)$/i;
const RESULT_IMAGES = [
  { title: 'Top', file: 'top-image.png', suffix: 'top' },
  {
    title: 'Perspective',
    file: 'perspective-image.png',
    suffix: 'perspective',
  },
  {
    title: 'Perspective object',
    file: 'perspective-object-image.png',
    suffix: 'perspective-object',
  },
];
const USAGE =
  'usage: node .agents/scripts/update-planning-results.js [--model <provider>] [--key-env <NAME>] [--out <dir>] [--dev]';

const parseOptions = () => {
  try {
    const { values } = parseArgs({
      options: {
        model: { type: 'string', default: 'gpt-6-astra' },
        'key-env': { type: 'string', default: 'AZURE_GPT_KEY' },
        out: { type: 'string' },
        dev: { type: 'boolean', default: false },
      },
    });
    return values;
  } catch {
    console.error(USAGE);
    process.exit(1);
  }
};

const localTimestamp = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_` +
    `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
};

const findKitchens = async () =>
  (await readdir(IMAGE_DIR))
    .map((file) => ({ file, match: file.match(KITCHEN_IMAGE) }))
    .filter(({ match }) => match)
    .map(({ file, match }) => ({ number: Number(match[1]), file }))
    .sort((a, b) => a.number - b.number)
    .map(({ number, file }) => ({
      id: `kitchen-${number}`,
      title: `Kitchen ${number}`,
      image: file,
    }));

const runTests = (tests, out, dev) =>
  new Promise((resolve) => {
    const runner = spawn(
      process.execPath,
      [TEST_RUNNER, tests, '--out', out, ...(dev ? ['--dev'] : [])],
      { cwd: REPO_DIR, stdio: 'inherit' }
    );
    runner.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });

const resultImagePath = (kitchen, { suffix }) =>
  join(RESULT_IMAGE_DIR, `${kitchen.id}-${suffix}.png`);

const documentLink = (path) => `./${relative(dirname(DOCUMENT), path)}`;

const kitchenSection = (kitchen) => [
  `## ${kitchen.title}`,
  '',
  `plan: ${STORE_PLAN_URL}${kitchen.planSnapshotId}`,
  '',
  `plan snapshot id: \`${kitchen.planSnapshotId}\``,
  '',
  `![${kitchen.title}](${documentLink(join(IMAGE_DIR, kitchen.image))})`,
  '',
  `| ${RESULT_IMAGES.map(({ title }) => title).join(' | ')} |`,
  `|${RESULT_IMAGES.map(() => '---|').join('')}`,
  `| ${RESULT_IMAGES.map(
    (resultImage) =>
      `![${kitchen.title} ${resultImage.title.toLowerCase()}](${documentLink(resultImagePath(kitchen, resultImage))})`
  ).join(' | ')} |`,
  '',
];

const writeDocument = (kitchens, { model, planSnapshotId, date }) =>
  writeFile(
    DOCUMENT,
    [
      '# Planning Results',
      '',
      `The plannings the HI chat makes from the kitchen images in [images](./images/): each image sent ` +
        `alone, without text, to \`${model}\` on the [default room](./test-prompts.md#default-room) ` +
        `(\`${planSnapshotId}\`), ${date}. The skill ` +
        `[update planning results](../.agents/skills/update-planning-results.md) generates this ` +
        `document; changes by hand are overwritten.`,
      '',
      ...kitchens.flatMap(kitchenSection),
    ].join('\n')
  );

const main = async () => {
  const options = parseOptions();
  const kitchens = await findKitchens();
  if (kitchens.length === 0) {
    throw new Error(`no kitchen-<n> image in ${relative(REPO_DIR, IMAGE_DIR)}`);
  }
  const { plans } = JSON.parse(await readFile(TEST_PROMPTS, 'utf8'));
  const out = resolvePath(
    options.out ??
      join(RESULT_DIR, `planning-results-${localTimestamp(new Date())}`)
  );
  await mkdir(out, { recursive: true });
  const tests = join(out, 'tests.json');
  await writeFile(
    tests,
    JSON.stringify(
      {
        models: [{ provider: options.model, apiKey: `$${options['key-env']}` }],
        plans: { [PLAN]: plans[PLAN] },
        categories: [
          {
            category: 'planning from images',
            tests: kitchens.map(({ id, title, image }) => ({
              id,
              title,
              plan: PLAN,
              image: `docs/images/${image}`,
            })),
          },
        ],
      },
      null,
      2
    )
  );
  const exitCode = await runTests(tests, out, options.dev);
  if (exitCode !== 0) {
    process.exitCode = exitCode;
    return;
  }
  const results = JSON.parse(await readFile(join(out, 'results.json'), 'utf8'));
  const failed = [];
  for (const kitchen of kitchens) {
    const run = results.runs.find(
      ({ model, test }) => model === options.model && test === kitchen.id
    );
    kitchen.runDir = run && join(out, run.dir);
    kitchen.planSnapshotId = run?.planSnapshotId;
    const missing = RESULT_IMAGES.filter(
      ({ file }) => !run || !existsSync(join(kitchen.runDir, file))
    ).map(({ file }) => file);
    if (
      run?.errors.length > 0 ||
      !kitchen.planSnapshotId ||
      missing.length > 0
    ) {
      failed.push(
        `${kitchen.title} (${relative(process.cwd(), kitchen.runDir ?? out)}): ` +
          [
            ...(run?.errors ?? ['no run']),
            ...(kitchen.planSnapshotId ? [] : ['no plan snapshot id']),
            ...(missing.length > 0 ? [`missing ${missing.join(', ')}`] : []),
          ].join(' | ')
      );
    }
  }
  if (failed.length > 0) {
    console.error(
      `[update-planning-results] ${relative(process.cwd(), DOCUMENT)} unchanged - kitchens without a planning:`
    );
    failed.forEach((line) => console.error(`  - ${line}`));
    process.exitCode = 1;
    return;
  }
  await mkdir(RESULT_IMAGE_DIR, { recursive: true });
  for (const kitchen of kitchens) {
    for (const resultImage of RESULT_IMAGES) {
      await copyFile(
        join(kitchen.runDir, resultImage.file),
        resultImagePath(kitchen, resultImage)
      );
    }
  }
  await writeDocument(kitchens, {
    model: options.model,
    planSnapshotId: plans[PLAN],
    date: results.startedAt.slice(0, 10),
  });
  for (const kitchen of kitchens) {
    console.log(
      `[update-planning-results] ${kitchen.title}: ${kitchen.planSnapshotId}`
    );
  }
  console.log(
    `[update-planning-results] ${relative(process.cwd(), DOCUMENT)} updated`
  );
};

main().catch((error) => {
  console.error(`[update-planning-results] ${error.message}`);
  process.exitCode = 1;
});
