import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../design/telos-icon.svg', import.meta.url), 'utf8');
// Renders design/telos-icon.svg to the PNG icons with Playwright's Chromium.
// Run: node scripts/build-icons.mjs public/icons  (then copy icon-512.png to maskable-512.png)
const out = process.argv[2] ?? 'public/icons';
const b = await chromium.launch({ channel: 'chromium' });
const p = await b.newPage();
async function shot(size, file, scale = 1) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<html><body style="margin:0;background:#050608;overflow:hidden"><div style="width:${size}px;height:${size}px;display:grid;place-items:center">${svg.replace('<svg ', `<svg width="${size * scale}" height="${size * scale}" `)}</div></body></html>`);
  await p.screenshot({ path: `${out}/${file}`, omitBackground: false });
}
await shot(512, 'icon-512.png');
await shot(192, 'icon-192.png');
await shot(180, 'apple-touch-icon.png');
await shot(32, 'favicon-32.png');
await b.close();
