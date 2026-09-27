#!/usr/bin/env node
/**
 * Generate the Furniture_Smith article catalog
 *
 * Reads docs/library-information/hi-plan-context.json (written by
 * fetch-hi-plan-context.js) and writes docs/library-information/articles.md:
 * one table row per article with id, category, label, dimensions, image,
 * description and suggested description.
 *
 * No dependencies.
 *
 * Usage:
 *   node .agents/scripts/generate-article-catalog.js
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIBRARY_INFORMATION_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/library-information',
);
const INPUT_PATH = join(LIBRARY_INFORMATION_DIR, 'hi-plan-context.json');
const OUTPUT_PATH = join(LIBRARY_INFORMATION_DIR, 'articles.md');

const HEADER = `# Furniture_Smith Article Catalog

This document lists all articles from the Furniture_Smith library as displayed in the Roomle planner catalog with images, labels, descriptions, dimensions, and suggested descriptions.

## Source

Data extracted from \`HiPlanContext\` (\`roomDesignerApi.extended.getExternalObjectPlanContext()\`). The generation process is described in [hi-furniture-smith-article-catalog.md](../../.agents/skills/hi-furniture-smith-article-catalog.md).

Image URLs are hosted on: \`https://tecconfig-preview.homag.cloud/cdn/\`

---

## Articles

| ID | Category | Label | Dimensions | Image | Description | Suggested Description |
| --- | --- | --- | --- | --- | --- | --- |
`;

const SUGGESTED_DESCRIPTION_OVERRIDES = {
  DU: 'Range hood',
  GSP: 'Dishwasher unit',
  SM_TV: 'Wall unit, TV decoration',
};

const GERMAN_TO_ENGLISH = [
  ['Oberschrank', 'Wall cabinet'],
  ['Oberschrankregal', 'Wall cabinet shelf'],
  ['Einlegeböden', 'adjustable shelves'],
  ['feste Zwischenböden', 'fixed shelves'],
  ['Tür', 'door'],
  ['Türen', 'doors'],
  ['Schublade', 'drawer'],
  ['Schubladen', 'drawers'],
  ['Auszug', 'pullout'],
  ['Auszüge', 'pullouts'],
  ['Dunstabzug', 'range hood'],
  ['Kochfeld', 'hob'],
  ['Herd', 'stove'],
  ['Spüle', 'sink'],
  ['Faltklappe', 'folding flap'],
  ['Schwenkklappe', 'hinged flap'],
  ['mit', 'with'],
];

const TYPE_MARKERS = [
  'sideboard',
  'lowboard',
  'tall cabinet',
  'wall cabinet',
  'base cabinet',
  'filler',
  'panel',
  'closet',
];

const TYPE_BY_CATEGORY = [
  ['sideboard', 'Sideboard'],
  ['lowboard', 'Lowboard'],
  ['tall unit', 'Tall cabinet'],
  ['wall unit', 'Wall cabinet'],
  ['base unit', 'Base cabinet'],
  ['filler', 'Filler'],
  ['panel', 'Panel'],
  ['closet', 'Closet cabinet'],
];

const wholeWord = (word) =>
  new RegExp(`(?<![\\p{L}\\p{N}_])${word}(?![\\p{L}\\p{N}_])`, 'giu');

const tidyCommas = (text) =>
  text
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim()
    .replace(/^,+|,+$/g, '');

const suggestDescription = (articleId, desc, category, dimensions) => {
  if (desc.trim() === '') {
    return desc;
  }
  if (SUGGESTED_DESCRIPTION_OVERRIDES[articleId]) {
    return SUGGESTED_DESCRIPTION_OVERRIDES[articleId];
  }
  if (desc.toLowerCase() === 'dunstabzug') {
    return 'Range hood';
  }
  let suggested = desc.replace(/^Fingergrip\s+/i, '');
  for (const [german, english] of GERMAN_TO_ENGLISH) {
    suggested = suggested.replace(wholeWord(german), english);
  }
  suggested = tidyCommas(suggested.replace(/\bwith\s+/gi, ', '))
    .replace(/,?\s*\bdirection (left|right)\b/gi, '')
    .replace(/\bhob cabinet\b/gi, 'cabinet, hob')
    .replace(/\b1 doors\b/gi, '1 door')
    .replace(/\b1 drawers\b/gi, '1 drawer')
    .replace(/\b1 pullouts\b/gi, '1 pullout');
  if (suggested) {
    suggested = suggested[0].toUpperCase() + suggested.slice(1);
  }
  const categoryLower = category.toLowerCase();
  if (!TYPE_MARKERS.some((marker) => suggested.toLowerCase().includes(marker))) {
    const type = TYPE_BY_CATEGORY.find(([marker]) =>
      categoryLower.includes(marker),
    )?.[1];
    if (type) {
      suggested = `${type}, ${suggested}`;
    }
  }
  const suggestedLower = suggested.toLowerCase();
  const height = Number(dimensions.mod_Height);
  if (dimensions.mod_Height && Number.isInteger(height)) {
    if (height < 500 && !/\blow\b/.test(suggestedLower)) {
      suggested = `${suggested}, low`;
    } else if (height >= 2000 && !/\bhigh\b/.test(suggestedLower)) {
      suggested = `${suggested}, high`;
    }
  }
  if (
    (categoryLower.includes('corner') || desc.toLowerCase().includes('corner')) &&
    !suggestedLower.includes('corner')
  ) {
    suggested = `${suggested}, corner`;
  }
  return tidyCommas(suggested);
};

const articleRow = (article) => {
  const dimensions = Object.fromEntries(
    (article.roots?.[0]?.attributes ?? []).map(({ id, value }) => [id, value]),
  );
  const dimensionsText = `L ${dimensions.mod_Depth ?? '?'} mm W ${dimensions.mod_Width ?? '?'} mm H ${dimensions.mod_Height ?? '?'} mm`;
  const category = (article.category ?? '').replaceAll('|', '/');
  const desc = article.desc ?? '';
  const suggested = suggestDescription(
    article.articleId,
    desc,
    category,
    dimensions,
  );
  return `| ${article.articleId} | ${category} | ${article.articleName} | ${dimensionsText} | ![](${article.imageUrl ?? ''}) | ${desc} | ${suggested} |`;
};

const { articles } = JSON.parse(await readFile(INPUT_PATH, 'utf8'));
await writeFile(OUTPUT_PATH, `${HEADER}${articles.map(articleRow).join('\n')}\n`);
console.log(
  `Generated ${relative(process.cwd(), OUTPUT_PATH)} with ${articles.length} articles`,
);
