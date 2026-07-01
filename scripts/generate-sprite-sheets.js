#!/usr/bin/env node

/**
 * YARD Sprite Sheet Generator
 * 
 * Combines 584 individual tile images into optimized sprite sheets.
 * Reduces HTTP requests from 1752 → 3 (one per skin variant)
 * 
 * Usage: node scripts/generate-sprite-sheets.js
 * 
 * Requirements: npm install -D sharp
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'public', 'assets');

// ============================================================
// STEP 1: Validate sharp is available
// ============================================================

let Sharp;
try {
  Sharp = (await import('sharp')).default;
  console.log('✓ Sharp library found');
} catch (err) {
  console.error('✗ ERROR: sharp not installed.');
  console.error('  Run: npm install -D sharp');
  console.error('  Then: node scripts/generate-sprite-sheets.js');
  process.exit(1);
}

// ============================================================
// STEP 2: Define sprite configurations
// ============================================================

const SKINS = [
  { folder: 'cat_1', name: 'Cat Variant 1' },
  { folder: 'cat_1_6', name: 'Cat Variant 6' },
  { folder: 'cat_1_9', name: 'Cat Variant 9' },
];

const TILE_WIDTH = 32;
const TILE_HEIGHT = 32;
const TILES_PER_ROW = 16; // 16 tiles wide = 512px per row

// ============================================================
// STEP 3: Generate sprite sheets
// ============================================================

async function generateSpriteSheets() {
  for (const skin of SKINS) {
    try {
      console.log(`\n📦 Processing ${skin.name}...`);
      const skinPath = path.join(ASSETS_DIR, skin.folder);

      // Read all tile files
      const files = fs.readdirSync(skinPath)
        .filter(f => f.match(/^tile\d{3}\.png$/))
        .sort((a, b) => {
          const numA = parseInt(a.match(/\d+/)[0]);
          const numB = parseInt(b.match(/\d+/)[0]);
          return numA - numB;
        });

      console.log(`  Found ${files.length} tile files`);

      if (files.length === 0) {
        console.warn(`  ⚠ No tile files found in ${skin.folder}`);
        continue;
      }

      // Load all tile images
      const tiles = await Promise.all(
        files.map(file => Sharp(path.join(skinPath, file)).png())
      );

      // Calculate grid dimensions
      const totalTiles = files.length;
      const rows = Math.ceil(totalTiles / TILES_PER_ROW);
      const spriteWidth = TILES_PER_ROW * TILE_WIDTH;
      const spriteHeight = rows * TILE_HEIGHT;

      console.log(`  Sprite sheet size: ${spriteWidth}x${spriteHeight}px (${rows} rows)`);

      // Create canvas and composite all tiles
      let spriteCanvas = Sharp({
        create: {
          width: spriteWidth,
          height: spriteHeight,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      });

      // Build composite list (Sharp requires this format)
      const composites = files.map((file, idx) => ({
        input: path.join(skinPath, file),
        left: (idx % TILES_PER_ROW) * TILE_WIDTH,
        top: Math.floor(idx / TILES_PER_ROW) * TILE_HEIGHT,
      }));

      spriteCanvas = spriteCanvas.composite(composites);

      // Write sprite sheet
      const outputPath = path.join(skinPath, '_sprite.png');
      await spriteCanvas.png().toFile(outputPath);

      console.log(`  ✓ Created ${outputPath}`);

      // Create metadata file
      const metadata = {
        folder: skin.folder,
        name: skin.name,
        tileWidth: TILE_WIDTH,
        tileHeight: TILE_HEIGHT,
        tilesPerRow: TILES_PER_ROW,
        totalTiles: files.length,
        spriteWidth,
        spriteHeight,
        files: files,
      };

      const metadataPath = path.join(skinPath, '_sprite.json');
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      console.log(`  ✓ Created ${metadataPath}`);

    } catch (err) {
      console.error(`  ✗ Error processing ${skin.folder}:`, err.message);
    }
  }

  console.log('\n✅ Sprite sheet generation complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Update PixelPet.jsx to use sprite sheets');
  console.log('   2. Deploy optimized assets');
  console.log('   3. Performance gains: ~95% reduction in HTTP requests for pet animations\n');
}

generateSpriteSheets().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
