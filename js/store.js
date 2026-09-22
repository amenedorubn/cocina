// Persistencia compartida: recetas importadas, preferencias, estado de cocina por receta.
const Store = (() => {
  const K_CUSTOM = 'cocina.recetas.custom';
  const K_PREFS = 'cocina.prefs';
  const K_COOK = id => `cocina.estado.${id}`;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  return {
    customRecipes() { return read(K_CUSTOM, {}); },
    saveCustomRecipe(recipe) {
      const all = read(K_CUSTOM, {});
      all[recipe.id] = recipe;
      write(K_CUSTOM, all);
    },
    deleteCustomRecipe(id) {
      const all = read(K_CUSTOM, {});
      delete all[id];
      write(K_CUSTOM, all);
    },
    prefs() { return read(K_PREFS, { voice: true, experimental: false, theme: 'auto' }); },
    savePrefs(p) { write(K_PREFS, p); },
    cookState(id, fallback) { return read(K_COOK(id), fallback); },
    saveCookState(id, state) { write(K_COOK(id), state); },
    clearCookState(id) { try { localStorage.removeItem(K_COOK(id)); } catch (e) {} },
  };
})();
