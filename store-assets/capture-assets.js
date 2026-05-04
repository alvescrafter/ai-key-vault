// capture-assets.js — Captures screenshots and promo tiles as PNGs
// Usage: node capture-assets.js
// Requires: npm install puppeteer

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = __dirname;

const captures = [
  // Screenshots (1280×800 or 640×400)
  { file: 'screenshot-locked.html',   output: 'screenshot-locked.png',   width: 360, height: 400,  screenshotWidth: 1280 },
  { file: 'screenshot-unlocked.html', output: 'screenshot-unlocked.png', width: 360, height: 520,  screenshotWidth: 1280 },
  { file: 'screenshot-addkey.html',   output: 'screenshot-addkey.png',   width: 360, height: 520,  screenshotWidth: 1280 },
  // Promo tiles (exact sizes)
  { file: 'promo-small.html', output: 'promo-small.png', width: 440, height: 280, screenshotWidth: 440 },
  { file: 'promo-large.html', output: 'promo-large.png', width: 920, height: 680, screenshotWidth: 920 },
];

async function main() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });

  for (const cap of captures) {
    const htmlPath = path.join(ASSETS_DIR, cap.file);
    const outputPath = path.join(ASSETS_DIR, cap.output);

    console.log(`Capturing ${cap.file} → ${cap.output}...`);

    const page = await browser.newPage();
    await page.setViewport({ width: cap.width, height: cap.height, deviceScaleFactor: cap.screenshotWidth / cap.width });

    const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
    console.log(`  Loading: ${fileUrl}`);
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });

    // For screenshots, we want them at 1280px wide; for promos, at their natural size
    if (cap.screenshotWidth !== cap.width) {
      // Screenshot: render at natural size, capture at 1280px wide
      await page.setViewport({ width: cap.width, height: cap.height, deviceScaleFactor: 2 });
      await page.screenshot({
        path: outputPath,
        type: 'png',
        clip: { x: 0, y: 0, width: cap.width, height: cap.height }
      });
    } else {
      // Promo tile: exact pixel size
      await page.setViewport({ width: cap.width, height: cap.height, deviceScaleFactor: 1 });
      await page.screenshot({
        path: outputPath,
        type: 'png',
        fullPage: false
      });
    }

    const stats = fs.statSync(outputPath);
    console.log(`  → ${cap.output} (${(stats.size / 1024).toFixed(1)} KB)`);

    await page.close();
  }

  await browser.close();
  console.log('\nDone! All assets captured.');
  console.log('\nChrome Web Store requirements:');
  console.log('  - Screenshots: 1280×800 or 640×400 (at least 1, up to 5)');
  console.log('  - Small promo: 440×280 (optional)');
  console.log('  - Large promo:  920×680 (optional)');
  console.log('  - Icon: 128×128 (already have icon128.png)');
}

main().catch(err => {
  console.error('Error:', err.message);
  console.error('\nMake sure puppeteer is installed: npm install puppeteer');
  process.exit(1);
});