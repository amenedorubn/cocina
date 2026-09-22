(function () {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const recipeId = params.get('id');

  if (!recipeId) { $('loadError').textContent = 'Falta el parámetro ?id= en la URL.'; $('loadError').classList.remove('hidden'); return; }

  let recipe = null;
  let S = null;
  let alarmOn = false;
  let lastBeep = 0;

  const KEY_FALLBACK = () => ({
    screen: 'start', step: 0, endAt: null, paused: null,
    fired: [], checks: {}, reposo: null, started: false,
  });

  const save = () => Store.saveCookState(recipeId, S);
  const fmt = s => { const neg = s < 0; s = Math.abs(Math.round(s)); return (neg ? '+' : '') + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const totalMin = () => (recipe.meta.tiempo_total_min) || (recipe.plan_gantt ? Math.max(...recipe.plan_gantt.map(p => p.hasta_min)) : 0);

  function show(scr) { ['start', 'cook', 'plan'].forEach(x => $(x).classList.toggle('hidden', x !== scr)); }

  function renderStart() {
    $('pageTitle').textContent = recipe.meta.titulo;
    $('heroTitle').textContent = recipe.meta.titulo;
    $('heroTitle').style.fontSize = 'clamp(40px,12vw,72px)';
    const bits = [];
    if (recipe.meta.raciones) bits.push(recipe.meta.raciones + ' raciones');
    if (recipe.meta.tiempo_total_min) bits.push(recipe.meta.tiempo_total_min + ' min');
    if (recipe.meta.reparto && recipe.meta.reparto.dia_consumo) bits.push('hoy + ' + recipe.meta.reparto.dia_consumo.toLowerCase());
    $('heroSub').textContent = bits.join(' · ');

    const notas = recipe.meta.notas || [];
    $('notasBox').classList.toggle('hidden', !notas.length);
    $('notasList').innerHTML = notas.map(n => `<p>${escapeHtml(n)}</p>`).join('');

    $('ingList').innerHTML = (recipe.ingredientes || []).map(i =>
      `<li><span>${escapeHtml(i.nombre)}</span><span>${escapeHtml(i.cantidad)}</span></li>`).join('');

    renderGantt($('ganttStart'), recipe.plan_gantt, totalMin(), null);

    const rep = recipe.meta.reparto;
    $('repartoBox').classList.toggle('hidden', !rep);
    if (rep) {
      $('repartoHoy').innerHTML = rep.hoy ? `<b>Hoy:</b> ${escapeHtml(rep.hoy)}` : '';
      $('repartoTaper').innerHTML = rep.taper ? `<b>Táper:</b> ${escapeHtml(rep.taper)}` : '';
      $('repartoDia').innerHTML = rep.dia_consumo ? `<b>Día de consumo:</b> ${escapeHtml(rep.dia_consumo)}` : '';
      $('repartoRecalentar').innerHTML = (rep.recalentar || []).length
        ? '<p><b>Cómo recalentar</b></p>' + rep.recalentar.map((r, i) => `<p>${i + 1}. ${escapeHtml(r)}</p>`).join('') : '';
    }

    const prefs = Store.prefs();
    $('expToggle').checked = !!prefs.experimental;

    $('resume').classList.toggle('hidden', !S.started);
    if (S.started) $('resume').textContent = 'Seguir en el paso ' + (S.step + 1) + ': ' + recipe.pasos[S.step].titulo.toLowerCase();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderStep() {
    const st = recipe.pasos[S.step];
    $('prog').innerHTML = recipe.pasos.map((_, i) => `<i class="${i < S.step ? 'done' : i === S.step ? 'now' : ''}"></i>`).join('');
    $('meta').innerHTML = `<span class="stepn">Paso ${S.step + 1} de ${recipe.pasos.length}</span>` +
      (st.fuego ? `<span class="tag" style="background:var(--fuego)">Fuego ${st.fuego.toLowerCase()}</span>` : '') +
      (st.carriles || []).filter(l => l !== 'fuego').map(l => `<span class="tag" style="background:${LANES[l] ? LANES[l].c : 'var(--muted)'}">${LANES[l] ? LANES[l].n : l}</span>`).join('') +
      (st.estimado ? `<span class="tag" style="background:var(--muted)">${escapeHtml(st.estimado)}</span>` : '');
    $('title').textContent = st.titulo;
    $('detail').textContent = st.detalle || '';
    $('timerBox').classList.toggle('hidden', !st.duracion_s);
    $('cues').innerHTML = (st.avisos || []).map(c => `<li data-at="${c.a_los_s}"><b>${fmt(st.duracion_s - c.a_los_s)}</b>${escapeHtml(c.texto || '')}</li>`).join('');
    const ch = st.checklist || [];
    $('checks').innerHTML = ch.map((c, i) => `<li><button aria-pressed="${!!S.checks[S.step + '-' + i]}" data-i="${i}">${escapeHtml(c)}</button></li>`).join('');
    $('par').classList.toggle('hidden', !st.mientras_tanto);
    $('par').classList.toggle('solo', !!st.solo_esto);
    $('parH').textContent = st.solo_esto ? 'Solo esto' : 'Mientras tanto';
    $('parP').textContent = st.mientras_tanto || '';
    $('tip').textContent = st.consejo || '';
    $('tip').classList.toggle('hidden', !st.consejo);
    $('extra').innerHTML = st.aviso_reposo_min ? reposoHTML(st) : '';
    const nx = recipe.pasos[S.step + 1];
    $('nextup').textContent = nx ? 'Luego: ' + nx.titulo.toLowerCase() : '';
    $('pauseBtn').classList.toggle('hidden', !st.duracion_s);
    $('plusBtn').classList.toggle('hidden', !st.duracion_s);
    $('backBtn').classList.toggle('hidden', S.step === 0);
    $('doneBtn').textContent = S.step === recipe.pasos.length - 1 ? 'Terminar' : 'Hecho';
    tick(true);
  }

  function reposoHTML(st) {
    const active = S.reposo && S.reposo.forStep === S.step;
    const left = active && !S.reposo.done ? Math.max(0, (S.reposo.endAt - Date.now()) / 1000) : null;
    return `<div class="box"><h2>Reposo (${st.aviso_reposo_min} min)</h2>
     ${active
        ? `<p id="reposoTxt"><b>${left > 0 ? 'Aviso en ' + fmt(left) : 'Ya: revisa y guarda.'}</b></p>`
        : `<button class="ghost" id="reposoBtn" style="margin-top:0">Avisarme en ${st.aviso_reposo_min} min</button>`}
     <p style="font-size:15px;color:var(--muted);margin-top:8px">Deja esta pantalla abierta para que suene.</p></div>`;
  }

  /* ---------- timer ---------- */
  function startTimer() {
    const st = recipe.pasos[S.step];
    S.fired = []; alarmOn = false;
    S.endAt = st.duracion_s ? Date.now() + st.duracion_s * 1000 : null;
    S.paused = null;
    save();
  }
  function remaining() {
    const st = recipe.pasos[S.step];
    if (!st.duracion_s) return null;
    if (S.paused != null) return S.paused;
    if (!S.endAt) return st.duracion_s;
    return (S.endAt - Date.now()) / 1000;
  }

  function tick() {
    if (!S || S.screen !== 'cook') return;
    const st = recipe.pasos[S.step];

    if (st.aviso_reposo_min && S.reposo && S.reposo.forStep === S.step && !S.reposo.done) {
      const l = (S.reposo.endAt - Date.now()) / 1000;
      const el = $('reposoTxt');
      if (el) el.innerHTML = '<b>' + (l > 0 ? 'Aviso en ' + fmt(l) : 'Ya: revisa y guarda.') + '</b>';
      if (l <= 0) { S.reposo.done = true; save(); Voice.say(st.voz_fin || 'Se cumplió el tiempo de reposo.'); alarmOn = true; }
    }

    if (!st.duracion_s) { document.title = recipe.meta.titulo; alarmUI(); return; }

    const r = remaining(); const el = st.duracion_s - r;
    $('digits').textContent = fmt(r);
    $('digits').classList.toggle('over', r < 0);
    $('tbar').style.width = Math.min(100, Math.max(0, el / st.duracion_s * 100)) + '%';
    document.title = (r < 0 ? '⏰ ' : '') + fmt(r) + ' · ' + st.titulo;

    const lis = [...$('cues').children]; let nextMarked = false;
    (st.avisos || []).forEach((c) => {
      const k = S.step + ':' + c.a_los_s;
      const li = lis.find(x => Number(x.dataset.at) === c.a_los_s);
      if (el >= c.a_los_s && !S.fired.includes(k) && S.paused == null) {
        S.fired.push(k); save();
        const missed = el - c.a_los_s > 5;
        Voice.beep(2, 660); Voice.buzz([150, 80, 150]);
        Voice.say((missed ? 'Atención, ' : '') + c.voz);
      }
      const fired = S.fired.includes(k);
      li && li.classList.toggle('fired', fired);
      if (!fired && !nextMarked) { li && li.classList.add('next'); nextMarked = true; }
      else li && li.classList.remove('next');
    });

    const endK = S.step + ':end';
    if (r <= 0 && S.paused == null && !S.fired.includes(endK)) {
      S.fired.push(endK); save(); alarmOn = true;
      Voice.beep(3); Voice.buzz([300, 120, 300, 120, 300]);
      Voice.say(st.voz_fin || '');
    }
    if (r <= 0 && S.paused == null) alarmOn = true;
    $('tstate').textContent = S.paused != null ? 'En pausa' : (r <= 0 ? 'Tiempo cumplido · toca Hecho' : '');
    $('pauseBtn').textContent = S.paused != null ? 'Seguir' : 'Pausa';
    alarmUI();
  }
  function alarmUI() {
    $('doneBtn').classList.toggle('alarm', alarmOn);
    if (alarmOn && Date.now() - lastBeep > 4000) { lastBeep = Date.now(); Voice.beep(3); Voice.buzz([250, 100, 250]); }
  }
  setInterval(() => tick(), 250);

  /* ---------- avisos perdidos al volver a primer plano ---------- */
  function catchUpOnResume() {
    if (!S || S.screen !== 'cook') return;
    const st = recipe.pasos[S.step];

    if (st.aviso_reposo_min && S.reposo && S.reposo.forStep === S.step && !S.reposo.done) {
      const l = (S.reposo.endAt - Date.now()) / 1000;
      if (l <= 0) {
        S.reposo.done = true; save();
        Voice.beep(2, 660); Voice.buzz([150, 80, 150]);
        Voice.say('Mientras no mirabas: se cumplió el tiempo de reposo. ' + (st.voz_fin || ''));
      }
    }

    if (!st.duracion_s) return;
    const r = remaining(); const el = st.duracion_s - r;
    const parts = [];
    (st.avisos || []).forEach(c => {
      const k = S.step + ':' + c.a_los_s;
      if (el >= c.a_los_s && !S.fired.includes(k)) { S.fired.push(k); parts.push(c.texto || c.voz); }
    });
    const endK = S.step + ':end';
    let endedToo = false;
    if (r <= 0 && S.paused == null && !S.fired.includes(endK)) { S.fired.push(endK); alarmOn = true; endedToo = true; }
    if (parts.length || endedToo) {
      save();
      Voice.beep(2, 660); Voice.buzz([150, 80, 150]);
      let msg = 'Mientras no mirabas: ' + parts.join('. ');
      if (endedToo) msg += (parts.length ? '. ' : '') + 'Y el paso ha terminado. ' + (st.voz_fin || '');
      Voice.say(msg.trim());
    }
    tick();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (S.screen === 'cook') WakeLock.acquire();
      catchUpOnResume();
    }
  });
  WakeLock.onStatus(status => {
    const el = $('wl');
    if (status === 'ok') { el.textContent = 'Pantalla fija ✓'; el.classList.add('ok'); }
    else { el.textContent = 'Pantalla: manual'; el.classList.remove('ok'); }
  });

  /* ---------- acciones ---------- */
  function goStep(i) { S.step = i; startTimer(); save(); renderStep(); Voice.say(recipe.pasos[i].voz_inicio); }
  function begin() {
    Voice.unlock(); WakeLock.acquire();
    S.screen = 'cook'; S.started = true; show('cook'); goStep(0);
    if (Store.prefs().experimental) KeepAlive.start(recipe.meta.titulo);
  }

  $('go').onclick = () => { S.checks = {}; S.reposo = null; begin(); };
  $('resume').onclick = () => {
    Voice.unlock(); WakeLock.acquire();
    S.screen = 'cook'; show('cook'); renderStep();
    Voice.say('Seguimos. ' + recipe.pasos[S.step].titulo);
    if (Store.prefs().experimental) KeepAlive.start(recipe.meta.titulo);
  };
  $('testVoice').onclick = () => { Voice.unlock(); Voice.beep(2); Voice.buzz(200); Voice.say('Así te voy a avisar. Sube el volumen si no me oyes.'); };
  $('doneBtn').onclick = () => {
    Voice.unlock(); alarmOn = false;
    if (S.step < recipe.pasos.length - 1) { goStep(S.step + 1); return; }
    if (S.reposo && !S.reposo.done) { Voice.say('Sigo pendiente del aviso de reposo.'); return; }
    S.screen = 'start'; S.started = false; save();
    KeepAlive.stop(); WakeLock.release();
    show('start'); renderStart(); Voice.say('Buen provecho.');
  };
  $('backBtn').onclick = () => { if (S.step > 0) { alarmOn = false; goStep(S.step - 1); } };
  $('plusBtn').onclick = () => {
    const st = recipe.pasos[S.step]; if (!st.duracion_s) return; alarmOn = false;
    const r = remaining(); const nr = Math.max(r, 0) + 60;
    if (S.paused != null) S.paused = nr; else S.endAt = Date.now() + nr * 1000;
    S.fired = S.fired.filter(k => k !== S.step + ':end'); save(); Voice.say('Un minuto más.'); tick();
  };
  $('pauseBtn').onclick = () => {
    if (S.paused != null) { S.endAt = Date.now() + S.paused * 1000; S.paused = null; Voice.say('Seguimos.'); }
    else { S.paused = remaining(); Voice.say('Pausa.'); }
    save(); tick();
  };
  $('checks').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = S.step + '-' + b.dataset.i;
    S.checks[k] = !S.checks[k]; b.setAttribute('aria-pressed', S.checks[k]); save();
  };
  $('extra').onclick = e => {
    if (e.target.id === 'reposoBtn') {
      const st = recipe.pasos[S.step];
      S.reposo = { forStep: S.step, endAt: Date.now() + st.aviso_reposo_min * 60000, done: false };
      save(); renderStep();
      Voice.say('Te aviso en ' + st.aviso_reposo_min + ' minutos.');
    }
  };
  $('voiceBtn').onclick = () => {
    const prefs = Store.prefs(); prefs.voice = !prefs.voice; Store.savePrefs(prefs);
    $('voiceBtn').textContent = prefs.voice ? '🔊' : '🔇';
    if (prefs.voice) Voice.say('Voz activada.'); else speechSynthesis && speechSynthesis.cancel();
  };
  $('expToggle').onchange = () => {
    const prefs = Store.prefs(); prefs.experimental = $('expToggle').checked; Store.savePrefs(prefs);
    if (!prefs.experimental) KeepAlive.stop();
  };
  $('planBtn').onclick = () => { renderGantt($('ganttPlan'), recipe.plan_gantt, totalMin(), S.screen === 'cook' ? S.step : null); show('plan'); };
  $('planBtnStart').onclick = () => { renderGantt($('ganttPlan'), recipe.plan_gantt, totalMin(), null); show('plan'); };
  $('closePlan').onclick = () => show(S.screen);
  $('resetBtn').onclick = () => {
    alarmOn = false; KeepAlive.stop(); WakeLock.release();
    S = KEY_FALLBACK(); save();
    show('start'); renderStart();
  };

  /* ---------- init ---------- */
  (async function init() {
    try {
      recipe = await Recipe.load(recipeId);
    } catch (e) {
      $('loadError').textContent = 'No se pudo cargar la receta: ' + e.message;
      $('loadError').classList.remove('hidden');
      return;
    }
    S = Store.cookState(recipeId, KEY_FALLBACK());
    const prefs = Store.prefs();
    $('voiceBtn').textContent = prefs.voice ? '🔊' : '🔇';
    S.screen = 'start';
    renderStart();
    show('start');
  })();
})();
