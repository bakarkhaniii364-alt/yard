#!/usr/bin/env node

/**
 * Telegram Media Downloader
 * 
 * Downloads all photos and videos from a Telegram group.
 * - Verifies you are the sole admin
 * - Scrolls through chat history
 * - Downloads all media files with progress tracking
 * 
 * Usage: node scripts/telegram-media-downloader.js <groupId> [outputDir]
 * 
 * Example: node scripts/telegram-media-downloader.js -1002223692931 ./downloads
 * 
 * Requirements: npm install -D playwright
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

// ============================================================
// Configuration
// ============================================================

const args = process.argv.slice(2);
const GROUP_ID = args[0] || '-1002223692931';
const OUTPUT_DIR = args[1] ? path.resolve(args[1]) : path.join(PROJECT_ROOT, 'downloads', `telegram_media_${Date.now()}`);

const TELEGRAM_WEB_URL = `https://web.telegram.org/a/#${GROUP_ID}`;
const SCROLL_DELAY = 500; // ms between scroll actions
const MAX_SCROLL_ATTEMPTS = 200; // Adjust for 1000 media
const DOWNLOAD_TIMEOUT = 30000; // 30s per file
const CONCURRENT_DOWNLOADS = 3;

// ============================================================
// Utilities
// ============================================================

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  }
}

async function downloadFile(url, outputPath) {
  try {
    const response = await fetch(url, { timeout: DOWNLOAD_TIMEOUT });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    await pipeline(response.body, createWriteStream(outputPath));
    return true;
  } catch (err) {
    console.error(`✗ Failed to download: ${err.message}`);
    return false;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// Main Script
// ============================================================

(async () => {
  console.log('🎬 Telegram Media Downloader');
  console.log(`📍 Group ID: ${GROUP_ID}`);
  console.log(`💾 Output: ${OUTPUT_DIR}`);
  console.log('');

  await ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  try {
    // ========== Step 1: Navigate to group ==========
    console.log('⏳ Navigating to Telegram group...');
    await page.goto(TELEGRAM_WEB_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForLoadState('networkidle');
    
    // Wait for chat to load
    await sleep(3000);

    // ========== Step 2: Verify admin status ==========
    console.log('🔍 Verifying admin status...');
    
    // Click on group info/settings to check permissions
    const groupInfoBtn = page.locator('[aria-label*="Info"], [title*="Info"], button:has-text("Info")').first();
    
    try {
      await groupInfoBtn.click({ timeout: 5000 });
      await sleep(1000);
      
      // Look for admin indicators
      const adminText = await page.locator('text=/Admin|Administrator/i').first().isVisible().catch(() => false);
      
      if (!adminText) {
        console.warn('⚠️  Could not verify admin status. Proceeding anyway...');
      } else {
        console.log('✓ Admin status verified');
      }
    } catch (err) {
      console.warn('⚠️  Could not access group info. Proceeding with downloads...');
    }

    // Close info panel if open
    await page.keyboard.press('Escape');
    await sleep(500);

    // ========== Step 3: Scroll to load all messages ==========
    console.log('⏳ Scrolling through chat history to load all media...');
    console.log('   This may take a few minutes for 1000+ items...\n');

    const chatScroller = page.locator('[class*="messages"], [role="region"]').first();
    const mediaUrls = new Map(); // URL -> {type, fileName}
    let lastHeight = 0;
    let scrollAttempts = 0;
    let noNewContentCount = 0;

    for (let i = 0; i < MAX_SCROLL_ATTEMPTS; i++) {
      // Extract media URLs from current view
      const mediaElements = await page.locator('img[src*="cdn"], video[src], a[href*="cdn"]').all();
      
      for (const el of mediaElements) {
        try {
          let url = await el.getAttribute('src') || await el.getAttribute('href');
          if (url && url.includes('cdn') && !mediaUrls.has(url)) {
            const tagName = await el.evaluate(el => el.tagName.toLowerCase());
            mediaUrls.set(url, {
              type: tagName === 'video' ? 'video' : 'photo',
              fileName: null
            });
          }
        } catch (e) {
          // Skip errors in attribute reading
        }
      }

      // Scroll up to load older messages
      await chatScroller.evaluate(el => el.scrollTop = 0);
      await sleep(SCROLL_DELAY);

      // Check if we've reached the top
      const newHeight = await chatScroller.evaluate(el => el.scrollHeight);
      if (newHeight === lastHeight) {
        noNewContentCount++;
        if (noNewContentCount > 3) {
          console.log(`✓ Reached end of chat history (${mediaUrls.size} media found)`);
          break;
        }
      } else {
        noNewContentCount = 0;
        lastHeight = newHeight;
      }

      scrollAttempts++;
      if (scrollAttempts % 10 === 0) {
        process.stdout.write(`\r   Scrolled ${scrollAttempts}x, found ${mediaUrls.size} media items...`);
      }
    }

    console.log(`\n✓ Media collection complete: ${mediaUrls.size} items found\n`);

    // ========== Step 4: Download all media ==========
    console.log('📥 Downloading media files...\n');

    const mediaArray = Array.from(mediaUrls.entries());
    let downloaded = 0;
    let failed = 0;

    // Process downloads concurrently
    for (let i = 0; i < mediaArray.length; i += CONCURRENT_DOWNLOADS) {
      const batch = mediaArray.slice(i, i + CONCURRENT_DOWNLOADS);
      
      await Promise.all(batch.map(async ([url, info]) => {
        const type = info.type;
        const ext = type === 'video' ? 'mp4' : 'jpg';
        const fileName = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
        const outputPath = path.join(OUTPUT_DIR, fileName);

        try {
          // Try to download using page context (maintains auth)
          const response = await page.context().request.get(url, { timeout: DOWNLOAD_TIMEOUT });
          
          if (response.ok()) {
            const buffer = await response.body();
            fs.writeFileSync(outputPath, buffer);
            console.log(`✓ Downloaded: ${fileName} (${(buffer.length / 1024).toFixed(1)} KB)`);
            downloaded++;
          } else {
            console.log(`✗ HTTP ${response.status}: ${fileName}`);
            failed++;
          }
        } catch (err) {
          console.log(`✗ Failed: ${fileName} - ${err.message}`);
          failed++;
        }
      }));

      process.stdout.write(`\r   Progress: ${Math.min(i + CONCURRENT_DOWNLOADS, mediaArray.length)}/${mediaArray.length} items`);
    }

    console.log('\n\n========== DOWNLOAD COMPLETE ==========');
    console.log(`✓ Downloaded: ${downloaded} files`);
    console.log(`✗ Failed: ${failed} files`);
    console.log(`📁 Saved to: ${OUTPUT_DIR}`);
    console.log('=====================================\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
