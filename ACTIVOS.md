# Activos del producto

Este documento declara el origen de todos los recursos visuales, sonoros y tipográficos que usa el juego, y cómo se ha verificado esa afirmación. Se escribe como condición del traspaso a producción (manifiesto `ec96`), que exige justificar cualquier activo que no se genere por código antes de desplegar.

## Declaración

**El producto no usa ningún activo externo (imagen, audio, fuente o icono). Todo lo que se ve y se oye en el juego se genera por código en tiempo de ejecución:**

- **Gráficos**: renderizado con Phaser sobre formas vectoriales y máscaras de terreno calculadas algorítmicamente (`src/sim/terreno/generador.ts`, `src/sim/terreno/mascara.ts`, `src/juego/terreno/`), no texturas ni sprites cargados desde fichero. El refinamiento de gravedad y modos añadió más geometría procedimental, todavía sin ningún activo binario: fondo estelar (campo de estrellas generado por semilla, `src/juego/fondo/FondoEspacial.ts`), planetas y sus anillos y asteroides (`src/sim/sistema/generador.ts`, `src/sim/terreno/mascara.ts`, `src/juego/paleta.ts`), y las siluetas de naves y de proyectiles (`src/juego/naves/geometriaCasco.ts`, `src/juego/proyectiles/geometriaProyectil.ts`), todas dibujadas con primitivas de Phaser (`Graphics`, `arc`, `lineTo`) a partir de parámetros numéricos, nunca desde un fichero de imagen.
- **Audio**: síntesis pura con la Web Audio API, osciladores generando tonos por evento (`src/juego/audio/motor.ts`) — ningún fichero de sonido (`.mp3`/`.wav`/`.ogg`) se carga ni se empaqueta. El propio fichero lo declara en un comentario: "síntesis puramente procedural (osciladores de Web Audio, nunca un fichero de sonido) -- coherente con la política de 'todo vectorial o generado' del producto".
- **Tipografía**: no hay ninguna fuente embebida ni enlazada; el proyecto no usa `next/font`, `@font-face` ni Google Fonts en ningún punto del código, por lo que el texto (HUD, marcador, bancos de frases de humor-por-turno) se renderiza con la pila de fuentes por defecto del sistema/navegador.

No se ha encontrado ninguna excepción a "todo generado por código": ningún fichero binario de imagen, audio o fuente, ni ninguna referencia a un recurso externo.

## Guardia automático (cie-3)

Desde el bloque `cierre-y-guia`, esta declaración ya no depende solo de una comprobación manual puntual: `scripts/comprobar-activos.mjs` la hace mecánica y la ejecuta el CI en cada PR (`npm run verificar:activos`). Falla si aparece un fichero binario de imagen/audio/fuente bajo `src/` o `public/`, o si el código referencia una URL externa típica de activos (CDN de fuentes, `next/font`, dominios de imágenes). Tiene su propio caso negativo en `tests/unit/cierre/cie-3.test.ts`, para que un guardia que "parece proteger" pero no vigila de verdad no vuelva a pasar desapercibido (ver el mismo problema, ya encontrado una vez, en `terreno-6`/cie-5 y `scripts/comprobar-sin-lectura-canvas.mjs`).

## Qué se comprobó, y cómo

Verificación hecha sobre **commit `fafadecb6acc66a3799c14f892a1fe0f391a8c27`** de `main` (2026-09-25T17:15:58Z), vía la API de contenidos de GitHub, directorio por directorio:

1. **No existe ninguna carpeta de activos estáticos.** Ni la raíz del repo ni `src/` contienen `public/`, `assets/`, `static/`, `images/`, `sounds/` ni `fonts/`.
2. **Se listó el contenido de cada subcarpeta del código fuente** y se confirmó que solo contiene ficheros `.ts`/`.tsx` (código), ninguno binario:
   - `src/app/`, `src/app/pruebas/`, `src/app/pruebas/terreno/`
   - `src/contenido/`
   - `src/debug/`
   - `src/juego/` y sus 11 subcarpetas: `audio/`, `control/`, `depuracion/`, `deriva/`, `escenas/`, `hud/`, `mundos/`, `naves/`, `scenes/`, `terreno/`, `vuelo/`
   - `src/sim/` y sus 6 subcarpetas: `armas/`, `balistica/`, `fisica/`, `ia/`, `partida/`, `terreno/`
   - `scripts/`
   - `tests/e2e/`, `tests/unit/` (y sus 7 subcarpetas: `armas/`, `control/`, `humor/`, `ia/`, `nucleo/`, `partida/`, `terreno/`), `tests/utils/`
   - `.github/workflows/`
3. **Se leyó el contenido completo de `src/juego/audio/motor.ts`** (el único fichero cuyo nombre podía sugerir un recurso cargado) para confirmar que implementa síntesis por osciladores (`AudioContext`, `createOscillator`) y no un cargador de ficheros de audio.
4. **Búsqueda de código en todo el repositorio** (vía `search_code` de la API de GitHub, sin restringir a una rama, sobre el estado indexado del repo) por:
   - Extensiones de binario habituales en un juego (`png`, `jpg`, `svg`, `woff`, `woff2`, `ttf`, `mp3`, `wav`, `ogg`, `webp`, `gif`, `ico`): **0 resultados**.
   - Referencias a fuentes externas (`fonts.googleapis`, `font-face`, `next/font`): **0 resultados**.

## Aviso de caducidad

Esta comprobación es válida para el commit `fafadecb6acc66a3799c14f892a1fe0f391a8c27`. Cualquier commit posterior que añada una imagen, un fichero de audio, una fuente embebida o una dependencia que cargue recursos externos invalida esta declaración y requiere repetir la comprobación.
