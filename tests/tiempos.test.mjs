import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRecipes, readJson } from './helpers.mjs';

// Ningún aviso puede caer después de que acabe su paso, ni repetirse.
for (const { file, recipe } of loadRecipes()) {
  recipe.pasos.forEach((p, i) => {
    test(`${file} · paso ${i + 1} «${p.titulo}»: avisos dentro de la duración`, () => {
      const seen = new Set();
      for (const a of p.avisos) {
        assert.ok(a.a_los_s < p.duracion_s, `aviso a los ${a.a_los_s}s no cae antes del final (${p.duracion_s}s)`);
        assert.ok(!seen.has(a.a_los_s), `dos avisos a los ${a.a_los_s}s`);
        seen.add(a.a_los_s);
      }
      if (!p.duracion_s) assert.equal(p.avisos.length, 0, 'un paso sin temporizador no puede llevar avisos');
    });
  });
}

const albondigas = readJson('recetas/albondigas-rigatoni.json');
const [p1, p2, p3, p4, p5] = albondigas.pasos; // pasos 1..5 del enunciado

test('albóndigas · paso 2: 10 min y avisos a 0:00, 3:00 y 5:00', () => {
  assert.equal(p2.duracion_s, 600);
  assert.deepEqual(p2.avisos.map(a => a.a_los_s), [0, 180, 300]);
  assert.match(p2.avisos[0].texto, /Sartén a fuego medio/);
  assert.match(p2.avisos[1].texto, /Tomate, orégano, pimentón y sal/);
  assert.match(p2.avisos[2].texto, /Agita el Ninja/);
  assert.match(p2.detalle, /AIR FRY a 200 °C, 10 min/);
});

test('albóndigas · paso 3 (tanda 2, obligatoria): 10 min y avisos a 0:00 y 5:00', () => {
  assert.equal(p3.duracion_s, 600);
  assert.deepEqual(p3.avisos.map(a => a.a_los_s), [0, 300]);
  assert.match(p3.titulo, /tanda 2 de 2/);
  assert.doesNotMatch(p3.voz_inicio + p3.detalle, /cupieron|solo si/i);
});

test('albóndigas · paso 4: 12 min; avisos a 0:00, 6:00, 9:00 (arroz al micro) y 10:00 (agua, solo si espesa)', () => {
  assert.equal(p4.duracion_s, 720);
  assert.deepEqual(p4.avisos.map(a => a.a_los_s), [0, 360, 540, 600]);
  const arroz = p4.avisos.find(a => a.a_los_s === p4.duracion_s - 180);
  assert.match(arroz.texto, /Arroz al microondas, 3 minutos/);
  assert.ok(p4.carriles.includes('micro'));
  assert.match(p4.avisos[3].texto, /Si espesa demasiado/);
  assert.equal(new Set(p4.avisos.map(a => a.a_los_s)).size, p4.avisos.length);
  assert.match(p4.voz_fin, /Escurre la pasta/);
  assert.match(p4.consejo, /más de 12 min, usa \+1 min/);
});

test('albóndigas · paso 5: reposo de 45 min', () => {
  assert.equal(p5.aviso_reposo_min, 45);
  assert.equal(p5.duracion_s, 0);
});

test('albóndigas · el gantt (2 tandas) dura 40 min más el reparto y cuadra con los pasos', () => {
  const g = albondigas.plan_gantt;
  const seg = (paso, carril) => g.find(x => x.paso === paso && x.carril === carril);
  for (const [idx, carril] of [[0, 'manos'], [1, 'airfryer'], [2, 'airfryer'], [3, 'fuego']]) {
    const s = seg(idx, carril);
    assert.equal((s.hasta_min - s.desde_min) * 60, albondigas.pasos[idx].duracion_s, `paso ${idx + 1}`);
  }
  assert.equal(seg(1, 'airfryer').desde_min, seg(0, 'manos').hasta_min);
  assert.equal(seg(2, 'airfryer').desde_min, seg(1, 'airfryer').hasta_min);
  assert.equal(seg(3, 'fuego').desde_min, seg(2, 'airfryer').hasta_min);
  assert.equal(seg(3, 'fuego').hasta_min, 40);
  assert.equal(seg(4, 'manos').desde_min, 40);
  // El arroz entra al micro a falta de 3 min y acaba con el paso (28 + 9 = 37 → 40).
  const micro = seg(3, 'micro');
  assert.deepEqual([micro.desde_min, micro.hasta_min], [28 + 540 / 60, 40]);
  // 8+10+10+12 = 40 min de cocina.
  const total = albondigas.pasos.reduce((a, p) => a + p.duracion_s, 0) / 60;
  assert.equal(total, albondigas.meta.tiempo_total_min);
});

test('albóndigas · el agua va primero y el checklist reparte en dos grupos', () => {
  assert.match(p1.detalle, /^Lo primero: pota con agua y sal a fuego alto, tapada\./);
  assert.match(p1.checklist[0], /11 y 10 bolas/);
});
