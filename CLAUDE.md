@AGENTS.md

# shoot-my-starship

Artillería por turnos (estilo Scorched Earth / Worms) en el Cinturón de la
Deriva: naves varadas disparándose en mundos de chatarra con terreno
destructible. **100% cliente**: Next.js (App Router, TypeScript estricto) +
Phaser 4, sin base de datos, sin Auth, sin ninguna llamada a un servicio
propio. Se despliega en Vercel; el único secreto del repo es el token de
Vercel que usa el propio CI para disparar el despliegue.

## Arquitectura (resumen; el diseño completo vive en el pipeline horizontal)

Phaser se monta por importación dinámica sin SSR (`next/dynamic({ssr:
false})`) porque Phaser toca `window`/`document` en su propia carga de
módulo. El mundo del juego usa un tamaño lógico fijo (`MUNDO_ANCHO` /
`MUNDO_ALTO` en `src/juego/constantes.ts`), independiente del tamaño de
pantalla; el canvas usa `Phaser.Scale.RESIZE` para llenar siempre el
viewport sin bandas negras. Ninguna coordenada de pantalla entra en el
estado del juego: la conversión pantalla → mundo ocurre en un único sitio
por escena.

## Reglas de este repo

- Rama desde `main` (o `dev` si ya existe cuando leas esto). Un PR por
  bloque del diseño horizontal, con el id del bloque en el título. Nunca
  push directo a `main`.
- Comentarios en castellano explicando el *porqué*, nunca el *qué*. Sin
  TODOs huérfanos, sin abstracciones para un solo caso de uso.
- Tipado estricto sin escapatorias: ni `any` explícito ni `@ts-ignore` fuera
  de declaraciones de terceros (`@typescript-eslint/no-explicit-any` y
  `@typescript-eslint/ban-ts-comment` están en `"error"`, no en `"warn"`).
- Los tests e2e (`tests/e2e/`, Playwright) corren contra un build de
  producción local (`npm run build && npm run start`), no contra una URL de
  preview de Vercel: el proyecto de Vercel no existe todavía durante la
  etapa de desarrollo del pipeline (se crea en la etapa de traspaso,
  después de que Gatekeeper apruebe el producto completo).
- Todos los activos (arte, sonido) son procedimentales o vectoriales,
  generados por código o por formas de Phaser — cualquier excepción se
  declara con su licencia en `ACTIVOS.md`. Ningún texto del juego (nombres
  de armas, de rivales, frases) puede coincidir con una entrada de
  `no-copiar.md` (test del bloque `balistica-armas`, criterio `armas-5`).
