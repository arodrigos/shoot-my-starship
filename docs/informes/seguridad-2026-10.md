# Auditoría de seguridad — octubre de 2026

Revisión de la rama `dev` contra el OWASP Top 10 (2021), con sus dependencias,
su CI y lo que queda expuesto en el cliente y en el historial del repo.

## Alcance y método

- **Código**: `src/` (cliente Next.js + Phaser), `next.config.ts`,
  `vercel.json`, `src/app/` (rutas, manifiesto, service worker).
- **CI**: `.github/workflows/*.yml` y `scripts/comprobar-publico.mjs`.
- **Dependencias**: `npm audit` (completo y con `--omit=dev`) sobre
  `package-lock.json`.
- **Repo público**: búsqueda de credenciales, claves, correos, rutas de máquina
  y direcciones privadas en el árbol actual y en todo el historial de git
  (diffs añadidos y ficheros borrados).
- **Superficie de cliente**: entradas por URL, `localStorage`/`sessionStorage`,
  `JSON.parse`, HTML crudo (`dangerouslySetInnerHTML`, `innerHTML`, `eval`),
  `postMessage`, variables `NEXT_PUBLIC_*`, ganchos globales.

### Contexto que acota el riesgo

El juego es 100 % cliente: no hay servidor propio, base de datos,
autenticación, sesiones, cookies ni llamadas a APIs. Todas las páginas se
prerenderizan como estáticas (`next build`: `○ /`, `○ /pruebas/*`, `●
/serwist/*`). Por eso **A01 (control de acceso)**, **A07 (autenticación)** y
**A10 (SSRF)** no tienen superficie propia, y **A03 (inyección)** se reduce a
XSS en el cliente: no se encontró ningún uso de `dangerouslySetInnerHTML`,
`innerHTML`, `eval`, `new Function` ni `document.write`; los nombres de
jugador pasan por `sanearNombre` y se pintan con React o con texto de Phaser,
que no interpretan HTML.

Lo que sí se comprobó y está bien:

- La partida guardada (`src/juego/partidaGuardada/validar.ts:237`) se valida
  campo a campo, con tope de tamaño, y nunca lanza con una cadena cualquiera.
  El resto de preferencias de `localStorage` se sanean al leerse.
- No hay ninguna credencial, clave privada ni token en el árbol ni en el
  historial (282 commits revisados). `.gitignore` excluye `.env*` y `*.pem`.
- Las acciones de GitHub están fijadas por SHA; `reintentar-ci.yml` no hace
  checkout con token de escritura; `pruebas-a-demanda.yml` valida sus entradas
  con expresiones regulares y nunca las interpola en un `run`.
- La única variable pública (`NEXT_PUBLIC_VERSION_APP`) es el SHA corto del
  commit, ya público.

## Resumen por severidad

| Severidad | Hallazgos | Arreglados en este PR |
| --- | --- | --- |
| Crítica | 0 | — |
| Alta | 1 (S-01) | 1 de forma parcial (S-01, parche 16.3.8) |
| Media | 3 (S-02, S-03, S-04) | 1 (S-02) |
| Baja | 7 (S-05 … S-11) | 1 de forma parcial (S-05) |

No se encontró ningún secreto, así que no hay ningún hallazgo crítico por
filtración.

## Hallazgos

### S-01 · Next.js con avisos de seguridad conocidos

- **Categoría**: A06:2021 Componentes vulnerables y obsoletos
- **Severidad**: alta (npm la marca crítica; ver contexto)
- **Fichero**: `package.json:30` (`next`), `package.json:49` (`eslint-config-next`)
- **Evidencia**: `npm audit` sobre `next@16.3.6` devolvía 10 avisos:
  GHSA-3w37-wq28-93x7, GHSA-4jqv-mc3x-m676, GHSA-39w2-rjm5-chcv,
  GHSA-f87g-xv8r-7p7x, GHSA-mcj8-r9mp-w47p, GHSA-cjq9-62q9-8jv4 y
  GHSA-h694-7cp9-m8p3 (corregidos en 16.3.8), y GHSA-2464-fhr4-w9xw (RCE en
  la optimización de imágenes con SVG, crítica), GHSA-673q-mjm6-r5xr (RCE en
  funciones `use cache`, crítica) y GHSA-p3m5-59mp-jv5r (DoS con Server
  Actions, alta), que afectan hasta 16.4.0 incluida.
- **Contexto**: el juego no usa `next/image`, `use cache`, Server Actions ni
  rutas de imagen de metadatos, y no hay ninguna imagen ni `remotePatterns`
  configurados; los tres avisos que siguen abiertos no tienen un camino de
  explotación evidente en este código. Se mantiene en alta porque el endpoint
  de optimización de imágenes existe por defecto en cualquier despliegue de
  Next.
- **Arreglo aplicado (parcial)**: `next` y `eslint-config-next` pasan de
  16.3.6 a 16.3.8 (parche): cierra 7 de los 10 avisos.
- **Arreglo propuesto (pendiente)**: subir a `next@16.4.3` (versión menor). No
  se aplica aquí porque un cambio de versión menor de Next no es de riesgo
  bajo y claro en este repo (ver `AGENTS.md`): merece su propio PR con la
  suite e2e completa.

### S-02 · Dependencias transitivas con avisos (sharp, source-map-js, undici)

- **Categoría**: A06:2021 Componentes vulnerables y obsoletos
- **Severidad**: media
- **Fichero**: `package-lock.json` (`node_modules/sharp`,
  `node_modules/source-map-js`, `node_modules/undici`)
- **Evidencia**: `sharp@0.35.4` (GHSA-wq5f-xc86-pv6w, librsvg; llega con
  `next`), `source-map-js@1.2.1` (GHSA-68fv-2mgg-jv7q, DoS; llega con
  `postcss`/`jsdom`) y `undici@8.11.2` (8 avisos, entre ellos
  GHSA-2m5v-pch6-74hx; solo desarrollo, vía `jsdom`).
- **Arreglo aplicado**: `npm audit fix` sin `--force`, dentro de los rangos ya
  declarados: `sharp@0.35.5`, `source-map-js@1.2.2`, `undici@8.12.3`. Solo
  cambia el lockfile.

### S-03 · Sin Content-Security-Policy ni protección frente a incrustación

- **Categoría**: A05:2021 Configuración de seguridad incorrecta
- **Severidad**: media
- **Fichero**: `next.config.ts:23` (`headers()`)
- **Evidencia**: las respuestas de `/` no traen `Content-Security-Policy` ni
  `X-Frame-Options`/`frame-ancestors`. Hoy no hay ningún punto de inyección
  de HTML conocido, así que la CSP es defensa en profundidad; sin
  `frame-ancestors`, cualquier sitio puede incrustar el juego en un iframe
  (el impacto de clickjacking es bajo: no hay acciones con valor fuera del
  propio navegador).
- **Arreglo propuesto**: una CSP en modo `Content-Security-Policy-Report-Only`
  primero (`default-src 'self'; script-src 'self' 'unsafe-inline';
  worker-src 'self' blob:; img-src 'self' data: blob:; style-src 'self'
  'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'`), probada con
  la suite e2e completa (Phaser, el Worker de simulación y el service worker)
  antes de pasarla a obligatoria. No se aplica aquí: una CSP mal ajustada
  rompe el juego en producción sin error visible en build. Si el juego debe
  poder incrustarse en otros sitios es una decisión de producto (ver
  preguntas abiertas del PR).

### S-04 · Referencias internas de infraestructura en un test versionado

- **Categoría**: A05:2021 Configuración de seguridad incorrecta (exposición de
  información en un repo público)
- **Severidad**: media
- **Fichero**: `tests/unit/documentacion/ms-4.test.ts:25`
- **Evidencia**: la línea contiene nombres internos de infraestructura
  partidos por concatenación de cadenas para que la guarda
  `scripts/comprobar-publico.mjs` no los detecte. No se reproducen aquí. La
  concatenación esquiva la guarda, pero no la lectura humana: el repo es
  público y los nombres ya están publicados en el historial.
- **Arreglo propuesto**: que ese test lea los mismos patrones del secret
  `COMPROBAR_PUBLICO_PATRONES` (como la guarda), o eliminarlo porque
  `comprobar-publico.mjs` ya revisa el README en cada CI. Lo ya publicado en
  el historial no se puede borrar sin reescribir la historia, que queda fuera
  de alcance. No se aplica aquí porque toca un criterio de aceptación de otro
  bloque (ms-4) y la forma de arreglarlo es una decisión del responsable del
  repo.

### S-05 · Token de GITHUB_TOKEN sin permisos mínimos declarados en CI

- **Categoría**: A05:2021 Configuración de seguridad incorrecta
- **Severidad**: baja
- **Fichero**: `.github/workflows/ci.yml:13` (`jobs:`; no hay `permissions:`
  global)
- **Evidencia**: solo `decidir-e2e` declara `permissions:`. El resto de jobs
  (que ejecutan `npm ci` y el código del PR) heredan los permisos por defecto
  del repo, que pueden ser de escritura según la configuración de la cuenta.
  Los PR de forks reciben de todos modos un token de solo lectura, lo que
  limita el impacto.
- **Arreglo propuesto**: añadir `permissions: { contents: read }` al nivel del
  workflow en `ci.yml` (los jobs que solo hacen checkout, caché y artefactos
  no necesitan más). No se aplica aquí porque el encargo excluye tocar
  infraestructura y un error en ese bloque deja el CI en rojo para todos los
  PR.

### S-06 · Rutas de pruebas publicadas en producción

- **Categoría**: A05:2021 Configuración de seguridad incorrecta
- **Severidad**: baja
- **Fichero**: `src/app/pruebas/siluetas/page.tsx:7`,
  `src/app/pruebas/terreno/page.tsx:8`
- **Evidencia**: `/pruebas/siluetas` y `/pruebas/terreno` se generan como
  páginas estáticas en el build de producción. Montan escenas de pruebas con
  la superficie de depuración del terreno. No exponen datos de nadie.
- **Arreglo propuesto**: servirlas solo cuando el build no es el de Vercel
  (por ejemplo, `notFound()` si `process.env.VERCEL_ENV === "production"`), o
  aceptarlas como parte del producto. Depende de cómo se quieran usar en el
  traspaso (pregunta abierta).

### S-07 · Ganchos de depuración globales (`window.__debug`) en producción

- **Categoría**: A04:2021 Diseño inseguro
- **Severidad**: baja
- **Fichero**: `src/juego/pwa/ganchosPwa.ts:38`, `src/juego/escenas/Partida.ts:641`
  (y el resto de asignaciones a `window.__debug`)
- **Evidencia**: el build de producción publica en `window.__debug` funciones
  que leen y alteran el estado de la partida (por ejemplo, forzar la
  integridad de una nave o instalar un service worker de prueba). Al ser un
  juego local sin marcador compartido, el único efecto es hacer trampas en la
  propia partida; no cruza a otros usuarios.
- **Arreglo propuesto**: ninguno mientras el juego no tenga partidas en red ni
  clasificaciones compartidas. Si llegan, el estado tendría que validarse
  fuera del cliente y estos ganchos deberían quedar fuera del build de
  producción.

### S-08 · Parámetros de URL de pruebas activos en producción

- **Categoría**: A04:2021 Diseño inseguro (validación de entradas)
- **Severidad**: baja
- **Fichero**: `src/juego/pwa/RegistroPwa.tsx:25` (`?sw=0`),
  `src/juego/Aplicacion.tsx:80` (`?semilla=`)
- **Evidencia**: un enlace con `?sw=0` desinstala el service worker y borra la
  caché sin conexión del origen (no toca la partida guardada). `?semilla=`
  acepta cualquier texto y lo pasa por `Number(...)` sin comprobar que sea
  finito. Un enlace manipulado solo afecta a quien lo abre, y el efecto es
  recuperable recargando sin el parámetro.
- **Arreglo propuesto**: validar `?semilla=` con `Number.isFinite` (como ya
  hace `?tope-medicion=` en `src/juego/rendimiento/recorridoMedicion.ts:38`).
  `?sw=0` es un interruptor de emergencia deliberado y se queda.

### S-09 · zod 4.6.5 fijado por serwist

- **Categoría**: A06:2021 Componentes vulnerables y obsoletos
- **Severidad**: baja
- **Fichero**: `package-lock.json:1954` y `package-lock.json:1982`
  (`@serwist/build` y `@serwist/turbopack` fijan `zod` a `4.6.5` exacto)
- **Evidencia**: GHSA-mrhx-c7xc-m3w5 (agotamiento de memoria con colecciones
  enormes). Solo se ejecuta en build validando la configuración propia de
  serwist, nunca con entrada de usuarios.
- **Arreglo propuesto**: esperar a una versión de serwist que suba zod, o un
  `overrides` de `zod` a `4.6.7`. No se aplica aquí: forzar una versión que el
  paquete fija de forma exacta no es de riesgo bajo y claro.

### S-10 · Correo personal en los metadatos de commits

- **Categoría**: A05:2021 Configuración de seguridad incorrecta (exposición de
  información en un repo público)
- **Severidad**: baja
- **Fichero**: historial de git (autor y committer de 21 commits)
- **Evidencia**: 21 commits llevan como autor una dirección de correo personal
  en lugar de la dirección `noreply` de GitHub que usa el resto. No se
  reproduce aquí.
- **Arreglo propuesto**: activar en GitHub «Keep my email addresses private» y
  «Block command line pushes that expose my email», y configurar git en local
  con la dirección `noreply`. Lo ya publicado no se puede quitar sin reescribir
  la historia.

### S-11 · `CLAUDE.md` dice que el repo no tiene secrets de Actions

- **Categoría**: A05:2021 Configuración de seguridad incorrecta
- **Severidad**: baja
- **Fichero**: `CLAUDE.md:10` frente a `.github/workflows/ci.yml:77`
- **Evidencia**: `CLAUDE.md` afirma que el repo «no tiene ningún secret de
  Actions», pero el CI usa `secrets.COMPROBAR_PUBLICO_PATRONES`. No filtra
  nada, pero una descripción errónea de qué secretos existen lleva a revisar
  mal su exposición (por ejemplo, al añadir un workflow con
  `pull_request_target`).
- **Arreglo propuesto**: corregir la frase para nombrar ese secret y que no
  contiene credenciales. No se aplica aquí porque es una instrucción de
  proyecto que decide su responsable.

## Fuera de alcance o sin hallazgos

- **A02 (fallos criptográficos)**: no hay datos sensibles ni cifrado propio;
  el despliegue en Vercel sirve HTTPS.
- **A08 (integridad de software y datos)**: el service worker solo cachea
  respuestas del propio origen (`src/juego/pwa/filtroPrecache.ts`), sin
  caché en tiempo de ejecución; la partida guardada se valida antes de usarse.
- **A09 (registro y monitorización)**: sin servidor, no hay nada que registrar.
- **`/serwist/sw.js.map`**: el mapa de fuentes del service worker se publica,
  pero el código ya es público en el repo.

## Validación de los arreglos aplicados

- `npm audit` después del cambio: quedan 4 avisos (los tres de `next` ≤ 16.4.0
  descritos en S-01, más `zod` por serwist, S-09); `sharp`, `source-map-js` y
  `undici` desaparecen.
- Cabeceras: nuevo e2e `tests/e2e/cabeceras-seguridad.e2e.ts` (seg-1) que
  comprueba `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy` y la ausencia de `X-Powered-By` en `/`,
  `/serwist/sw.js` y `/manifest.webmanifest` contra el build de producción.
  `Permissions-Policy` no restringe `screen-wake-lock` ni el portapapeles, que
  el juego usa (el test pe-5 sigue en verde).
