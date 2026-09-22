(function () {
  const $ = id => document.getElementById(id);

  $('themeBtn').onclick = () => { Theme.cycle(); };

  function slug(s) {
    return (s || 'receta').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'receta';
  }

  function validate(recipe) {
    if (!recipe || typeof recipe !== 'object') return 'No es un objeto JSON válido.';
    if (!recipe.meta || !recipe.meta.titulo) return 'Falta meta.titulo.';
    if (!Array.isArray(recipe.pasos) || !recipe.pasos.length) return 'Falta el array de pasos.';
    if (!Array.isArray(recipe.ingredientes)) return 'Falta el array de ingredientes.';
    return null;
  }

  async function loadBuiltins() {
    try {
      const res = await fetch('recetas/index.json');
      if (!res.ok) return [];
      const list = await res.json();
      return list.map(r => ({ ...r, source: 'builtin' }));
    } catch (e) { return []; }
  }

  function loadCustoms() {
    const custom = Store.customRecipes();
    return Object.values(custom).map(r => ({
      id: r.id, titulo: r.meta.titulo,
      raciones: r.meta.raciones, tiempo_total_min: r.meta.tiempo_total_min,
      source: 'custom',
    }));
  }

  async function renderCards() {
    const [builtins, customs] = [await loadBuiltins(), loadCustoms()];
    const all = [...builtins, ...customs];
    const el = $('cards');
    if (!all.length) {
      el.innerHTML = '<li class="empty">Todavía no hay recetas. Importa una con el botón de abajo.</li>';
      return;
    }
    el.innerHTML = all.map(r => `
      <li>
        <button class="card" data-id="${r.id}">
          <span class="t">${escapeHtml(r.titulo)}</span>
          <span class="m">${r.raciones ? r.raciones + ' raciones · ' : ''}${r.tiempo_total_min ? r.tiempo_total_min + ' min' : ''}</span>
          ${r.source === 'custom' ? '<span class="tag">Importada</span>' : ''}
        </button>
      </li>`).join('');
    [...el.querySelectorAll('.card')].forEach(btn => {
      btn.onclick = () => { location.href = `cocina.html?id=${encodeURIComponent(btn.dataset.id)}`; };
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  $('importBtn').onclick = () => { $('importText').value = ''; $('importError').classList.add('hidden'); $('importDialog').showModal(); };
  $('importCancel').onclick = () => $('importDialog').close();

  $('importSave').onclick = () => {
    const raw = $('importText').value.trim();
    let recipe;
    try { recipe = JSON.parse(raw); }
    catch (e) { showError('JSON inválido: ' + e.message); return; }

    const err = validate(recipe);
    if (err) { showError(err); return; }
    if (!recipe.id) recipe.id = slug(recipe.meta.titulo);

    Store.saveCustomRecipe(recipe);
    $('importDialog').close();
    renderCards();
  };

  function showError(msg) {
    const el = $('importError');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  renderCards();
})();
