// Tema: modo claro/oscuro ('auto' sigue al sistema) + tema por receta (color de acento).
// Por defecto la app es neutra (grafito/blanco). Una receta puede traer
//   "tema": {"acento": "#B8321F", "acento_oscuro": "#E8664F", "superficie": "#FBF7F0"}
// y solo mientras se cocina esa receta se aplican a las variables CSS --r-*.
(function () {
  const prefs = Store.prefs();

  const META = () => document.querySelector('meta[name="theme-color"]');
  const DEFAULT_BG = { light: '#F5F5F3', dark: '#141517' };
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const MIN = 4.5;
  const dark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  let recipeSurface = null;

  function isDark() {
    const m = document.documentElement.getAttribute('data-theme');
    return m ? m === 'dark' : !!(dark && dark.matches);
  }

  // La barra de estado del móvil toma el fondo real de la pantalla: neutro, o la superficie de la receta en claro.
  function syncMeta() {
    const el = META(); if (!el) return;
    el.setAttribute('content', isDark() ? DEFAULT_BG.dark : (recipeSurface || DEFAULT_BG.light));
  }

  function applyMode(mode) {
    if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
    syncMeta();
  }
  applyMode(prefs.theme || 'auto');
  if (dark && dark.addEventListener) dark.addEventListener('change', syncMeta);

  // Si un acento no llega a 4,5:1 sobre el fondo, se acerca a negro (claro) o blanco (oscuro).
  function safeAccents(tema) {
    const sup = tema.superficie && HEX.test(tema.superficie) ? tema.superficie : null;
    const l = tema.acento && HEX.test(tema.acento) ? Contrast.fit(tema.acento, sup || DEFAULT_BG.light, MIN, -1) : null;
    const d = tema.acento_oscuro && HEX.test(tema.acento_oscuro) ? Contrast.fit(tema.acento_oscuro, DEFAULT_BG.dark, MIN, 1) : null;
    return { sup, l, d };
  }

  function setVars(vars) {
    const st = document.documentElement.style;
    ['--r-sup', '--r-acc-l', '--r-on-l', '--r-acc-d', '--r-on-d'].forEach(k => st.removeProperty(k));
    Object.entries(vars).forEach(([k, v]) => { if (v) st.setProperty(k, v); });
  }

  window.Theme = {
    cycle() {
      const p = Store.prefs();
      const order = ['auto', 'light', 'dark'];
      const next = order[(order.indexOf(p.theme || 'auto') + 1) % order.length];
      p.theme = next;
      Store.savePrefs(p);
      applyMode(next);
      return next;
    },
    current() { return Store.prefs().theme || 'auto'; },
    // Acentos ya corregidos por contraste (también los usa la home para el detalle de cada tarjeta).
    accents(tema) { return tema ? safeAccents(tema) : { sup: null, l: null, d: null }; },
    applyRecipe(tema) {
      if (!tema) { this.reset(); return; }
      const a = safeAccents(tema);
      recipeSurface = a.sup;
      setVars({
        '--r-sup': a.sup,
        '--r-acc-l': a.l, '--r-on-l': a.l && Contrast.onColor(a.l),
        '--r-acc-d': a.d, '--r-on-d': a.d && Contrast.onColor(a.d),
      });
      syncMeta();
    },
    reset() { recipeSurface = null; setVars({}); syncMeta(); },
  };
})();
