// Contraste WCAG. Sirve en navegador (global Contrast) y en Node (module.exports).
(function (root) {
  const hex2rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  const rgb2hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = h => { const [r, g, b] = hex2rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // Mezcla en sRGB igual que color-mix(in srgb, a p%, b).
  const mix = (a, b, p) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v * p + B[i] * (1 - p))); };
  // Texto sobre un relleno: el que más contraste da entre casi-negro y blanco.
  const onColor = bg => ratio('#FFFFFF', bg) >= ratio('#16171A', bg) ? '#FFFFFF' : '#16171A';
  // Acerca `color` a negro (dir=-1) o a blanco (dir=1) hasta llegar a `min` sobre `bg`. Conserva el matiz.
  function fit(color, bg, min, dir) {
    let t = 0, c = color;
    while (ratio(c, bg) < min && t < 1) { t += 0.005; c = mix(dir < 0 ? '#000000' : '#FFFFFF', color, t); }
    return c;
  }
  const api = { hex2rgb, rgb2hex, lum, ratio, mix, onColor, fit };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Contrast = api;
})(typeof window !== 'undefined' ? window : globalThis);
