# Copiloto Cocina

**URL principal: https://cocina-byz.pages.dev/**

PWA para cocinar sin mirar el móvil: paso a paso, voz, temporizador por avisos y diagrama de lo que pasa en paralelo (fuego / manos / micro / reposo).

Independiente de Copiloto 18K — no comparte código ni repo.

## Despliegue

Cloudflare Pages (origen propio) es la URL principal. También se publica en GitHub Pages
(`amenedorubn.github.io/cocina/`), pero ese dominio lo comparten varias PWA del mismo autor
(Entrenador AENA, Japón, Copiloto 18K...) y Chrome puede confundir la identidad de la app al
instalarla ahí. Cloudflare Pages tiene origen propio y evita ese choque.

- **Manual** (Pages clásico, no Workers): copia solo la app a `_site` y despliega esa carpeta, sin `.git` ni tests:
  ```
  mkdir _site && cp -r index.html cocina.html app.css manifest.webmanifest sw.js js icons recetas _site/
  npx wrangler pages deploy _site --project-name=cocina --branch=main
  ```
- **Automático:** `.github/workflows/deploy.yml` despliega en cada push a `main`. Necesita dos
  secretos del repo (Settings → Secrets and variables → Actions):
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_API_TOKEN` — token con permiso **Account → Cloudflare Pages → Edit**, limitado a
    esta cuenta (no uses el token de login de `wrangler`, que es de sesión y de alcance mucho más
    amplio).

## Versión y caché

Versión de la app: `package.json` (1.3.0). El service worker usa `cocina-vN` (`sw.js`): **súbelo cada vez que cambie un archivo del shell o una receta**, o el móvil seguirá con la copia vieja. El SW sirve de caché y revalida en segundo plano: tras publicar, hay que abrir la app 2 veces (la primera descarga lo nuevo, la segunda ya lo usa).

## Tests

```
npm install
npm test            # esquema de todas las recetas, tiempos de avisos, contraste 4,5:1, sin amarillo fuera del curry
npm run test:e2e    # Playwright 390×844, claro y oscuro; capturas en tests/e2e/capturas/
```

## Color por receta

La app es neutra (grafito/blanco). Cada receta puede llevar su color en `tema`; solo se aplica al abrir esa receta (`js/theme.js` lo vuelca a `--r-*`) y también cambia `<meta name="theme-color">`, que toma el **fondo** de la pantalla (la superficie de la receta en claro; el neutro oscuro en oscuro) para que la barra de estado no desentone. En la home, cada tarjeta muestra su acento como una barra fina.

- Acento: como mucho 2 usos por pantalla (botón principal + fuego en el Gantt, o temporizador vencido). Sin degradados, sin índigo/violeta.
- Contraste ≥ 4,5:1 del acento sobre la superficie y del texto sobre el acento, en claro y en oscuro (`tests/contraste.test.mjs`). Si un acento no llega, `Contrast.fit` lo oscurece (claro) o aclara (oscuro) en runtime, y el test exige que los valores del JSON ya sean los finales.
- Valores finales: tomate `#B8321F` / `#E8664F` sobre `#FBF7F0`; curry `#8B6909` (el `#E9B00F` original daba 1,8:1 sobre crema) / `#E9B00F` (en oscuro sí pasa, 9,3:1) sobre `#FBF6E6`.

## Estructura

```
index.html         Home: listado de recetas + importar JSON
cocina.html         Modo cocina: ficha de receta, cocinar, plan/gantt
js/                 Lógica (home, receta, cocina, voz, temporizador, gantt, sw-register)
recetas/*.json      Recetas (formato abajo)
recetas/receta.schema.json  Esquema JSON (lo valida `npm test`)
recetas/index.json  Índice de recetas propias del repo (para el home y el service worker)
icons/              Iconos del manifest
sw.js               Service worker (offline)
manifest.webmanifest
```

## Formato de receta (`/recetas/<id>.json`)

```jsonc
{
  "id": "curry-pollo",
  "tema": { "acento": "#B8321F", "acento_oscuro": "#E8664F", "superficie": "#FBF7F0" },   // opcional
  "meta": {
    "titulo": "...", "raciones": 2, "tiempo_total_min": 25,
    "notas": ["..."],
    "reparto": { "hoy": "...", "taper": "...", "dia_consumo": "...", "recalentar": ["..."] }
  },
  "ingredientes": [{ "grupo": "opcional", "nombre": "...", "cantidad": "..." }],
  "pasos": [{
    "titulo": "...", "detalle": "...",
    "fuego": "medio-alto" | null,
    "duracion_s": 240,
    "estimado": "≈3 min",          // solo si duracion_s es 0
    "carriles": ["fuego", "manos"], // fuego | manos | airfryer | micro | reposo
    "mientras_tanto": "...",
    "usa": [0, 3],                  // opcional: posiciones en "ingredientes" que se ven (con cantidad) en ese paso
    "solo_esto": false,
    "checklist": ["..."],
    "avisos": [{ "a_los_s": 120, "voz": "...", "texto": "..." }],
    "aviso_reposo_min": 45,          // opcional: temporizador de reposo aparte, tras este paso
    "voz_inicio": "...", "voz_fin": "...", "consejo": null
  }],
  "plan_gantt": [
    { "desde_min": 0, "hasta_min": 3, "carril": "manos", "etiqueta": "Preparar", "paso": 0 }
  ]
}
```

Para pedirle a Claude una receta nueva en este formato, y pegarla en el home con "Importar JSON".

## Experimental: avisos con pantalla bloqueada (Chrome Android)

Pendiente de probar en dispositivo. Ver interruptor "Experimental" en modo cocina.

Resultado: _por confirmar_.
