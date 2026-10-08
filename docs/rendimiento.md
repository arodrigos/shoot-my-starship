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
