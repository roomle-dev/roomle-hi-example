#!/usr/bin/env node

/**
 * Generate attributes.md from master-data.json
 * Extracts all attributes and creates a markdown table with columns:
 * id, name, group, image (imageUrl - can be empty), description (desc)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

// No patterns needed - we trust the descriptions from the master data

/**
 * Generate a technically accurate, detailed suggested description for an attribute.
 * Uses the name, description and group to create a comprehensive description.
 * IMPORTANT: The original description is trusted and preserved EXACTLY as-is.
 * Only when missing or equal to name is a new description generated.
 */
function generateSuggestedDescription(attr) {
  const { id, name, desc, group } = attr;

  // Start with the description if it exists
  let suggested = desc || '';

  // Normalize newlines and trim
  suggested = suggested.replace(/\n/g, ' ').trim();

  // If we have a non-empty description that is different from the name,
  // trust it EXACTLY as-is (preserving original capitalization, spacing, punctuation)
  if (suggested && suggested !== name) {
    return suggested;
  }

  // If description equals the name, extend it with group context
  if (suggested === name) {
    return extendDescriptionWithGroup(id, name, group, suggested);
  }

  // If we have an empty description, build from scratch
  if (!suggested) {
    return buildSuggestedDescription(id, name, group);
  }

  return suggested;
}

/**
 * Extend a description that equals the name with group context for better clarity.
 */
function extendDescriptionWithGroup(id, name, group, desc) {
  // Split group by pipe for hierarchy
  const groupParts = group?.split('|') || [];
  const cleanGroupParts = groupParts.map((g) => g.trim()).filter((g) => g);
  const groupContext = cleanGroupParts.join(' ');

  // Start with the description
  let parts = [desc];

  // Add group context if it provides additional meaning
  if (groupContext && groupContext.toLowerCase() !== desc.toLowerCase()) {
    const descLower = desc.toLowerCase();
    const groupLower = groupContext.toLowerCase();

    // Don't add group if it's already in the description
    if (!descLower.includes(groupLower)) {
      parts.unshift(groupContext);
    }
  }

  // Join and clean up
  let suggested = parts.join(' ');

  // Normalize spaces
  suggested = suggested.replace(/\s+\s+/g, ' ').trim();

  // Capitalize first letter of the first word, lowercase the rest
  if (suggested) {
    const words = suggested.split(' ');
    suggested =
      words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
    for (let i = 1; i < words.length; i++) {
      suggested += ' ' + words[i].toLowerCase();
    }
  }

  return suggested;
}

/**
 * Build a suggested description when the original is missing or inadequate.
 */
function buildSuggestedDescription(id, name, group) {
  const cleanId = id?.replace(/^mod_/, '') || '';

  // Split group by pipe for hierarchy
  const groupParts = group?.split('|') || [];
  const cleanGroupParts = groupParts.map((g) => g.trim()).filter((g) => g);
  const groupContext = cleanGroupParts.join(' ');

  // Start with the most meaningful information
  let parts = [];

  // Add group context first if it provides additional meaning
  if (
    groupContext &&
    groupContext.toLowerCase() !== (name || '').toLowerCase()
  ) {
    const nameLower = (name || '').toLowerCase();
    const groupLower = groupContext.toLowerCase();

    // Don't add group if it's already in the name or redundant
    if (!nameLower.includes(groupLower)) {
      parts.push(groupContext);
    }
  }

  // Add the name
  if (name) {
    parts.push(name);
  } else if (cleanId) {
    // Convert camelCase to space-separated words
    const words = cleanId.replace(/([A-Z])/g, ' $1');
    parts.push(words);
  }

  // Join and clean up
  let suggested = parts.join(' ');

  // Normalize spaces
  suggested = suggested.replace(/\s+\s+/g, ' ').trim();

  // Capitalize first letter
  if (suggested) {
    suggested = suggested.charAt(0).toUpperCase() + suggested.slice(1);
  }

  return suggested;
}

// Read master-data.json
const masterDataPath = resolve(
  repoRoot,
  'docs/library-information/master-data.json'
);
const masterData = JSON.parse(readFileSync(masterDataPath, 'utf-8'));

const attributes = masterData.attributes || [];

// Sort attributes by id for consistent output
attributes.sort((a, b) => a.id.localeCompare(b.id));

// Generate markdown table
let markdown = '# Library Attributes\n\n';
markdown +=
  'This document lists all attributes from the Furniture_Smith library master data.\n\n';
markdown += '---\n\n';
markdown += '## Attributes Table\n\n';
markdown += 'Total: ' + attributes.length + ' attributes\n\n';

// Table header
markdown +=
  '| id | name | group | image | description | suggested description |\n';
markdown += '|---|---|---|---|---|---|\n';

// Table rows
for (const attr of attributes) {
  const id = attr.id || '';
  const name = attr.name || '';
  const group = attr.group || '';
  const imageUrl = attr.imageUrl || '';
  const desc = attr.desc || '';

  // Generate suggested description
  const suggested = generateSuggestedDescription(attr);

  // Format image as markdown image if present
  const imageCol = imageUrl ? `![${name}](${imageUrl})` : '';

  // Escape pipes and newlines in content for markdown table
  const escape = (str) =>
    str.replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/\s+/g, ' ');

  markdown += `| ${escape(id)} | ${escape(name)} | ${escape(group)} | ${escape(imageCol)} | ${escape(desc)} | ${escape(suggested)} |\n`;
}

markdown += '\n---\n\n';
markdown += '## Source\n\n';
markdown += 'Generated from: `docs/library-information/master-data.json`\n';
markdown += '\n';
markdown += 'Generated by: `.agents/scripts/generate-attributes-table.js`\n';

// Write output
const outputPath = resolve(repoRoot, 'docs/library-information/attributes.md');
writeFileSync(outputPath, markdown, 'utf-8');

console.log(`Generated ${outputPath} with ${attributes.length} attributes`);
