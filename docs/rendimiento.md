# Rendimiento: parón antes de la explosión

## Qué se mide

`window.__debug.rendimiento` es una instantánea viva del medidor de frames
(`src/juego/rendimiento/medidorFrames.ts`): `frames`, `framesLargos` (> 50 ms,
con Long Animation Frames donde el navegador lo ofrece), `p95`, `max`, los
últimos 600 deltas de rAF con su instante y las marcas `impacto`, `explosion`
y `salida`.

## Repetir la medición en tu dispositivo

1. Abre el juego con `?rendimiento=1` al final de la dirección. Aparece arriba a
   la izquierda un recuadro con `p95`, `max` y `largos`.
2. Dispara el Pepinazo de Cortesía y el Racimo de Tuppers contra un planeta.
3. Mira `max` justo después de la explosión: es el frame más largo reciente.

## Qué cambió

- El refresco del terreno tras un impacto hacía `textura.update()`, que lee el
  lienzo entero (`getImageData`) y lo sube de nuevo. Ahora pinta un único
  `ImageData` del rectángulo sucio con un `putImageData` y la subida a la GPU
  (`refresh()`) va **una vez por frame**, después de lanzar las explosiones del
  frame (el destello sale antes que el repintado).
- Las cinco detonaciones del Racimo comparten ese refresco.

## Antes / Después

| Caso | Antes (p95 / max / frame más largo impacto→explosión) | Después |
| --- | --- | --- |
| Pepinazo 1180x820 | sin medir (el medidor no existía) | pendiente de CI y del dispositivo |
| Racimo 1180x820 | sin medir | pendiente de CI y del dispositivo |
| Pepinazo 360x640 | sin medir | pendiente de CI y del dispositivo |
| Racimo 360x640 | sin medir | pendiente de CI y del dispositivo |

Lo que sí hay medido es el criterio: `tests/e2e/paron-explosion.e2e.ts` falla
si algún frame entre el impacto y un segundo después de la explosión supera
150 ms, o si `impacto` y `explosion` se separan más de 100 ms. Las cifras de
cada ejecución salen en el log del CI (`[par-1] ...`).

## Respuesta al toque

Objetivo: todo toque (puntero, clic, tecla) pinta su resultado en ≤ 200 ms, también mientras la IA piensa y en la explosión.

- La previsualización, la resolución del disparo y la decisión de la IA se calculan en un Web Worker (`src/juego/motor`). Si no hay Worker, falla o tarda más de 10 s, se calcula en línea con el mismo manejador, de modo que el resultado es idéntico.
- Cada petición lleva `idPeticion` e `idPartida`; la última gana por tipo y las respuestas de otra partida se descartan.
- Mientras la IA decide se muestra «<nombre> está apuntando…».
- `__debug.rendimiento` expone ahora `interacciones` e `inp`, y el HUD de rendimiento una línea «INP».

Antes: el cálculo de la banda y de la IA bloqueaba el hilo principal en cada cambio de ángulo y en cada turno. Después: el hilo principal solo pinta; en la medición con CPU ×4 en CI los fotogramas se mantienen en p95 de 17 a 52 ms.

Limitación conocida: en el runner de CI (WebGL por software y CPU ×4) el retraso de entrada de Playwright llega a 350–550 ms aunque los fotogramas van bien, por lo que `tests/e2e/respuesta.e2e.ts` res-1 puede salir rojo ahí. Se midió con el umbral de 200 ms intacto; no se relajó.
