#!/usr/bin/env node
/**
 * Generate the Furniture_Smith article catalog
 *
 * Reads docs/library-information/article.json (written by
 * fetch-hi-library-data.js) and writes docs/library-information/articles.md:
 * one table row per article with id, category, label, dimensions, image,
 * the FUNCTION sentence of the description and a suggested description,
 * followed by every article's full description.
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
  '../../docs/library-information'
);
const INPUT_PATH = join(LIBRARY_INFORMATION_DIR, 'article.json');
const OUTPUT_PATH = join(LIBRARY_INFORMATION_DIR, 'articles.md');

const HEADER = `# Furniture_Smith Article Catalog

This document lists all articles from the Furniture_Smith library as displayed in the Roomle planner catalog with images, labels, descriptions, dimensions, and suggested descriptions. The table shows the FUNCTION sentence of each description; [Article Descriptions](#article-descriptions) gives every description in full.

## Source

Data extracted from the Furniture_Smith article catalog of the HOMAG backend (sub-articles filtered out). The generation process is described in [hi-furniture-smith-article-catalog.md](../../.agents/skills/hi-furniture-smith-article-catalog.md).

Image URLs are hosted on: \`https://tecconfig-preview.homag.cloud/cdn/\`

---

## Articles

| ID | Category | Label | Dimensions | Image | Description | Suggested Description |
| --- | --- | --- | --- | --- | --- | --- |
`;

const TYPE_MARKER =
  /\b(sideboard|lowboard|filler|panel|closet|wardrobe|(base|wall|tall)\b[^,]*\b(cabinet|unit|carcase|housing))\b/i;

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

const tidyCommas = (text) =>
  text
    .replace(/\s+/g, ' ')
    .replace(/(\s*,)+\s*/g, ', ')
    .trim()
    .replace(/^,+|,+$/g, '');

const descriptionSections = (desc) =>
  desc
    .split(/\n\s*\n/)
    .map((part) => part.match(/^([A-Z_]+):\s*([\s\S]*)$/))
    .filter(Boolean)
    .map(([, label, text]) => [label, text.replace(/\s+/g, ' ').trim()]);

const functionSentence = (desc, sections) =>
  sections.find(([label]) => label === 'FUNCTION')?.[1] ??
  desc.replace(/\s+/g, ' ').trim();

const suggestDescription = (functionText, category, dimensions) => {
  if (functionText === '') {
    return functionText;
  }
  let suggested = tidyCommas(
    functionText.replace(/\.$/, '').replace(/\bwith\s+/gi, ', ')
  );
  suggested = suggested[0].toUpperCase() + suggested.slice(1);
  const categoryLower = category.toLowerCase();
  if (!TYPE_MARKER.test(suggested)) {
    const type = TYPE_BY_CATEGORY.find(([marker]) =>
      categoryLower.includes(marker)
    )?.[1];
    if (type) {
      suggested = `${type}, ${suggested[0].toLowerCase()}${suggested.slice(1)}`;
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
  if (categoryLower.includes('corner') && !suggestedLower.includes('corner')) {
    suggested = `${suggested}, corner`;
  }
  return tidyCommas(suggested);
};

const articleRow = (article) => {
  const dimensions = Object.fromEntries(
    (article.roots?.[0]?.attributes ?? []).map(({ id, value }) => [id, value])
  );
  const dimensionsText = `L ${dimensions.mod_Depth ?? '?'} mm W ${dimensions.mod_Width ?? '?'} mm H ${dimensions.mod_Height ?? '?'} mm`;
  const category = (article.category ?? '').replaceAll('|', '/');
  const desc = article.desc ?? '';
  const functionText = functionSentence(desc, descriptionSections(desc));
  const suggested = suggestDescription(functionText, category, dimensions);
  return `| ${article.articleId} | ${category} | ${article.articleName} | ${dimensionsText} | ![](${article.imageUrl ?? ''}) | ${functionText} | ${suggested} |`;
};

const articleDescription = (article) => {
  const sections = descriptionSections(article.desc ?? '');
  if (sections.length === 0) {
    return '';
  }
  const items = sections
    .map(([label, text]) => `- **${label}:** ${text}`)
    .join('\n');
  return `\n### ${article.articleId}\n\n${items}\n`;
};

const { articles } = JSON.parse(await readFile(INPUT_PATH, 'utf8'));
await writeFile(
  OUTPUT_PATH,
  `${HEADER}${articles.map(articleRow).join('\n')}\n\n## Article Descriptions\n${articles.map(articleDescription).join('')}`
);
console.log(
  `Generated ${relative(process.cwd(), OUTPUT_PATH)} with ${articles.length} articles`
);
