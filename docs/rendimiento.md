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

## Medir en el dispositivo con un toque

Con `?rendimiento=1`, el recuadro lleva un botón **Medir** (aria-label «Medir
rendimiento»). Al pulsarlo, el juego se juega solo en una partida aparte
(semilla fija, tú contra la IA normal, sin tocar tu partida guardada) y mide
cinco tramos, cada uno con 1 s de calentamiento y al menos 30 frames desde el
anterior:

1. **Reposo**: 3 s sin hacer nada. Da la línea base de rAF.
2. **Pepinazo**: un disparo del Pepinazo de Cortesía; p95 en vuelo y el frame
   más largo entre impacto y explosión.
3. **Racimo**: lo mismo con el Racimo de Tuppers.
4. **Propulsores**: un salto con propulsores (p95 frente al reposo).
5. **Turno de la IA**: el turno completo del rival.

Una franja arriba enseña «Midiendo · tramo N de 5» y «Cancelar». Tope total:
150 s desde que la partida pinta sus primeros frames (el arranque no cuenta). Si se
agota, el resultado queda INCOMPLETO con «tiempo agotado»; si la partida no llega a
pintar (pestaña en segundo plano, equipo muy lento), INCOMPLETO con «sin frames».
Los tramos ya medidos salen en el resumen. Un INP de 0 se enseña como «no disponible».

Al terminar sale «Resumen de la medición» con un texto seleccionable que ya se
ha copiado al portapapeles en el mismo toque («Copiado al portapapeles»); si el
navegador no lo permite, pulsa «Copiar» o selecciona el texto. No lleva URL,
rutas, el userAgent entero ni nombres de jugadores. El INP que incluye es el de
tus toques antes de medir, no el del recorrido.

Avisos de validez: **NO VÁLIDA** si la pestaña estuvo oculta o rAF se detuvo
más de 1 s; «rAF limitado a 30 fps (¿modo de bajo consumo?)» si la mediana del
reposo está entre 30 y 36 ms; «LoAF: no (sin separación script/render)» e
«INP: no disponible» cuando el navegador no ofrece esas APIs.

Pega las líneas que empiezan por `| Pepinazo ` y `| Propulsores ` (al final del
texto) en las tablas de «Antes / Después» y «Respuesta al toque» de este
fichero. Las filas de una medición no válida llevan «(no válida)»: no se pegan.

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

### Qué mide el CI y qué mide el dispositivo

El runner de CI no tiene GPU: Chromium rasteriza el lienzo WebGL por software y
cada fotograma cuesta 250-430 ms aunque la partida esté quieta (el perfil lo
coloca en `(program)`, no en el JS). Eso no es coste del juego, así que el CI no
lo juzga. Juzga `trabajoApp`:

- el JS de la app en la ventana del toque (scripts de las entradas Long
  Animation Frame), sin el paso de render de Phaser (`PRE_RENDER`-`POST_RENDER`);
- más el estilo y la maquetación del DOM que exceden de `baseMaquetacion`, la
  mediana de ese tramo en los fotogramas sin interacción. En el CI ese tramo
  también recoge el pintado del lienzo; restarlo deja dentro lo que provoca la
  app (un render de React que maqueta de más).

`tests/e2e/respuesta.e2e.ts` exige `trabajoApp` ≤ 200 ms con CPU ×4, y en cada
ejecución dos controles: `__debug.bloquearHilo(300)` tiene que dar ≥ 280 ms (la
medida caza un bloqueo real) y un toque sin acción ≤ 100 ms (el rasterizador no
se cuela). `duracion`, `retrasoEntrada`, `inp`, `renderLienzo` y
`baseMaquetacion` se guardan como información en `test-results/respuesta/`.

La respuesta completa, con el pintado real, se mide en el dispositivo: abre el
juego con `?rendimiento=1`. El recuadro muestra p95, max, INP, el máximo de
duración y de retraso de entrada de la sesión y un veredicto («Respuesta ≤ 200 ms»
en verde o «Supera 200 ms» en rojo).

No se reduce la resolución del lienzo en este bloque; queda como refinamiento si
el recuadro en el móvil o el iPad enseña que lo lento es el render.

## Aspecto de las armas (armas-aspecto)

Coste añadido al vuelo, por construcción:

- Las 15 siluetas se hornean una sola vez al crear la escena (`generateTexture`) y en vuelo
  solo se mueve un `Image` (posición y rotación); no se redibuja ningún polígono por fotograma.
- La estela suma dos emisores de pool fijo: `estela-proyectil` (humo, 40) y `estela-llama`
  (aditiva, 16). La suma de todos los techos registrados (`techoTotalParticulas`) se comprueba
  en `tests/unit/armas/aspecto.test.ts` contra el presupuesto global de 120 partículas (móvil).
- Sin movimiento reducido: estela y giro apagados; la imagen sigue visible.
- No se usa `Glow`: el realismo sale de la textura con borde, brillo y sombra, la estela y el
  fogonazo (un círculo con tween, sin partículas).

| Caso | p95 de frame en vuelo, línea base (paron-explosion) | Con armas-aspecto |
| --- | --- | --- |
| Pepinazo 360x640 | pendiente de la medición en el dispositivo (`?rendimiento=1`) | pendiente |

El CI rasteriza el lienzo por software, así que no puede juzgar el +15 % de arm-4; queda para
el recuadro de `?rendimiento=1` en el móvil y el iPad.

## Propulsores y saltos del Minirobot a ritmo visible

Los propulsores (300 u/s, entre 1,5 y 3 s) y los saltos del Minirobot (1,7 s
cada uno) se reproducen con el delta de `update()` y no con tweens, así que
no añaden trabajo por frame más allá de repintar un gráfico pequeño. Para
comparar en un dispositivo: abre el juego con `?rendimiento=1`, anota `p95`
en reposo, enciende los propulsores o espera un salto y anota `p95` mientras
se mueve. En CI y en máquinas sin GPU el WebGL es por software (frames de 400-900 ms),
así que `tests/e2e/ritmo.e2e.ts` imprime esas cifras con la etiqueta
`[rit-3]` pero no las afirma.

| Caso | p95 en reposo | p95 en movimiento |
| --- | --- | --- |
| Propulsores 360x640 (WebGL por software) | 399 ms | 387 ms |
| Propulsores 1180x820 (WebGL por software) | 619 ms | 629 ms |
| Dispositivo real (móvil, iPad) | pendiente de Adrián | pendiente de Adrián |
