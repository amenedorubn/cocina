// E2E con Playwright a 390×844, en claro y en oscuro. Uso: node tests/e2e/run.mjs [URL_BASE]
// Sin URL_BASE levanta un servidor estático local. Guarda capturas en tests/e2e/capturas/.
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ROOT } from '../helpers.mjs';

const OUT = path.join(ROOT, 'tests/e2e/capturas');
mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end('no'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      res.end(readFileSync(f));
    }).listen(0, () => resolve(srv));
  });
}

const YELLOW = 'rgb(233, 176, 15)';
const PALETTE = {
  light: { bg: '#F5F5F3', accDefault: 'rgb(43, 47, 54)' },
  dark: { bg: '#141517', accDefault: 'rgb(230, 232, 235)' },
};
const RECIPES = {
  'albondigas-rigatoni': { light: 'rgb(184, 50, 31)', dark: 'rgb(232, 102, 79)', surface: '#FBF7F0' },
  'curry-pollo': { light: 'rgb(139, 105, 9)', dark: YELLOW, surface: '#FBF6E6' },
};

let failures = 0;
const check = async (name, fn) => {
  try { await fn(); console.log("  ok  " + name); }
  catch (e) { failures++; console.log("  FAIL " + name + " :: " + String(e.message).split(String.fromCharCode(10)).slice(0, 4).join(" | ")); }
};

// Busca elementos (y su ::before) cuyo color calculado sea el amarillo del curry.
const findYellow = (page, yellow) => page.evaluate(y => {
  const props = ['color', 'backgroundColor', 'borderTopColor', 'borderLeftColor', 'outlineColor', 'fill', 'caretColor', 'accentColor'];
  const out = [];
  for (const el of document.querySelectorAll('body, body *')) {
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      if (pseudo && cs.content === 'none') continue;
      const width = { borderTopColor: cs.borderTopWidth, borderLeftColor: cs.borderLeftWidth, outlineColor: cs.outlineWidth };
      for (const p of props) {
        if (cs[p] === y && (!(p in width) || parseFloat(width[p]) > 0)) {
          out.push((el.closest('[data-id]') ? '[data-id=' + el.closest('[data-id]').dataset.id + '] ' : '') + el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '') + (pseudo || '') + ' ' + p);
        }
      }
    }
  }
  return out;
}, yellow);

// Objetivos táctiles visibles < 44 px.
const smallTargets = page => page.evaluate(() => [...document.querySelectorAll('button, a[href], label.switch, summary')]
  .filter(el => el.offsetParent !== null)
  .map(el => { const r = el.getBoundingClientRect(); return { id: el.id || el.className || el.tagName, w: Math.round(r.width), h: Math.round(r.height) }; })
  .filter(t => t.w < 44 || t.h < 44));

const cssVar = (page, name) => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
const meta = page => page.evaluate(() => document.querySelector('meta[name="theme-color"]').content);
const bodyBg = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const hexToRgb = h => 'rgb(' + [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(', ') + ')';

let srv = null; let base = process.argv[2];
if (!base) { srv = await serve(); base = 'http://localhost:' + srv.address().port + '/'; }
console.log('Base:', base);

const browser = await chromium.launch();
try {
  for (const scheme of ['light', 'dark']) {
    console.log(`\n== ${scheme} · 390×844 ==`);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, deviceScaleFactor: 2, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const shot = name => page.screenshot({ path: path.join(OUT, `${name}-${scheme}.png`) });
    const P = PALETTE[scheme];

    // ---------- HOME ----------
    await page.goto(base + 'index.html'); await page.waitForSelector('.card');
    await shot('01-home');
    await check(`home: theme-color y fondo neutros (${P.bg})`, async () => {
      assert.equal((await meta(page)).toUpperCase(), P.bg);
      assert.equal(await bodyBg(page), hexToRgb(P.bg));
    });
    await check('home: 2 tarjetas', async () => assert.equal(await page.locator('.card').count(), 2));
    await check('home: #E9B00F solo puede aparecer en el detalle de la tarjeta del curry', async () => {
      const y = await findYellow(page, YELLOW);
      assert.ok(y.every(s => s.startsWith('[data-id=curry-pollo]') && s.includes('::before')), 'amarillo en: ' + y.join(' | '));
    });
    await check('home: botón principal en grafito (sin acento de receta)', async () =>
      assert.equal(await page.locator('#importBtn').evaluate(e => getComputedStyle(e).backgroundColor), P.accDefault));
    await check('home: objetivos táctiles ≥ 44 px', async () => assert.deepEqual(await smallTargets(page), []));
    await check('home: cada tarjeta lleva su acento como único detalle', async () => {
      const dots = await page.$$eval('.card', els => els.map(e => [e.dataset.id, getComputedStyle(e, '::before').backgroundColor, getComputedStyle(e).backgroundColor]));
      for (const id of Object.keys(RECIPES)) assert.equal(dots.find(d => d[0] === id)[1], RECIPES[id][scheme]);
      assert.ok(dots.every(d => d[2] === (scheme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(31, 33, 37)')), 'el fondo de la tarjeta es neutro');
    });
    await check('home: iconos SVG Phosphor, sin emojis', async () => {
      assert.equal(await page.locator('#themeBtn svg').count(), 1);
      assert.ok(!/\p{Extended_Pictographic}/u.test(await page.locator('body').innerText()));
    });

    // ---------- ALBÓNDIGAS ----------
    const rid = 'albondigas-rigatoni';
    const R = RECIPES[rid];
    const bg = scheme === 'light' ? R.surface : P.bg;
    await page.clock.install();
    await page.goto(base + 'cocina.html?id=' + rid); await page.waitForSelector('#start:not(.hidden)');
    await shot('02-albondigas-inicio');
    await check(`albóndigas: acento (${R[scheme]}), theme-color y fondo (${bg})`, async () => {
      assert.equal(await page.locator('#go').evaluate(e => getComputedStyle(e).backgroundColor), R[scheme]);
      assert.equal((await meta(page)).toUpperCase(), bg);
      assert.equal(await bodyBg(page), hexToRgb(bg));
    });
    await check('albóndigas: sin #E9B00F en ningún elemento', async () => assert.deepEqual(await findYellow(page, YELLOW), []));
    await check('albóndigas: objetivos táctiles ≥ 44 px', async () => assert.deepEqual(await smallTargets(page), []));
    await check('albóndigas: el Gantt tiene carril Airfryer', async () =>
      assert.ok((await page.locator('#ganttStart .lane > span').allTextContents()).includes('Airfryer')));

    await page.click('#planBtnStart'); await page.waitForSelector('#plan:not(.hidden)');
    await shot('03-albondigas-gantt');
    await check('albóndigas (Gantt): sin #E9B00F', async () => assert.deepEqual(await findYellow(page, YELLOW), []));
    await page.click('#closePlan');

    await page.click('#go'); await page.waitForSelector('#cook:not(.hidden)');
    await shot('04-albondigas-cocina-paso1');
    await check('paso 1: objetivos táctiles ≥ 44 px', async () => assert.deepEqual(await smallTargets(page), []));
    await page.click('#doneBtn');
    await page.waitForFunction(() => document.getElementById('title').textContent.includes('tanda 1'));
    const fired = () => page.$$eval('#cues li.fired', l => l.length);
    const state = () => page.locator('#tstate').textContent();
    const DONE = 'Tiempo cumplido · toca Hecho';
    await check('paso 2: aviso de 0:00 al empezar', async () => assert.equal(await fired(), 1));
    await page.clock.runFor(179 * 1000);
    await check('paso 2: a 2:59 aún no salta el de 3:00', async () => assert.equal(await fired(), 1));
    await page.clock.runFor(2 * 1000);
    await check('paso 2: a 3:01 ya saltó el de 3:00', async () => assert.equal(await fired(), 2));
    await shot('05-albondigas-cocina-paso2');
    await page.clock.runFor(120 * 1000);
    await check('paso 2: a 5:01 salta "Agita el Ninja"; el paso sigue en marcha', async () => { assert.equal(await fired(), 3); assert.equal(await state(), ''); });
    await page.clock.runFor(290 * 1000);
    await check('paso 2: a 9:51 aún no ha terminado', async () => assert.equal(await state(), ''));
    await page.clock.runFor(10 * 1000);
    await check('paso 2: a 10:01 termina (tiempo cumplido)', async () => assert.equal(await state(), DONE));
    await shot('06-albondigas-paso2-fin');
    await page.click('#doneBtn');
    await page.waitForFunction(() => document.getElementById('title').textContent.includes('Tanda 2'));
    await page.click('#doneBtn'); // cupieron todas: se salta la tanda 2
    await page.waitForFunction(() => document.getElementById('title').textContent.includes('pasta'));
    await check('paso 4: aviso de 0:00 al empezar', async () => assert.equal(await fired(), 1));
    await page.clock.runFor(361 * 1000);
    await check('paso 4: a 6:01 salta "Remueve la pasta"', async () => assert.equal(await fired(), 2));
    await page.clock.runFor(180 * 1000);
    await check('paso 4: a 9:01 salta lo de la salsa espesa; sigue en marcha', async () => { assert.equal(await fired(), 3); assert.equal(await state(), ''); });
    await shot('07-albondigas-cocina-paso4');
    await page.clock.runFor(170 * 1000);
    await check('paso 4: a 11:51 aún no ha terminado', async () => assert.equal(await state(), ''));
    await page.clock.runFor(10 * 1000);
    await check('paso 4: a 12:01 termina', async () => assert.equal(await state(), DONE));
    await page.click('#doneBtn');
    await page.waitForFunction(() => document.getElementById('title').textContent === 'Reparto');
    await shot('08-albondigas-reparto');
    await check('reparto: objetivos ≥ 44 px, sin #E9B00F, 4 checks', async () => {
      assert.deepEqual(await smallTargets(page), []);
      assert.deepEqual(await findYellow(page, YELLOW), []);
      assert.equal(await page.locator('#checks button').count(), 4);
    });
    await page.click('#planBtn'); await page.waitForSelector('#plan:not(.hidden)');
    await shot('09-albondigas-gantt-en-curso');

    // ---------- VUELTA A LA HOME ----------
    await page.goto(base + 'index.html'); await page.waitForSelector('.card');
    await check('vuelta a la home: tema por defecto (theme-color, fondo, sin variables de receta)', async () => {
      assert.equal((await meta(page)).toUpperCase(), P.bg);
      assert.equal(await bodyBg(page), hexToRgb(P.bg));
      assert.equal(await cssVar(page, '--r-acc-l'), '');
    });

    // ---------- CURRY ----------
    const C = RECIPES['curry-pollo'];
    await page.goto(base + 'cocina.html?id=curry-pollo'); await page.waitForSelector('#start:not(.hidden)');
    await shot('10-curry-inicio');
    await check(`curry: conserva su amarillo solo en su receta (${C[scheme]}) y carga igual que antes`, async () => {
      assert.equal(await page.locator('#go').evaluate(e => getComputedStyle(e).backgroundColor), C[scheme]);
      assert.equal((await meta(page)).toUpperCase(), scheme === 'light' ? C.surface : P.bg);
      assert.equal(await page.locator('#ganttStart .seg').count(), 12);
      assert.equal(await page.locator('#ganttStart .lane').count(), 4);
      assert.equal(await page.locator('#ingList li').count(), 12);
      assert.deepEqual(await smallTargets(page), []);
    });
    await page.click('#planBtnStart'); await shot('11-curry-gantt'); await page.click('#closePlan');
    await page.click('#go'); await page.waitForSelector('#cook:not(.hidden)');
    await shot('12-curry-cocina-paso1');
    await check('curry: 8 pasos en modo cocina', async () => assert.equal(await page.locator('#prog i').count(), 8));

    await check('sin errores de consola/JS', async () => assert.deepEqual(errors, []));
    await ctx.close();
  }
} finally {
  await browser.close();
  if (srv) srv.close();
}
console.log(failures ? `\n${failures} comprobación(es) fallida(s)` : '\nE2E completo: todo en verde');
process.exit(failures ? 1 : 0);
