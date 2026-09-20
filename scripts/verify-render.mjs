/**
 * Real browser verification.
 *
 * Everything else in this project is checked without a browser, which means the
 * one thing that can only fail in a browser — "does it actually render" — goes
 * unproven. This drives a headless Chromium (software WebGL via SwiftShader)
 * against the dev server and asserts the canvas really produced frames by
 * decoding the screenshots.
 *
 * Two traps are deliberately avoided:
 *  - `readPixels` on the live WebGL canvas returns black, because the renderer
 *    runs with `preserveDrawingBuffer:false`. Screenshots are the ground truth.
 *  - the DOM is asserted with the classes the screens actually emit.
 *
 * The browser is self-provisioned: @sparticuz/chromium bundles the Chromium
 * binary and the NSS/SwiftShader shared libraries it needs, brotli-compressed,
 * so this runs anywhere `npm install` works — no system Chrome, no apt.
 *
 * Usage: node scripts/verify-render.mjs [url]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium';
import { PNG } from 'pngjs';

const require = createRequire(import.meta.url);

const URL = process.argv[2] ?? 'http://127.0.0.1:5173/';
const OUT = path.resolve('render-report');
fs.mkdirSync(OUT, { recursive: true });

/** Extract the bundled Chromium binary + shared libraries. */
async function setupBrowser() {
  const exePath = await chromium.executablePath();
  // The package root is two levels above build/index.js; its exports map hides
  // package.json from require.resolve, so walk up instead.
  const pkgDir = path.resolve(path.dirname(require.resolve('@sparticuz/chromium')), '..');
  const libDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gf-chrome-libs-'));
  for (const name of ['al2023.tar.br', 'swiftshader.tar.br']) {
    const src = path.join(pkgDir, 'bin', name);
    if (!fs.existsSync(src)) continue;
    const tar = path.join(libDir, name.replace(/\.br$/, ''));
    fs.writeFileSync(tar, zlib.brotliDecompressSync(fs.readFileSync(src)));
    // tar binary ships with the OS image; fall back to the system one.
    exec(`tar xf ${JSON.stringify(tar)} -C ${JSON.stringify(libDir)}`);
  }
  return { exePath, libDir };
}

function exec(cmd) {
  const { execSync } = require('node:child_process');
  execSync(cmd, { stdio: 'ignore' });
}

/** Decoded-pixel statistics for a screenshot buffer. */
function analyse(buffer) {
  const png = PNG.sync.read(buffer);
  const distinct = new Set();
  let sum = 0;
  const n = png.width * png.height;
  for (let i = 0; i < png.data.length; i += 4) {
    distinct.add(`${png.data[i] >> 4},${png.data[i + 1] >> 4},${png.data[i + 2] >> 4}`);
    sum += (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
  }
  return { width: png.width, height: png.height, distinct: distinct.size, meanLuminance: +(sum / n).toFixed(2) };
}

const problems = [];
const results = {};
const fail = (m) => { problems.push(m); console.log(`  FAIL  ${m}`); };
const pass = (m) => console.log(`  ok    ${m}`);

const { exePath, libDir } = await setupBrowser();
// The bundled tars unpack with a `lib/` prefix, so the .so files live in a
// subfolder; point the loader at both levels.
const ldPath = [libDir, path.join(libDir, 'lib')].join(':');
const browser = await puppeteer.launch({
  executablePath: exePath,
  headless: true,
  env: { ...process.env, LD_LIBRARY_PATH: ldPath },
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--disable-dev-shm-usage',
    '--window-size=1280,800',
  ],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('requestfailed', (r) => pageErrors.push(`request failed: ${r.url()} ${r.failure()?.errorText}`));

  console.log(`\n== ${URL} ==`);
  const resp = await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  results.httpStatus = resp?.status();
  resp?.status() === 200 ? pass('HTTP 200') : fail(`HTTP ${resp?.status()}`);

  // main.ts publishes the app handle once booted; wait for that, not a guess.
  const booted = await page
    .waitForFunction(() => Boolean(document.querySelector('canvas') && window.glueFlip), { timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  booted ? pass('app handle published, canvas present') : fail('app never became ready');

  const webgl = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const ctx = c?.getContext('webgl2') || c?.getContext('webgl');
    if (!ctx) return { error: 'no WebGL context' };
    const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
    return {
      version: ctx.getParameter(ctx.VERSION),
      renderer: dbg ? ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a',
    };
  });
  results.webgl = webgl;
  webgl.error ? fail(`WebGL: ${webgl.error}`) : pass(`WebGL ${webgl.version} — ${webgl.renderer}`);

  // ---- menu renders and is not a black frame ----
  const menuShot = await page.screenshot();
  fs.writeFileSync(path.join(OUT, 'menu.png'), menuShot);
  const menuPx = analyse(menuShot);
  results.menuPixels = menuPx;
  if (menuPx.distinct > 40 && menuPx.meanLuminance > 10) pass(`menu frame has content (${menuPx.distinct} shades, lum ${menuPx.meanLuminance})`);
  else fail(`menu frame looks blank (${menuPx.distinct} shades, lum ${menuPx.meanLuminance})`);

  const ui = await page.evaluate(() => ({
    title: document.querySelector('.gf-title')?.textContent?.trim() ?? null,
    play: document.querySelector('.gf-button.is-primary')?.textContent?.trim() ?? null,
    secondary: [...document.querySelectorAll('.gf-menu__secondary .gf-button')].map((b) => b.textContent.trim()),
    lang: document.documentElement.lang,
  }));
  results.ui = ui;
  ui.title ? pass(`title: "${ui.title}"`) : fail('title missing');
  ui.play ? pass(`play: "${ui.play}"`) : fail('play button missing');
  pass(`secondary: ${ui.secondary.join(' / ')}`);

  // ---- enter the game, the HUD must appear ----
  await page.click('.gf-button.is-primary');
  await new Promise((r) => setTimeout(r, 1500));
  const hud = await page.evaluate(() => ({
    hudVisible: !document.querySelector('.gf-hud')?.hidden,
    score: document.querySelector('.gf-hud__score-value')?.textContent?.trim() ?? null,
  }));
  results.hud = hud;
  hud.hudVisible ? pass(`HUD visible (score "${hud.score}")`) : fail('HUD not visible after Play');

  // The miss flow below needs a mode where a miss neither ends the run (Classic)
  // nor skips the red flash (Open). A challenge with a generous throw budget is
  // exactly that: miss -> red flash -> the stick comes back by itself.
  await page.evaluate(() => window.glueFlip.startChallenge('long-shot'));
  await new Promise((r) => setTimeout(r, 1200));

  // Project the stick's live world position to screen coords so a pointer-down
  // genuinely lands on it; guessing at a fixed point misses the thin collider.
  const stickScreen = () =>
    page.evaluate(() => {
      const v = window.glueFlip.controller.entity.position.clone();
      v.project(window.glueFlip.engine.camera);
      const r = window.glueFlip.engine.canvas.getBoundingClientRect();
      return { x: r.x + ((v.x + 1) / 2) * r.width, y: r.y + ((1 - v.y) / 2) * r.height };
    });

  // The camera eases into place after Play, so a projection done a moment early
  // can miss the thin stick. Retry the grab until the controller reports held.
  const grabAndDrag = async (steps, dx, dy, delay) => {
    for (let t = 0; t < 10; t++) {
      const s = await stickScreen();
      await page.mouse.move(s.x, s.y);
      await page.mouse.down();
      const phase = await page.evaluate(() => window.glueFlip.controller.phase);
      if (phase === 'held') {
        for (let i = 1; i <= steps; i++) {
          await page.mouse.move(s.x + i * dx, s.y + i * dy);
          await new Promise((r) => setTimeout(r, delay));
        }
        await page.mouse.up();
        return true;
      }
      await page.mouse.up();
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  };

  // ---- a real throw gesture end to end ----
  await grabAndDrag(12, 2, -11, 16);
  await new Promise((r) => setTimeout(r, 4000));

  const throwShot = await page.screenshot();
  fs.writeFileSync(path.join(OUT, 'after-throw.png'), throwShot);
  const throwPx = analyse(throwShot);
  results.afterThrowPixels = throwPx;
  if (throwPx.distinct > 40) pass(`post-throw frame has content (${throwPx.distinct} shades)`);
  else fail('post-throw frame looks blank');

  // ---- the miss flow: red flash + auto-restart, exactly as asked ----
  // Listen to the app's own events so we observe a real miss and the phase
  // returning to idle (the stick coming back by itself) without touching code.
  await page.evaluate(() => {
    window.__phases = [];
    window.__results = [];
    window.glueFlip.events.on('phase:change', (e) => window.__phases.push(e.phase));
    window.glueFlip.events.on('landing:result', (e) => window.__results.push(e.result.status));
  });

  // A strong, fast flick tumbles the stick so it cannot land upright => a miss.
  // High release speed plus high curl => several rotations => it topples.
  const strong = async () => grabAndDrag(5, 10, -40, 8);

  const waitLanding = async (before) => {
    const t0 = Date.now();
    while (Date.now() - t0 < 12000) {
      const n = await page.evaluate(() => window.__results.length);
      if (n > before) return;
      await new Promise((r) => setTimeout(r, 250));
    }
  };

  let missSeen = false;
  for (let attempt = 0; attempt < 4 && !missSeen; attempt++) {
    const before = await page.evaluate(() => window.__results.length);
    await strong();
    await waitLanding(before);
    await new Promise((r) => setTimeout(r, 400));
    missSeen = await page.evaluate(() => window.__results.some((s) => s === 'failed' || s === 'lost'));
  }
  results.miss = { missSeen, results: await page.evaluate(() => window.__results) };

  if (missSeen) {
    pass(`a miss was observed (${results.miss.results.join(',')})`);
    const flash = await page.evaluate(() => ({
      fail: document.querySelector('.gf-failflash')?.classList.contains('is-show') ?? false,
      failVisible: getComputedStyle(document.querySelector('.gf-failflash')).animationName === 'gf-failflash',
      resultFail: document.querySelector('.gf-result')?.classList.contains('is-fail') ?? false,
      verdict: document.querySelector('.gf-result__title')?.textContent?.trim() ?? null,
    }));
    results.missFlash = flash;
    flash.fail ? pass('red fail flash triggered') : fail('red fail flash did not trigger on a miss');
    flash.resultFail && flash.verdict ? pass(`verdict shows a miss: "${flash.verdict}"`) : fail('miss verdict not shown');

    // After the reset delay the stick must come back by itself: a reset lifts it
    // upright at the spawn point (y back near standing height) and returns the
    // phase to idle. A stick left lying where it fell stays low. Poll for either
    // physical signal.
    const t0 = Date.now();
    let resetState = null;
    while (Date.now() - t0 < 4000) {
      resetState = await page.evaluate(() => ({
        phase: window.glueFlip.controller.phase,
        y: +window.glueFlip.controller.entity.position.y.toFixed(3),
      }));
      if (resetState.phase === 'idle' || resetState.y > 0.7) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    results.reset = resetState;
    resetState && (resetState.phase === 'idle' || resetState.y > 0.7)
      ? pass(`stick came back by itself (phase=${resetState.phase}, y=${resetState.y})`)
      : fail(`stick did not auto-restart after the miss (phase=${resetState?.phase}, y=${resetState?.y})`);
  } else {
    fail('could not produce a miss in 4 throws');
  }

  // ---- console hygiene ----
  results.consoleErrors = consoleErrors;
  results.pageErrors = pageErrors;
  pageErrors.length === 0 ? pass('no page errors') : fail(`${pageErrors.length} page error(s): ${pageErrors[0]}`);
  consoleErrors.length === 0 ? pass('no console errors') : fail(`${consoleErrors.length} console error(s): ${consoleErrors[0]}`);
} catch (err) {
  fail(`script threw: ${err.message}`);
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
console.log(`\n== ${problems.length === 0 ? 'ALL CHECKS PASSED' : `${problems.length} PROBLEM(S)`} ==`);
process.exit(problems.length === 0 ? 0 : 1);
