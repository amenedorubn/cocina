import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, readText, loadRecipes } from './helpers.mjs';

const C = createRequire(import.meta.url)('../js/contrast.js');
const MIN = 4.5;
const ge = (a, b, what) => { const r = C.ratio(a, b); assert.ok(r >= MIN, `${what}: ${a} sobre ${b} = ${r.toFixed(2)}:1 (mín ${MIN}:1)`); };

// Tokens de app.css (tema neutro). El primer test comprueba que siguen en el CSS.
const LIGHT = { bg: '#F5F5F3', card: '#FFFFFF', ink: '#1F2124', muted: '#575B61', acc: '#2B2F36',
  lanes: { fuego: null, manos: ['#5A5F67', '#FFFFFF'], airfryer: ['#7B8088', '#16171A'], micro: ['#A2A6AD', '#16171A'], reposo: ['#C9CCD1', '#16171A'] } };
const DARK = { bg: '#141517', card: '#1F2125', ink: '#ECEDEF', muted: '#A6ABB2', surface: '#2A2D32', acc: '#E6E8EB',
  lanes: { fuego: null, manos: ['#B9BDC4', '#16171A'], airfryer: ['#8E939B', '#16171A'], micro: ['#6C717A', '#FFFFFF'], reposo: ['#4A4E55', '#FFFFFF'] } };

test('los tokens de este test coinciden con app.css', () => {
  const css = readText('app.css');
  const all = [LIGHT.bg, LIGHT.card, LIGHT.ink, LIGHT.muted, LIGHT.acc, DARK.bg, DARK.card, DARK.ink, DARK.muted, DARK.surface, DARK.acc,
    ...Object.values(LIGHT.lanes).concat(Object.values(DARK.lanes)).filter(Boolean).flat()];
  for (const v of all) assert.ok(css.includes(v), `app.css no contiene ${v}`);
});

function checkMode(name, P, bg, acc) {
  const surface = P.surface || C.mix(P.ink, bg, 0.08); // color-mix(in srgb, ink 8%, bg)
  const on = C.onColor(acc);
  ge(P.ink, bg, `${name} tinta/fondo`); ge(P.ink, P.card, `${name} tinta/tarjeta`); ge(P.ink, surface, `${name} tinta/superficie`);
  ge(P.muted, bg, `${name} secundario/fondo`); ge(P.muted, P.card, `${name} secundario/tarjeta`); ge(P.muted, surface, `${name} secundario/superficie`);
  ge(acc, bg, `${name} acento/fondo`); ge(acc, P.card, `${name} acento/tarjeta`);
  ge(on, acc, `${name} texto sobre acento`);
  for (const [lane, pair] of Object.entries(P.lanes)) {
    const [fill, text] = pair || [acc, on];
    ge(text, fill, `${name} etiqueta carril ${lane}`);
  }
}

test('tema neutro por defecto, claro y oscuro', () => {
  checkMode('neutro claro', LIGHT, LIGHT.bg, LIGHT.acc);
  checkMode('neutro oscuro', DARK, DARK.bg, DARK.acc);
});

for (const { file, recipe } of loadRecipes()) {
  if (!recipe.tema) continue;
  test(`${file}: el tema cumple 4,5:1 en claro y oscuro (valores finales, sin ajuste en runtime)`, () => {
    const t = recipe.tema;
    checkMode(`${recipe.id} claro`, LIGHT, t.superficie, t.acento);
    checkMode(`${recipe.id} oscuro`, DARK, DARK.bg, t.acento_oscuro);
    assert.equal(C.fit(t.acento, t.superficie, MIN, -1).toUpperCase(), t.acento.toUpperCase());
    assert.equal(C.fit(t.acento_oscuro, DARK.bg, MIN, 1).toUpperCase(), t.acento_oscuro.toUpperCase());
  });
}

test('Contrast.fit corrige un acento flojo hasta 4,5:1 (red de seguridad para recetas importadas)', () => {
  assert.ok(C.ratio(C.fit('#E9B00F', '#FBF6E6', MIN, -1), '#FBF6E6') >= MIN);
  assert.ok(C.ratio(C.fit('#3A2A05', '#141517', MIN, 1), '#141517') >= MIN);
});

test('el amarillo #E9B00F y la paleta amarilla de antes solo viven en el tema del curry', () => {
  const banned = /#E9B00F|#F7D450|#FFF3C2|#231A05|#5E4A12|#1D1709|#2C230D|#3A2F12|#C9AE62/i;
  const walk = d => readdirSync(d).flatMap(f => {
    const p = path.join(d, f);
    if (['node_modules', '.git', 'tests', 'icons'].includes(f)) return [];
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  const offenders = walk(ROOT)
    .filter(p => /\.(css|js|html|webmanifest|json)$/.test(p) && !/package(-lock)?\.json$/.test(p))
    .filter(p => banned.test(readFileSync(p, 'utf8')))
    .map(p => path.relative(ROOT, p).replaceAll('\\', '/'));
  assert.deepEqual(offenders.sort(), ['recetas/curry-pollo.json', 'recetas/index.json']);
});

test('el CSS no lleva degradados ni colores índigo/violeta', () => {
  const css = readText('app.css');
  assert.ok(!/gradient/i.test(css), 'app.css usa degradados');
  for (const h of css.match(/#[0-9A-Fa-f]{6}\b/g)) {
    const [r, g, b] = C.hex2rgb(h);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d < 24) continue; // grises
    let hue = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60;
    assert.ok(hue < 200 || hue > 340, `${h} tiene matiz ${hue.toFixed(0)}° (azul/índigo/violeta)`);
  }
});
