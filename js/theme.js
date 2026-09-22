// Modo claro/oscuro: 'auto' sigue al sistema, o se fuerza light/dark.
(function () {
  const prefs = Store.prefs();
  applyTheme(prefs.theme || 'auto');

  function applyTheme(mode) {
    if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
  }

  window.Theme = {
    cycle() {
      const p = Store.prefs();
      const order = ['auto', 'light', 'dark'];
      const next = order[(order.indexOf(p.theme || 'auto') + 1) % order.length];
      p.theme = next;
      Store.savePrefs(p);
      applyTheme(next);
      return next;
    },
    current() { return Store.prefs().theme || 'auto'; },
  };
})();
