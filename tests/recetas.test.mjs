import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import { readJson, readText, loadRecipes } from './helpers.mjs';

const validate = new Ajv2020({ allErrors: true, strict: true }).compile(readJson('recetas/receta.schema.json'));
const recipes = loadRecipes();

test('hay al menos curry y albóndigas', () => {
  const ids = recipes.map(r => r.recipe.id);
  assert.ok(ids.includes('curry-pollo'));
  assert.ok(ids.includes('albondigas-rigatoni'));
});

for (const { file, recipe } of recipes) {
  test(`${file}: cumple el esquema`, () => {
    assert.ok(validate(recipe), JSON.stringify(validate.errors, null, 2));
  });

  test(`${file}: el id coincide con el nombre del archivo`, () => {
    assert.equal(recipe.id + '.json', file);
  });

  test(`${file}: plan_gantt apunta a pasos que existen y a carriles de ese paso`, () => {
    for (const p of recipe.plan_gantt) {
      assert.ok(p.paso < recipe.pasos.length, `paso ${p.paso} fuera de rango`);
      assert.ok(p.hasta_min > p.desde_min, `intervalo vacío ${p.etiqueta}`);
      assert.ok(recipe.pasos[p.paso].carriles.includes(p.carril), `carril ${p.carril} no está en los carriles del paso ${p.paso}`);
    }
  });
}

test('curry: sigue cargando igual que antes (solo se le añade "tema")', () => {
  const before = readJson('tests/fixtures/curry-pollo.baseline.json');
  const { tema, ...rest } = readJson('recetas/curry-pollo.json');
  assert.deepEqual(rest, before);
  assert.ok(tema, 'el curry debe llevar su tema');
});

test('recetas/index.json coincide con cada receta (título, raciones, tiempo, tema)', () => {
  const index = readJson('recetas/index.json');
  assert.equal(index.length, recipes.length);
  for (const { recipe } of recipes) {
    const e = index.find(x => x.id === recipe.id);
    assert.ok(e, `falta ${recipe.id} en el índice`);
    assert.equal(e.titulo, recipe.meta.titulo);
    assert.equal(e.raciones, recipe.meta.raciones);
    assert.equal(e.tiempo_total_min, recipe.meta.tiempo_total_min);
    assert.deepEqual(e.tema, recipe.tema);
  }
});

test('sw.js precachea recetas y scripts nuevos, y sube la versión de caché', () => {
  const sw = readText('sw.js');
  for (const { file } of recipes) assert.ok(sw.includes(`'recetas/${file}'`), `sw.js no precachea ${file}`);
  for (const f of ['js/icons.js', 'js/contrast.js']) assert.ok(sw.includes(`'${f}'`), `sw.js no precachea ${f}`);
  const v = Number(sw.match(/cocina-v(\d+)/)[1]);
  assert.ok(v >= 4, `caché cocina-v${v}: debe ser mayor que cocina-v3`);
});
