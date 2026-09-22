# Copiloto Cocina

**URL principal: https://cocina-byz.pages.dev/**

PWA para cocinar sin mirar el móvil: paso a paso, voz, temporizador por avisos y diagrama de lo que pasa en paralelo (fuego / manos / micro / reposo).

Independiente de Copiloto 18K — no comparte código ni repo.

## Despliegue

Cloudflare Pages (origen propio) es la URL principal. También se publica en GitHub Pages
(`amenedorubn.github.io/cocina/`), pero ese dominio lo comparten varias PWA del mismo autor
(Entrenador AENA, Japón, Copiloto 18K...) y Chrome puede confundir la identidad de la app al
instalarla ahí. Cloudflare Pages tiene origen propio y evita ese choque.

- **Manual:** `npx wrangler pages deploy . --project-name=cocina --branch=main` (excluye `.git`,
  `.github`, etc. vía `.assetsignore`).
- **Automático:** `.github/workflows/deploy.yml` despliega en cada push a `main`. Necesita dos
  secretos del repo (Settings → Secrets and variables → Actions):
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_API_TOKEN` — token con permiso **Account → Cloudflare Pages → Edit**, limitado a
    esta cuenta (no uses el token de login de `wrangler`, que es de sesión y de alcance mucho más
    amplio).

## Estructura

```
index.html         Home: listado de recetas + importar JSON
cocina.html         Modo cocina: ficha de receta, cocinar, plan/gantt
js/                 Lógica (home, receta, cocina, voz, temporizador, gantt, sw-register)
recetas/*.json      Recetas (formato abajo)
recetas/index.json  Índice de recetas propias del repo (para el home y el service worker)
icons/              Iconos del manifest
sw.js               Service worker (offline)
manifest.webmanifest
```

## Formato de receta (`/recetas/<id>.json`)

```jsonc
{
  "id": "curry-pollo",
  "meta": {
    "titulo": "...", "raciones": 2, "tiempo_total_min": 25,
    "notas": ["..."],
    "reparto": { "hoy": "...", "taper": "...", "dia_consumo": "...", "recalentar": ["..."] }
  },
  "ingredientes": [{ "nombre": "...", "cantidad": "..." }],
  "pasos": [{
    "titulo": "...", "detalle": "...",
    "fuego": "medio-alto" | null,
    "duracion_s": 240,
    "estimado": "≈3 min",          // solo si duracion_s es 0
    "carriles": ["fuego", "manos"], // fuego | manos | micro | reposo
    "mientras_tanto": "...",
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
