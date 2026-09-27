#!/usr/bin/env node
/**
 * Extract Dominant Color from Image by Analyzing Actual Pixels
 * 
 * This script downloads images from URLs and extracts the dominant color by
 * ACTUALLY analyzing the image pixel data using Sharp library.
 * 
 * This is NOT guessing from names - it CALCULATES from the actual image.
 * 
 * Algorithm:
 * 1. Download the image from URL
 * 2. Resize to 100x100px (maintains color distribution)
 * 3. Get raw pixel data
 * 4. Quantize colors by grouping similar colors
 * 5. Find the most frequent color
 * 
 * Dependencies:
 *   - sharp: Required for image processing (npm install sharp)
 * 
 * Usage:
 *   node extract-dominant-color-from-image.js <imageUrl>
 *   node extract-dominant-color-from-image.js --all-from-context [--output colors.txt]
 *   node extract-dominant-color-from-image.js --verify <imageUrl> [name]
 * 
 * Examples:
 *   node extract-dominant-color-from-image.js "https://.../152_cloudyblue.jpg"
 *   node extract-dominant-color-from-image.js --all-from-context
 */

import sharp from 'sharp';
import fetch from 'node-fetch';
import { readFile, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';

// ============================================================================
// CORE COLOR EXTRACTION FUNCTION
// ============================================================================

/**
 * Download image from URL
 */
async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Extract dominant color from image buffer by analyzing actual pixels
 */
async function extractDominantColor(imageBuffer) {
  // Resize to 100x100 for faster processing while maintaining color distribution
  const { data, info } = await sharp(imageBuffer)
    .resize(100, 100, {
      fit: 'fill'
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  // Sample pixels across the image
  // We'll use a grid pattern to get representative samples
  const sampleStep = Math.max(1, Math.floor(100 / 20)); // ~20x20 = 400 samples
  const colorCounts = {};
  const tolerance = 20; // Color similarity tolerance (0-255)
  
  for (let y = 0; y < 100; y += sampleStep) {
    for (let x = 0; x < 100; x += sampleStep) {
      const offset = (y * 100 + x) * (info.channels === 4 ? 4 : 3);
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      
      // Quantize color by rounding to nearest 16 (reduces from 16.7M to ~4000 colors)
      const qr = Math.floor(r / 16) * 16;
      const qg = Math.floor(g / 16) * 16;
      const qb = Math.floor(b / 16) * 16;
      const quantizedKey = `${qr},${qg},${qb}`;
      
      colorCounts[quantizedKey] = (colorCounts[quantizedKey] || 0) + 1;
    }
  }
  
  // Find the most frequent quantized color
  let maxCount = 0;
  let dominantQuantized = null;
  
  for (const [key, count] of Object.entries(colorCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantQuantized = key;
    }
  }
  
  // Convert back to hex
  const [r, g, b] = dominantQuantized.split(',').map(Number);
  const hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
  
  return hexColor;
}

/**
 * Get color from URL by downloading and analyzing the actual image
 */
async function getColorFromUrl(url) {
  try {
    const imageBuffer = await downloadImage(url);
    return await extractDominantColor(imageBuffer);
  } catch (error) {
    console.error(`Error processing ${url}: ${error.message}`);
    return null;
  }
}

// ============================================================================
// HI PLAN CONTEXT PROCESSING
// ============================================================================

/**
 * Extract materials from HiPlanContext
 */
function extractMaterials(data) {
  const masterData = data?.masterData || {};
  const fs = masterData?.Furniture_Smith || {};
  const attributes = fs?.attributes || [];
  
  // Find all Text type attributes with Color in name or desc
  const colorAttrs = [];
  for (const attr of attributes) {
    if (attr?.type === 'Text') {
      const nameLower = attr?.name?.toLowerCase() || '';
      const descLower = attr?.desc?.toLowerCase() || '';
      if (nameLower.includes('color') || descLower.includes('color')) {
        colorAttrs.push(attr);
      }
    }
  }
  
  // Extract all selections (materials) with a thumbnail and deduplicate by value
  const materials = {};
  for (const attr of colorAttrs) {
    for (const selection of attr?.selections || []) {
      const value = selection?.value;
      const name = selection?.name;
      if (value && name && selection?.imageUrl) {
        if (!materials[value]) {
          materials[value] = selection;
        }
      }
    }
  }
  
  // Sort by numeric value
  const sortedValues = Object.keys(materials).sort((a, b) => {
    const numA = parseFloat(a) || 9999;
    const numB = parseFloat(b) || 9999;
    return numA - numB;
  });
  
  return { materials, sortedValues };
}

/**
 * Get expiry date from thumbnail URLs
 */
function getExpiryDate(materials) {
  const thumbnailUrls = Object.values(materials)
    .map(s => s.imageUrl)
    .filter(url => url);
  
  if (thumbnailUrls.length === 0) {
    return 'unknown';
  }
  
  try {
    const expiryDates = thumbnailUrls.map(url => {
      try {
        const parsed = new URL(url);
        const seParam = parsed.searchParams.get('se');
        if (seParam) {
          return seParam.split('T')[0];
        }
        return null;
      } catch (e) {
        return null;
      }
    }).filter(d => d);
    
    if (expiryDates.length === 0) {
      return 'unknown';
    }
    
    // Sort dates and return the earliest
    expiryDates.sort();
    return expiryDates[0];
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Extract colors for all materials
 */
async function extractAllColors(data, showProgress = true) {
  const result = extractMaterials(data);
  const materials = result.materials;
  const sortedValues = result.sortedValues;
  
  const materialColors = {};
  
  for (const value of sortedValues) {
    const selection = materials[value];
    const name = selection.name;
    const imageUrl = selection.imageUrl;
    
    if (imageUrl) {
      if (showProgress) {
        process.stdout.write(`  Extracting color for ${name}... `);
      }
      const color = await getColorFromUrl(imageUrl);
      if (color === null) {
        if (showProgress) {
          console.log(`FAILED (${imageUrl})`);
        }
        materialColors[value] = null;
      } else {
        materialColors[value] = color;
        if (showProgress) {
          console.log(color);
        }
      }
    } else {
      if (showProgress) {
        console.log(`  No URL for ${name}`);
      }
      materialColors[value] = null;
    }
  }
  
  return { materialColors, sortedValues, materials };
}

// ============================================================================
// MARKDOWN GENERATION
// ============================================================================

/**
 * Create markdown color display
 */
function createMarkdownColorDisplay(hexColor) {
  return `<span style="display:inline-block;width:20px;height:20px;background-color:${hexColor};border:1px solid #ccc;"></span> ${hexColor}`;
}

/**
 * Generate markdown table
 */
function generateMarkdown(data, materialColors, expiryDate) {
  const result = extractMaterials(data);
  const materials = result.materials;
  const sortedValues = result.sortedValues;
  
  const header = `# Materials

This document lists all materials (colors) from the Furniture_Smith library.

## Source

Data extracted from \`HiPlanContext.masterData.Furniture_Smith.attributes\` where type is Text and name/desc contains "Color".

## Thumbnails

The thumbnails are the swatches the planner shows for a color attribute (e.g. FRONT COLOR): the \`imageUrl\` of each selection in \`hi-plan-context.json\`, a read-only SAS URL of a blob on the HOMAG TecConfig CDN:

\`\`\`
https://tecconfig-preview.homag.cloud/cdn/{subscription_id}/library/furniture_smith/images/{image_guid}_{file_name}?sv=...&st=...&se=...&sr=b&sp=r&sig=...
\`\`\`

- \`{subscription_id}\` = \`e2fe8b3d-da31-4a20-92ab-ab6e3839300e\`
- \`{image_guid}\` is random per image, so the URL cannot be built from the material value
- The signature is bound to the exact blob; without it the CDN answers \`409 PublicAccessNotPermitted\`
- The signatures in this document are valid until ${expiryDate}; after that the thumbnails stop showing until \`hi-plan-context.json\` and this document are regenerated

The generation process is described in [hi-furniture-smith-materials.md](../../.agents/skills/hi-furniture-smith-materials.md).

## Color Extraction

The "Suggested Color" column contains hex color codes **calculated by analyzing actual image pixels**. This is NOT guessed from material names - each color is calculated by:

1. Downloading the thumbnail image from the URL
2. Resizing to 100x100px (maintains color distribution)
3. Sampling pixels across the image
4. Quantizing colors by grouping similar RGB values
5. Finding the most frequent color

This method provides **accurate** color representation for all materials, whether they are uniform colors or textured surfaces (wood, marble, stone, etc.).

The color extraction script uses Node.js with the Sharp library for image processing.

## Materials

| Name | Value | Thumbnail | Description | Suggested Color | Suggested Description |
|---|---|---|---|---|---|
`;
  
  let markdown = header;
  
  for (const value of sortedValues) {
    const selection = materials[value];
    const color = materialColors[value];
    const name = selection.name || '';
    const desc = selection.desc || '';
    const imageUrl = selection.imageUrl || '';
    
    const thumbnail = imageUrl ? `![${name}](${imageUrl})` : '';
    
    if (!color) {
      // Mark as unavailable instead of using a fallback color
      const colorDisplay = '_N/A_';
      const suggestedDesc = desc ? `${desc} (color unavailable)` : 'Color unavailable';
      markdown += `| ${name} | ${value} | ${thumbnail} | ${desc} | ${colorDisplay} | ${suggestedDesc} |\n`;
    } else {
      const colorDisplay = createMarkdownColorDisplay(color);
      const suggestedDesc = desc ? `${desc} (${color})` : color;
      markdown += `| ${name} | ${value} | ${thumbnail} | ${desc} | ${colorDisplay} | ${suggestedDesc} |\n`;
    }
  }
  
  return markdown;
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {
    input: 'docs/library-information/hi-plan-context.json',
    output: 'docs/library-information/materials.md',
    listColors: false,
    dryRun: false,
    verify: false,
    allFromContext: false
  };
  
  let positional = [];
  
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--list-colors') {
      options.listColors = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verify') {
      options.verify = true;
    } else if (arg === '--all-from-context') {
      options.allFromContext = true;
    } else if (arg.startsWith('--input=')) {
      options.input = arg.substring(8);
    } else if (arg.startsWith('--output=')) {
      options.output = arg.substring(9);
    } else if (arg === '--input') {
      // Handle space-separated form: --input <path>
      if (i + 1 < args.length) {
        options.input = args[++i];
      }
    } else if (arg === '--output') {
      // Handle space-separated form: --output <path>
      if (i + 1 < args.length) {
        options.output = args[++i];
      }
    } else if (arg.startsWith('--')) {
      // Handle other flags
    } else {
      positional.push(arg);
    }
  }
  
  return { options, positional };
}

/**
 * Main entry point
 */
async function main() {
  const { options, positional } = parseArgs(process.argv);
  
  try {
    // Single URL mode
    if (positional.length > 0 && !options.allFromContext && !options.verify) {
      const url = positional[0];
      const color = await getColorFromUrl(url);
      if (color) {
        console.log(color);
      } else {
        console.error('Failed to extract color');
        process.exit(1);
      }
      return;
    }
    
    // Verify mode
    if (options.verify) {
      const url = positional[0];
      const name = positional[1] || '';
      const color = await getColorFromUrl(url);
      if (color) {
        console.log(`Material: ${name}`);
        console.log(`URL: ${url}`);
        console.log(`Dominant Color: ${color}`);
      } else {
        console.error('Failed to extract color');
        process.exit(1);
      }
      return;
    }
    
    // All from context mode
    if (options.allFromContext) {
      const data = JSON.parse(await readFile(options.input, 'utf-8'));
      const result = extractMaterials(data);
      const expiryDate = getExpiryDate(result.materials);
      
      console.log('Extracting dominant colors from material thumbnails...\n');
      const { materialColors, sortedValues, materials } = await extractAllColors(data);
      
      if (options.listColors) {
        console.log('\nMaterial Colors (extracted from actual images):');
        console.log('='.repeat(60));
        for (const value of sortedValues) {
          const selection = materials[value];
          const color = materialColors[value];
          console.log(`  ${selection.name.padEnd(20)} | ${value.padEnd(4)} | ${color}`);
        }
        console.log(`\nTotal: ${sortedValues.length} materials`);
        return;
      }
      
      const markdown = generateMarkdown(data, materialColors, expiryDate);
      
      if (options.dryRun) {
        console.log('--- DRY RUN (no file written) ---\n');
        console.log(markdown.substring(0, 2000) + (markdown.length > 2000 ? '...\n[truncated]' : ''));
      } else {
        await writeFile(options.output, markdown);
        console.log(`\nGenerated ${options.output} with ${sortedValues.length} materials`);
      }
      return;
    }
    
    // Default: show help
    console.error('Usage:');
    console.error('  node extract-dominant-color-from-image.js <imageUrl>');
    console.error('  node extract-dominant-color-from-image.js --all-from-context [options]');
    console.error('  node extract-dominant-color-from-image.js --verify <imageUrl> [name]');
    console.error('');
    console.error('Options:');
    console.error('  --list-colors      List all materials with their colors');
    console.error('  --dry-run          Don\'t write output file');
    console.error('  --input <file>      Input hi-plan-context.json path');
    console.error('  --output <file>     Output markdown path');
    process.exit(1);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  extractDominantColor,
  getColorFromUrl,
  downloadImage,
  extractMaterials,
  extractAllColors,
  generateMarkdown,
  createMarkdownColorDisplay
};

// ============================================================================
// RUN MAIN
// ============================================================================

// Determine if this module was run directly (not imported)
// Using process.argv[1] which contains the entry point script path
const isMainModule = process.argv[1]?.includes('extract-dominant-color-from-image.js');

if (isMainModule) {
  main().catch(console.error);
}
