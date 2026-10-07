#!/usr/bin/env node
/**
 * Renders the report of a "test the mcp" session as a PDF beside it:
 *
 *   node .agents/scripts/render-report-pdf.js <session>/report.md [--out <file.pdf>]
 *
 * The Markdown (GFM tables, the report's <img> tags) becomes HTML with marked;
 * every heading gets the GitHub anchor of its text, so the links of the summary
 * jump to the run sections. The images are embedded as JPEGs of at most 640 px
 * width - the run renders are 1536 px PNGs, about 100 MB for a session. Links
 * to other files of the session stay links. Headless Chromium (Playwright)
 * prints A4 pages, every run section on a new page, with page numbers in the
 * footer (default out: the report's path with .pdf). The page runs without
 * JavaScript and loads nothing from the network: the report quotes prompts and
 * model answers, and Marked keeps raw HTML.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { marked } from 'marked';
import { chromium } from 'playwright';
import sharp from 'sharp';

const USAGE =
  'usage: node .agents/scripts/render-report-pdf.js <report.md> [--out <file.pdf>]';
const IMAGE_WIDTH_PX = 640;
const RUN_HEADING = /^(?:.+ — )?\d{2} /;

const STYLE = `
body { font: 10pt/1.45 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; }
h1 { font-size: 18pt; margin: 0 0 8pt; }
h2 { font-size: 13pt; margin: 14pt 0 6pt; border-bottom: 1px solid #ccc; padding-bottom: 2pt; }
h2.run { break-before: page; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0; font-size: 8.5pt; }
th, td { border: 1px solid #d0d0d0; padding: 3pt 4pt; vertical-align: top; text-align: left; }
th { background: #f2f2f2; }
td img { width: 100%; height: auto; display: block; }
tr, img { break-inside: avoid; }
code { font: 8.5pt Menlo, Consolas, monospace; background: #f4f4f4; padding: 0 2pt; border-radius: 2px; word-break: break-word; }
blockquote { margin: 6pt 0; padding: 4pt 8pt; border-left: 3px solid #bbb; color: #333; background: #fafafa; }
a { color: #0b57d0; text-decoration: none; }
ul { padding-left: 16pt; }
li { margin: 1pt 0; }
`;

const parseOptions = () => {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: { out: { type: 'string' } },
    });
    if (positionals.length !== 1) {
      throw new Error('one report');
    }
    const report = resolvePath(positionals[0]);
    return {
      report,
      out: resolvePath(values.out ?? report.replace(/\.md$/i, '') + '.pdf'),
    };
  } catch {
    console.error(USAGE);
    process.exit(1);
  }
};

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const anchorOf = (text) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');

marked.use({
  renderer: {
    heading({ tokens, depth, text }) {
      const run = depth === 2 && RUN_HEADING.test(text) ? ' class="run"' : '';
      return `<h${depth} id="${anchorOf(text)}"${run}>${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
  },
});

const embeddedImage = async (file) => {
  const jpeg = await sharp(file)
    .flatten({ background: '#ffffff' })
    .resize({ width: IMAGE_WIDTH_PX, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
};

const withEmbeddedImages = async (html, baseDir) => {
  const sources = [
    ...new Set(
      [...html.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1])
    ),
  ].filter((src) => !/^(data|https?):/.test(src));
  let embedded = html;
  for (const src of sources) {
    const file = join(baseDir, decodeURI(src));
    if (!existsSync(file)) {
      console.warn(`[render-report-pdf] missing image ${src}`);
      continue;
    }
    embedded = embedded
      .split(`src="${src}"`)
      .join(`src="${await embeddedImage(file)}"`);
  }
  return { html: embedded, images: sources.length };
};

const main = async () => {
  const { report, out } = parseOptions();
  const markdown = await readFile(report, 'utf8');
  const title = escapeHtml(markdown.match(/^# (.+)$/m)?.[1] ?? 'Report');
  const { html, images } = await withEmbeddedImages(
    await marked.parse(markdown),
    dirname(report)
  );
  const page = `<!doctype html><html><head><meta charset="utf-8">
<base href="${pathToFileURL(dirname(report)).href}/"><title>${title}</title>
<style>${STYLE}</style></head><body>${html}</body></html>`;

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.route('**/*', (route) => route.abort());
    const tab = await context.newPage();
    await tab.setContent(page, { waitUntil: 'load' });
    await tab.pdf({
      path: out,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        `<div style="font-size:7pt;color:#777;width:100%;text-align:center;">${title} · ` +
        'page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
    });
  } finally {
    await browser.close();
  }
  console.log(`[render-report-pdf] ${out} (${images} images)`);
};

main().catch((error) => {
  console.error(`[render-report-pdf] ${error.message}`);
  process.exitCode = 1;
});
