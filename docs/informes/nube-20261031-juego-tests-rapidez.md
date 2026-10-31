# Diagnóstico: cómo acortar la batería de tests

Informe de solo lectura (31-oct-2026) sobre la rama `dev`. No cambia ningún
test, fixture, script ni workflow: todo lo que sigue son mediciones y
propuestas que tiene que decidir el mantenedor.

## Resumen

- Los **~38 min** de cada PR son el camino crítico del workflow `CI`, y ese
  camino es el **shard 1 de `e2e-shard`**: 36 min de Playwright más ~1 min de
  preparación. Los tests unitarios (3 shards de 20-22 min) y la partida
  completa (8-16 min) terminan antes.
- Los 4 shards e2e están **muy desequilibrados** (36 / 25 / 16 / 28,5 min).
  Playwright 1.63 reparte `--shard` en **bloques contiguos con el mismo
  número de tests**, no con la misma duración, y los ficheros más pesados
  caen juntos al principio del alfabeto (`apuntado-dedo`, `camara-gestos`,
  `cie-1`...).
- En unitarios, **dos ficheros suman el 52 %** del tiempo total
  (`arm-6` 30 min y `partida-3` 27 min, medido aquí), y el propio `arm-6` dice
  que «repite EXACTAMENTE el escenario de ia-n7 (partida-3)»: mismas 40
  partidas, misma semilla maestra.
- Preparar los jobs (npm ci, navegador, build) cuesta menos de 1 min por
  job: cachear más no compensa. Lo que se gana está en **repartir mejor** y
  en **no repetir trabajo**.
- Estimación combinada de las propuestas de riesgo bajo y medio: de ~38 min
  a **~18-20 min** por PR. Por debajo de ~17 min manda el job más largo de la
  partida completa (820x1180). Un PR que solo toca documentación podría bajar de ~40
  min a 1-3 min.

## Cómo se ha medido

| Qué | Cómo | Entorno |
|---|---|---|
| Unitarios por fichero | Cada fichero de `tests/unit/*.test.ts` y `tests/unit/*/*.test.ts` (los mismos 262 de `npm run test:unit`) como proceso propio, `node --import tsx --test --test-concurrency=1 <fichero>`, cronometrado de punta a punta, en 3 carriles a la vez | Contenedor Linux con 4 vCPU y 15 GB, Node 22.23, sin `PRUEBA_LARGA` (muestra reducida, como en un PR) |
| Unitarios por test | `duration_ms` de la salida TAP de cada fichero de la pasada anterior | ídem |
| e2e | `npm run build` y después `CI=1 npx playwright test --grep-invert "partida completa en " --retries=0 --reporter=list,json`: 2 workers (el valor por defecto con 4 núcleos), servidor de producción local | ídem, Chromium headless del contenedor |
| Partida completa | **No se ha ejecutado aquí** (3 tests de 8 a 16 min). Se toman los tiempos del CI | GitHub Actions, `ubuntu-latest` |
| Preparación y jobs del CI | Tiempos por paso de la última ejecución de `CI` en un PR (30-oct-2026, en verde), leídos de la API de Actions | GitHub Actions |

Avisos sobre los números:

- Durante la primera hora la pasada e2e compartió CPU con una primera pasada
  unitaria en serie, que se cortó al llegar al límite de tiempo de una tarea
  en segundo plano y se sustituyó por la pasada por fichero. Los tiempos e2e
  absolutos son, por tanto, algo pesimistas. Las proporciones (qué pesa más)
  son las que importan.
- Con esa carga y sin reintentos fallaron **5 de 518** e2e (ver
  «Fallos vistos»). Los 262 ficheros unitarios pasaron.
- Este contenedor y los runners del CI no van a la misma velocidad. Los
  unitarios van ~1,8 veces más rápido en CI (62 min sumando los 3 shards,
  frente a 110 min sumando aquí). El e2e va algo más lento en CI (106 min
  sumando los 4 shards, frente a 87 min de pared aquí con los mismos 2
  workers). Las estimaciones para CI de abajo aplican esos factores.

## 1. Qué tarda más (medido)

### Totales

| Bloque | Medido aquí | En CI (último PR) |
|---|---|---|
| Unitarios, suma de los 262 ficheros | **6 589 s (110 min)** | 62 min sumando 3 shards (20,6 / 19,8 / 22,2 min) |
| Unitarios, pared con 3 carriles | 2 951 s (49 min); el suelo es `arm-6` (1 803 s) | — |
| e2e sin partida completa, suma de los 518 tests | **174 min** | — |
| e2e sin partida completa, pared con 2 workers | **87 min** | 4 shards: 36,1 / 25,4 / 15,8 / 28,5 min |
| Partida completa (3 tests, un job cada uno) | no ejecutada | 360x640: 8,3 min · 1180x820: 12,9 min · 820x1180: 16,1 min |
| `npm run build` | 27 s | 16-22 s por job (se hace en 8 jobs) |

Reparto de los e2e (medido): p10 5,7 s · p50 14,7 s · p90 35,6 s · máximo
268 s. 36 tests duran menos de 5 s, 404 entre 5 y 30 s, 78 más de 30 s y 18
más de 60 s. La mitad del tiempo e2e la ponen 109 tests (el 21 %).

### Fixtures y arranques (setup compartido)

| Fixture / arranque | Coste medido | Veces por PR | Nota |
|---|---|---|---|
| Arranque del juego en cada test e2e (`goto` + «Jugar» + Phaser listo) | ~3,5-4 s (los tests más cortos que arrancan partida duran 3,8-4,2 s en total) | ~500 | No hay arranque compartido entre tests: cada test abre su contexto y su partida. Es como mucho el ~20 % del tiempo e2e; el resto son vuelos y turnos animados de verdad |
| `next start` (webServer de Playwright) | no aislado; queda dentro del paso de tests | 1 por job e2e | Despreciable frente a 15-36 min |
| `npm run build` | 27 s aquí, 16-22 s en CI | 8 (lint + 4 shards + 3 partida completa) | ~2,5 min de runner por PR, **0 min de pared** porque van en paralelo |
| `npm ci` | 7-14 s en CI | 11 jobs | Ya hay caché de npm |
| `playwright install-deps chromium` | 11-18 s en CI | 7 jobs | El navegador ya está en caché |
| Restaurar la caché de Playwright | 3-9 s en CI | 7 jobs | — |
| Arranque de proceso de cada fichero unitario (`tsx`) | ~0,5 s (la mediana por fichero es 0,5 s y 206 ficheros tardan menos de 5 s, 129 s entre todos) | 262 | ~2 min de los 110 |

### Top 30 tests e2e (medido, segundos)

| # | s | fichero | test |
|---|---|---|---|
| 1 | 268 | `tests/e2e/cie-1.e2e.ts` | dos sistemas seguidos, cada uno con su propio rival, jugados de verdad con el oráculo real hast |
| 2 | 215 | `tests/e2e/medicion-dispositivo.e2e.ts` | md-2/3/4/6/7: «Medir» juega solo, los dos disparos impactan y detonan, y entrega el resumen sin |
| 3 | 185 | `tests/e2e/arte-siluetas-5.e2e.ts` | recorrido completo a 360x640 con capturas en apuntado, vuelo e impacto |
| 4 | 164 | `tests/e2e/encuadre-movil-4.e2e.ts` | partida de punta a punta a 360x640 con el encuadre nuevo, jugada hasta que hay un ganador real |
| 5 | 134 | `tests/e2e/multi-setup-partida.e2e.ts` | multi-setup-partida-1/3/5/6/7: configurar 4 humanos a 360x640 y jugar hasta el ganador, sin red |
| 6 | 120 | `tests/e2e/camara-gestos.e2e.ts` | cam-1, cam-3, cam-10: pellizco y arrastre con dos dedos, «Ver todo» y la ayuda |
| 7 | 90 | `tests/e2e/premios-parte.e2e.ts` | pp-1..pp-4: parte con premios por asiento a 820x1180 |
| 8 | 87 | `tests/e2e/evento-vitaminas.e2e.ts` | vitaminas: el efecto dura exactamente 3 turnos de la nave 0 y después desaparece |
| 9 | 87 | `tests/e2e/apuntado-dedo.e2e.ts` | a360-1 (límites): en sentido horario baja y cruza 0→359, y con 72 pasos de 5° el final coincide |
| 10 | 79 | `tests/e2e/esp-2.e2e.ts` | un disparo repetido atraviesa el cráter del primero, y máscara y textura siguen coincidiendo |
| 11 | 77 | `tests/e2e/ia-punteria-6.e2e.ts` | ia-punteria-6: La Contable consigue al menos un impacto directo y la partida llega a su fin |
| 12 | 77 | `tests/e2e/premios-parte.e2e.ts` | pp-1..pp-4: parte con premios por asiento a 1180x820 |
| 13 | 73 | `tests/e2e/esp-3.e2e.ts` | el contador de horneado del fondo vale 1 al empezar y sigue en 1 tras 60s y 10 disparos |
| 14 | 71 | `tests/e2e/eventos-anunciados.e2e.ts` | anu-1: a 820x1180 cada uno de los 11 eventos se anuncia con título, afectado y efecto |
| 15 | 67 | `tests/e2e/eventos-anunciados.e2e.ts` | anu-1: a 1180x820 cada uno de los 11 eventos se anuncia con título, afectado y efecto |
| 16 | 66 | `tests/e2e/respuesta.e2e.ts` | res-1: 1180x820 con CPU ×4, todo toque cuesta ≤ 200 ms de trabajo de la app, también con la IA  |
| 17 | 61 | `tests/e2e/consola-compacta.e2e.ts` | con-1: 1180x820, abajo al 40 %, se oculta, se mueve y se vuelve a mostrar para disparar |
| 18 | 60 | `tests/e2e/eventos-anunciados.e2e.ts` | anu-1: a 360x640 cada uno de los 11 eventos se anuncia con título, afectado y efecto |
| 19 | 59 | `tests/e2e/apuntado-dedo.e2e.ts` | a360-1: una vuelta del dedo alrededor de la nave da una vuelta a la flecha, cruzando 0°/360° (8 |
| 20 | 57 | `tests/e2e/multi-setup-partida.e2e.ts` | multi-setup-partida-6: 2 humanos y 2 rivales de IA se juegan hasta el final |
| 21 | 57 | `tests/e2e/apuntado-dedo.e2e.ts` | a360-1: una vuelta del dedo alrededor de la nave da una vuelta a la flecha, cruzando 0°/360° (1 |
| 22 | 56 | `tests/e2e/medicion-dispositivo.e2e.ts` | md-2/3/4/6/7: «Medir» juega solo, los dos disparos impactan y detonan, y entrega el resumen sin |
| 23 | 56 | `tests/e2e/movimiento-naves.e2e.ts` | propulsores bloqueados contra la superficie (820x1180) |
| 24 | 54 | `tests/e2e/compra-al-usar.e2e.ts` | compra-al-usar: todo está en el selector, el arma de pago se cobra al disparar y las gratis no  |
| 25 | 51 | `tests/e2e/relevo-turno.e2e.ts` | relevo-turno-4: sin relevo con un solo humano, ni 1vIA ni 1 humano más 3 IA |
| 26 | 50 | `tests/e2e/eventos-visibles.e2e.ts` | evv-2: vitaminas se ven en los turnos siguientes y desaparecen al expirar |
| 27 | 49 | `tests/e2e/premios-parte.e2e.ts` | pp-1..pp-4: parte con premios por asiento a 360x640 |
| 28 | 49 | `tests/e2e/imp-11.e2e.ts` | imp-11: un disparo bien apuntado reduce la integridad del rival según el catálogo, y uno fuera  |
| 29 | 48 | `tests/e2e/apuntado-dedo.e2e.ts` | a360-2: el disparo sale con el ángulo y la fuerza que muestra la flecha tras el gesto |
| 30 | 48 | `tests/e2e/apuntado-dedo.e2e.ts` | a360-3: el giro responde en menos de 200 ms durante una vuelta completa |

### Top 30 ficheros e2e (medido, suma de sus tests en segundos)

| # | s | tests | fichero |
|---|---|---|---|
| 1 | 458 | 11 | `tests/e2e/apuntado-dedo.e2e.ts` |
| 2 | 360 | 14 | `tests/e2e/eventos-visibles.e2e.ts` |
| 3 | 328 | 8 | `tests/e2e/medicion-dispositivo.e2e.ts` |
| 4 | 268 | 1 | `tests/e2e/cie-1.e2e.ts` |
| 5 | 260 | 18 | `tests/e2e/efectos-visibles.e2e.ts` |
| 6 | 255 | 6 | `tests/e2e/eventos-anunciados.e2e.ts` |
| 7 | 249 | 6 | `tests/e2e/camara-gestos.e2e.ts` |
| 8 | 239 | 14 | `tests/e2e/zonas-camara.e2e.ts` |
| 9 | 236 | 7 | `tests/e2e/ritmo.e2e.ts` |
| 10 | 233 | 12 | `tests/e2e/consola-compacta.e2e.ts` |
| 11 | 217 | 3 | `tests/e2e/premios-parte.e2e.ts` |
| 12 | 192 | 2 | `tests/e2e/multi-setup-partida.e2e.ts` |
| 13 | 187 | 13 | `tests/e2e/avisos-naves.e2e.ts` |
| 14 | 185 | 9 | `tests/e2e/menu-ajustes.e2e.ts` |
| 15 | 185 | 1 | `tests/e2e/arte-siluetas-5.e2e.ts` |
| 16 | 173 | 6 | `tests/e2e/avisos-visibles.e2e.ts` |
| 17 | 170 | 15 | `tests/e2e/inicio.e2e.ts` |
| 18 | 164 | 1 | `tests/e2e/encuadre-movil-4.e2e.ts` |
| 19 | 156 | 6 | `tests/e2e/consola-ocultar.e2e.ts` |
| 20 | 154 | 6 | `tests/e2e/remate-impacto.e2e.ts` |
| 21 | 146 | 8 | `tests/e2e/layout-dos-zonas.e2e.ts` |
| 22 | 143 | 8 | `tests/e2e/barra-angulo-tactil.e2e.ts` |
| 23 | 138 | 4 | `tests/e2e/respuesta.e2e.ts` |
| 24 | 133 | 4 | `tests/e2e/evento-vitaminas.e2e.ts` |
| 25 | 133 | 18 | `tests/e2e/texto-grande.e2e.ts` |
| 26 | 128 | 3 | `tests/e2e/movimiento-naves.e2e.ts` |
| 27 | 126 | 4 | `tests/e2e/respuesta-disparo.e2e.ts` |
| 28 | 124 | 8 | `tests/e2e/marca-asiento.e2e.ts` |
| 29 | 108 | 7 | `tests/e2e/hud-canales.e2e.ts` |
| 30 | 100 | 10 | `tests/e2e/resumenes.e2e.ts` |

### Top 30 tests unitarios (medido, segundos)

| # | s | fichero | test |
|---|---|---|---|
| 1 | 1790 | `tests/unit/armas/arm-6.test.ts` | arm-6: las 40 partidas de ia-n7 con el catálogo de 13 armas siguen dentro del presupuesto de c |
| 2 | 1607 | `tests/unit/partida/partida-3.test.ts` | ia-n7 / partida-3: en 40 partidas simuladas en modo espacial real, casi todas terminan con gana |
| 3 | 318 | `tests/unit/ia/ia-nivel-3-chispa.test.ts` | niv-3: Chispa, fácil < normal < difícil con ≥ 8 puntos entre niveles |
| 4 | 226 | `tests/unit/ia/ia-3.test.ts` | ia-3: las tres bandas de dificultad se cumplen y están ordenadas en ≥ 4 de 5 semillas maestr |
| 5 | 205 | `tests/unit/ia/ia-nivel-3-bisagra.test.ts` | niv-3: Almirante Bisagra, fácil < normal < difícil con ≥ 8 puntos entre niveles |
| 6 | 153 | `tests/unit/respuesta-disparo-fases.test.ts` | rsp-2: avanzar() y las dos fases dan el golden de 200 semillas |
| 7 | 149 | `tests/unit/ia/ia-nivel-3-contable.test.ts` | niv-3: La Contable, fácil < normal < difícil con ≥ 8 puntos entre niveles |
| 8 | 140 | `tests/unit/ia/ia-autodanio-3.test.ts` | ia-autodanio-3: la tasa de autoimpacto de cada personalidad queda en 5% o por debajo en ≥ 4 d |
| 9 | 132 | `tests/unit/impacto/imp-9.test.ts` | imp-9: colocarNaves siempre termina, en alguno de los tres escalones, en 500 semillas |
| 10 | 128 | `tests/unit/naves/nav-2.test.ts` | nav-2: 500 semillas, colocación siempre válida (holgura de sólido, separación y margen de m |
| 11 | 122 | `tests/unit/ia/ia-n4.test.ts` | ia-n4b: la dispersión media en 200 disparos, en modo multipozo, refleja los rangos de error re |
| 12 | 86 | `tests/unit/economia/economia-rectificada.test.ts` | economia-rectificada-2/3 (propiedad): el saldo nunca es negativo, cada arma de pago resta exact |
| 13 | 75 | `tests/unit/respuesta-disparo-fases.test.ts` | rsp-2: ninguna de las dos fases muta lo que recibe |
| 14 | 73 | `tests/unit/multijugador/multi-setup-partida.test.ts` | multi-setup-partida: colocarNaves de 2 a 4 naves |
| 15 | 66 | `tests/unit/nucleo/nucleo-5.test.ts` | nucleo-5: 500 partidas simuladas terminan todas con un ganador, sin bucles infinitos ni estados |
| 16 | 58 | `tests/unit/arma-mosca/mos-2.test.ts` | mos-2: no se pierde por presupuesto de pasos en más del 2% de un lote determinista de sistemas |
| 17 | 56 | `tests/unit/ia/ia-n2.test.ts` | ia-n2: la trayectoria y el resultado que usó la búsqueda coinciden, sin tolerancia, con los d |
| 18 | 56 | `tests/unit/ia/ia-punteria.test.ts` | ia-punteria-1: la potencia refinada no coincide con la rejilla en al menos el 80% de los turnos |
| 19 | 52 | `tests/unit/muerte-subita-termina.test.ts` | ms-1: toda partida termina antes de la ronda RONDA_MUERTE_SUBITA + 9 y no hay curas en muerte s |
| 20 | 37 | `tests/unit/naves/fantasma-no-colisiona.test.ts` | fan-2: un tiro que cruza a una nave muerta no la golpea y llega a su destino |
| 21 | 34 | `tests/unit/ia/potencia-dispersion-5.test.ts` | potencia-dispersion-5: en sistemas reales el reordenamiento por valor esperado se aplica y resp |
| 22 | 31 | `tests/unit/ia/ia-n6.test.ts` | ia-n6: en modo multipozo, tras fallar por encima del umbral el siguiente disparo cae más cerca |
| 23 | 28 | `tests/unit/impacto/imp-10.test.ts` | imp-10: crear una partida tiene p95 < 1500ms en 100 semillas y ninguna semilla supera 6.000 vue |
| 24 | 27 | `tests/unit/naves/nav-3.test.ts` | nav-3: 100 semillas tienen siempre un tiro real y viable entre las naves colocadas |
| 25 | 23 | `tests/unit/respuesta-disparo-fases.test.ts` | rsp-2: la caché de viabilidad no cambia el resultado del cierre |
| 26 | 22 | `tests/unit/ia/ia-n4.test.ts` | ia-n4a: el error inyectado sigue siendo exactamente la diferencia entre la solución hallada y  |
| 27 | 22 | `tests/unit/desplazamiento-repetir.test.ts` | des-1: repetir el mismo disparo tras un impacto no vuelve a acertar (pepinazo) |
| 28 | 22 | `tests/unit/economia/economia-loadout.test.ts` | economia-loadout-6: la facilidad estática de la pantalla de selección coincide con la medición |
| 29 | 20 | `tests/unit/minirobot.test.ts` | invariantes del robot: distancia decreciente, ≤ 4 saltos, detona a lo sumo en el 5.º turno y |
| 30 | 20 | `tests/unit/vuelo-extensible/vex-5.test.ts` | vex-5: 200 partidas dan exactamente el mismo resultado que antes de vuelo-extensible |

### Top 30 ficheros unitarios (medido, pared del proceso en segundos)


| # | s | fichero |
|---|---|---|
| 1 | 1803 | `tests/unit/armas/arm-6.test.ts` |
| 2 | 1607 | `tests/unit/partida/partida-3.test.ts` |
| 3 | 319 | `tests/unit/ia/ia-nivel-3-chispa.test.ts` |
| 4 | 289 | `tests/unit/respuesta-disparo-fases.test.ts` |
| 5 | 226 | `tests/unit/ia/ia-3.test.ts` |
| 6 | 205 | `tests/unit/ia/ia-nivel-3-bisagra.test.ts` |
| 7 | 149 | `tests/unit/ia/ia-nivel-3-contable.test.ts` |
| 8 | 145 | `tests/unit/ia/ia-n4.test.ts` |
| 9 | 141 | `tests/unit/ia/ia-autodanio-3.test.ts` |
| 10 | 132 | `tests/unit/impacto/imp-9.test.ts` |
| 11 | 128 | `tests/unit/naves/nav-2.test.ts` |
| 12 | 87 | `tests/unit/economia/economia-rectificada.test.ts` |
| 13 | 74 | `tests/unit/multijugador/multi-setup-partida.test.ts` |
| 14 | 68 | `tests/unit/ia/ia-punteria.test.ts` |
| 15 | 67 | `tests/unit/nucleo/nucleo-5.test.ts` |
| 16 | 62 | `tests/unit/gravedad/gravedad-calibracion.test.ts` |
| 17 | 61 | `tests/unit/arma-mosca/mos-2.test.ts` |
| 18 | 57 | `tests/unit/ia/ia-n2.test.ts` |
| 19 | 53 | `tests/unit/muerte-subita-termina.test.ts` |
| 20 | 50 | `tests/unit/universo-eventos.test.ts` |
| 21 | 42 | `tests/unit/minirobot.test.ts` |
| 22 | 38 | `tests/unit/naves/fantasma-no-colisiona.test.ts` |
| 23 | 35 | `tests/unit/ia/potencia-dispersion-5.test.ts` |
| 24 | 31 | `tests/unit/ia/ia-n6.test.ts` |
| 25 | 31 | `tests/unit/armas/armas-metrica.test.ts` |
| 26 | 28 | `tests/unit/economia/economia-loadout.test.ts` |
| 27 | 28 | `tests/unit/impacto/imp-10.test.ts` |
| 28 | 28 | `tests/unit/naves/nav-3.test.ts` |
| 29 | 27 | `tests/unit/balistica/potencia.test.ts` |
| 30 | 25 | `tests/unit/motor/trabajador-equivalencia.test.ts` |

### Por qué el CI tarda lo que tarda

| Job (último PR) | Pared | Qué lo limita |
|---|---|---|
| `e2e-shard (1)` | **37,1 min** | Le caen los ficheros más pesados del principio del alfabeto |
| `e2e-shard (4)` | 29,5 min | — |
| `e2e-shard (2)` | 26,2 min | — |
| `test-unit-shard (3)` | 22,5 min | Uno de los dos ficheros de 40 partidas (`arm-6` o `partida-3`) |
| `test-unit-shard (1)` | 20,9 min | ídem |
| `test-unit-shard (2)` | 20,0 min | — |
| `e2e-partida-completa (820x1180)` | 17,3 min | Un solo test |
| `e2e-shard (3)` | 16,7 min | — |
| `e2e-partida-completa (1180x820)` | 14,0 min | Un solo test |
| `e2e-partida-completa (360x640)` | 9,3 min | Un solo test |
| `lint-typecheck-build` | 1,2 min | — |

Los 106 min de shards e2e, repartidos por igual entre 4, dan 26,5 min: con
un reparto perfecto, el mismo hardware ya bajaría el camino crítico ~10 min.

## 2. Duplicados y solapes

| Solape | Evidencia | Coste medido |
|---|---|---|
| **`arm-6` y `partida-3` juegan las mismas 40 partidas** | `arm-6.test.ts` lo dice: «repite EXACTAMENTE el escenario de ia-n7 (tests/unit/partida/partida-3.test.ts)». Misma `SEMILLA_MAESTRA = 90210`, mismo `muestra(200)`, mismo mundo, mismas parejas. Solo cambia cómo se lleva `ultimoIntento` (`partida-3` lo hace a mano; `arm-6` llama a `siguienteUltimoIntentoIA`) y que `arm-6` además cuenta vuelos simulados | 1 607 s + 1 803 s; uno de los dos sobra si las partidas salen idénticas |
| `imp-9` y `nav-2`: `colocarNaves` sobre las mismas 500 semillas | `imp-9` cuenta en qué escalón termina cada semilla; `nav-2` valida la colocación. Las dos llaman a `colocarNaves` 500 veces con las mismas semillas (y `nav-3` usa 100 de ellas) | 132 s + 128 s |
| Batería de «200 partidas dan el mismo resultado» | `vex-5` (20 s), `esc-4` (20 s), `rsp-2` golden de 200 semillas (153 s + 75 s + 24 s), `res-2` trabajador (19 s), `nucleo-5` (500 partidas, 67 s). Cada uno guarda una cosa distinta, pero todos rejuegan cientos de partidas deterministas | ~380 s; solape probable, no verificado test a test |
| Vitaminas en dos e2e | `evento-vitaminas.e2e.ts` («dura exactamente 3 turnos… y después desaparece», 87 s) y `eventos-visibles.e2e.ts` evv-2 («vitaminas se ven en los turnos siguientes y desaparecen al expirar», 50 s) | 137 s |
| Partidas e2e jugadas hasta el ganador, además de la partida completa | `cie-1` (268 s), `medicion-dispositivo` md-2 (215 s + 56 s), `arte-siluetas-5` (185 s), `encuadre-movil-4` (164 s), `multi-setup-partida` (134 s + 57 s), `ia-punteria-6` (77 s). Los tres jobs de partida completa ya juegan partidas enteras en los mismos tres tamaños, y en unitarios `nucleo-5` comprueba que 500 partidas terminan | **1 156 s (19 min, el 11 % del e2e)** |
| peg-1 en dos capas | `tests/unit/pegajosa-borde.test.ts` prueba en lógica que el gancho que sale por cada borde se pierde. `tests/e2e/pegajosa-borde.e2e.ts` lo repite en navegador (4 bordes + 2 tamaños de tableta), con 6,5 s de espera fija en cada test | 96 s de e2e |
| tra-1 en dos capas | La geometría L/8-L/4 y ±9°/±45° se prueba en unitarios para 360x640 y 1180x820, y otra vez en e2e en tres tamaños | 78 s de e2e (fichero entero) |
| Guiones de guarda dentro de los unitarios | `nav-4`, `sis-5`, `esp-7`, `cie-3`, `cie-5` y otros lanzan `scripts/comprobar-*.mjs`, que el job `lint-typecheck-build` ya ejecuta. Aquí no es puro duplicado: los unitarios prueban además que el guion **detecta** una fuga | Pocos segundos; no merece la pena tocarlo por tiempo |

Los solapes entre capas que **sí** valen su coste (la integración que
importa): `vibracion` (los patrones van en unitarios y el e2e comprueba que
la llamada sale en el manejador del clic) y `trayectoria-pantalla` tra-2/tra-4
(la latencia de 200 ms solo se puede medir en navegador).

## 3. Paralelizar, cachear, esperas fijas y estado compartido

### Paralelismo disponible (todo con lo que ya trae el runner, sin coste)

- **Shards de Playwright por duración, no por número.** Simulado con las
  duraciones medidas y 2 workers por shard (minutos de pared por shard):

  | Reparto | 4 shards | 6 shards | 8 shards |
  |---|---|---|---|
  | Contiguo por número (lo de ahora) | 25,0 / 27,7 / 19,4 / 16,2 → **máx 27,7** | máx 19,1 | máx 14,6 |
  | Por duración (greedy, lo más largo primero) | **máx 21,8** | **máx 14,5** | **máx 10,9** |

  Llevado a CI (factor ~1,22): 4 shards equilibrados ≈ 26,5 min; 6 ≈ 18 min;
  8 ≈ 13 min, más ~1 min de preparación. Playwright 1.63 no trae reparto por
  duración documentado. Hay una variable interna, `PWTEST_SHARD_WEIGHTS`, que
  solo cambia **cuántos** tests caen en cada bloque contiguo, y no está
  documentada. La vía sin dependencias es que cada job de la matriz reciba su
  lista de ficheros, calculada a partir de los `resultado-e2e.json` que el
  CI ya sube como artefacto (o de un fichero de tiempos versionado).
- **Más workers por shard: no.** El propio `ci.yml` lo descarta («los tests
  de canvas compiten por CPU»), y aquí, con carga extra, aparecieron 5
  fallos de tiempos y encuadre. Se escala en shards, no en workers.
- **Unitarios con `--test-concurrency` > 1.** Con 3 carriles en 4 vCPU, la
  pasada bajó de 6 589 s sumados a **2 951 s de pared** (×2,2), y el suelo es
  `arm-6`. Los runners de `ubuntu-latest` en repos públicos tienen 4 vCPU,
  así que cada shard podría correr 3-4 ficheros a la vez. Requisito previo:
  arreglar el estado compartido de abajo.
- **El reparto unitario actual (`--test-shard`) va por posición de fichero**,
  no por duración, y no puede partir un fichero. Mientras `arm-6` y
  `partida-3` duren ~15-17 min en CI cada uno, ningún shard baja de ahí.

### Estado compartido que rompería en paralelo

| Test | Qué comparte | Con quién choca |
|---|---|---|
| `tests/unit/naves/nav-4.test.ts` | Escribe `src/sim/naves/__fuga-temporal-nav-4.ts` **dentro del repo** y lanza `comprobar-gravedad-solo-vuelo.mjs` | Cualquier otro test que lance ese guion mientras existe el fichero (el otro caso de `nav-4`) y el job de lint si compartiera árbol |
| `tests/unit/sistema/sis-5.test.ts` | Escribe `src/sim/sistema/__fuga-temporal-sis-5.ts` dentro del repo | Los otros tests que lanzan `comprobar-sin-math-random.mjs` (3 llamadas en `tests/unit`) verían la fuga y fallarían |
| `tests/unit/nucleo/guarda-azar-y-reloj.test.ts` | **Ya** lo hace bien: copia lo que necesita a un `mkdtemp` | Es el patrón a imitar |
| e2e que guardan capturas (`page.screenshot({ path: "capturas/..." })`, 36 ficheros) | Escriben en `capturas/`, que está versionado. Tras una pasada local quedan 156 ficheros modificados o nuevos en el árbol | Cada test usa nombres propios, así que en paralelo no se pisan. El coste es de higiene, no de tiempo: ensucia el árbol de quien ejecuta la batería en local |
| e2e en general | Cada test tiene su contexto y su `storageState`; el servidor es de solo lectura | Nada que rompa más allá de la competencia por CPU ya conocida |

En la pasada con 3 carriles no llegó a cruzarse ninguna de las dos fugas,
pero es cuestión de orden y de suerte.

### Caché (medido en CI: poco que ganar)

- Dependencias: `npm ci` con caché de npm tarda 7-14 s, y cachear
  `node_modules` ahorraría unos 5-10 s por job.
- Navegador: ya está en caché. Quedan `install-deps` (11-18 s), que no se
  puede cachear por la vía de `~/.cache`.
- Build: 16-22 s por job. Compilar una sola vez y pasar `.next` como
  artefacto a los 7 jobs e2e ahorraría ~2 min de runner por PR y **0 de
  pared**, porque subir y bajar el artefacto cuesta del mismo orden.
  Además, el build separado del `start` existe por un fallo intermitente de
  `@next/env` documentado en `ci.yml`. No compensa.
- Datos de prueba: las colocaciones de `colocarNaves` (imp-9, nav-2, nav-3)
  y las partidas de 40 turnos son deterministas. Calcularlas una vez por
  proceso es la «caché» que sí ahorra (ver propuestas U1 y U3).

### Esperas fijas, red y servicios reales

- **Red y servicios reales: ninguno.** Todo va contra el servidor local;
  `pwa-sin-conexion` usa `context.setOffline` y `cabeceras-seguridad` pide
  rutas locales. No hay nada que mockear.
- **51 `waitForTimeout` en 34 ficheros e2e.** Sumando bucles por tamaño,
  rondan los **~3 min de los 174** (estimado, ~2 %). Los grandes:

  | Fichero | Espera | Para qué | ¿Sustituible? |
  |---|---|---|---|
  | `esp-3.e2e.ts:20` | 60 s | «ni 60 s de reloj real» redibujan el fondo | Es el criterio mismo. Con `page.clock` se perdería justo lo que vigila. Candidato a pase nocturno, no a mock |
  | `reloj-turno.e2e.ts:80,104` | 2 s + 10 s | Pestaña oculta 10 s y el reloj no avanza | `page.clock` podría avanzar el tiempo, si el reloj del turno usa `performance.now`/`Date`. Riesgo medio |
  | `pegajosa-borde.e2e.ts:67-96` | 6,5 s × 6 tests | Pasa la mecha de 5 s y no explota | Esperar a un evento de «proyectil perdido» en `__debug` en vez de reloj fijo |
  | `avisos-naves.e2e.ts:198` | 7 s × 3 tamaños | El bocadillo sigue tras `MS_MINIMOS_RESUMEN` | ídem, o con `page.clock` |
  | `pwa-sin-conexion.e2e.ts:143,160` | 5 s + 2 s | — | Esperar al estado del service worker |
  | `fantasma`, `musica-tension`, `pantalla-encendida`, `banda-sonora` | 3 s, 3 s, 3 s, 2+1 s | — | Esperas a condición (`waitForFunction`) |

## 4. Qué no hace falta correr en cada PR

El repo ya tiene la pieza para esto: `pruebas-largas.yml` (unitarios con
`PRUEBA_LARGA=1` cada noche) y `tests/utils/muestra.ts` (muestra reducida en
los PR, siempre un prefijo de la completa). Lo que falta:

| Qué | Criterio propuesto | Gana (estimado, CI) |
|---|---|---|
| Todo el e2e y la partida completa en PRs que **solo** tocan `docs/**`, `capturas/**` o `*.md` | Ampliar `decidir-e2e`, que ya decide si correr, con: «todos los ficheros cambiados casan con esas rutas». Mejor eso que `paths-ignore`, que deja los checks obligatorios esperando para siempre. Los unitarios **sí** hay que correrlos: ~17 ficheros leen `README.md`, `ACTIVOS.md`, `no-copiar.md` o `docs/*.md` (`readme-rutas`, `ms-4`, `cie-4`, `armas-5`, `arm-7`, `hum-7`, `calibrado`, `saldo-fijo`…) | Medido en CI: el PR «docs(readme)» del 30-oct tardó ~40 min. Con el criterio, los unitarios (o solo esos ~17 ficheros, unos segundos) más `comprobar-publico`: **~1-3 min** |
| Tests estadísticos sin `muestra()` | Aplicarles la convención que ya existe: `niv-3` ×3 (319 + 205 + 150 s), `ia-3` (227 s), `ia-autodanio-3` (141 s), `imp-9` (132 s), `nav-2` (128 s), `rsp-2` golden (153 s). Muestra completa en el pase nocturno | ~1 460 s aquí → ~290 s con ÷5, **unos −11 min de CPU en CI**, repartidos entre los shards |
| e2e de partida entera (tabla de solapes: 19 min) y `esp-3` (73 s) | Correrlos solo si el PR toca `src/juego/**`, `src/app/**` o `src/sim/partida/**`, y siempre en un pase nocturno nuevo de e2e (hoy el nocturno es solo de unitarios) | −20 min de suma e2e ≈ −3 a −5 min de pared con 4-6 shards |
| Partida completa (3 jobs, 8-16 min) | ídem. Hoy es el suelo del CI cuando el resto baja | Llevaría el suelo de ~17 min al siguiente job más largo. **Decisión de producto** (ver preguntas) |

## 5. Propuestas priorizadas

Ordenadas **de menor a mayor riesgo**; en cada una, la ganancia y si está
medida o estimada. «Estimado» quiere decir calculado a partir de tiempos
medidos, sin haber ejecutado el cambio.

| # | Propuesta | Ganancia | Medido / estimado | Riesgo | Ficheros afectados |
|---|---|---|---|---|---|
| **E1** | Repartir los e2e **por duración**: cada job de la matriz recibe su lista de ficheros, calculada con un script pequeño (sin dependencias) a partir de los `resultado-e2e.json` de una ejecución anterior. Se conserva el job `e2e`, que comprueba que los shards suman la suite entera | Camino crítico de ~37 a **~27,5 min** con 4 shards | Estimado (simulación con duraciones medidas) | Bajo: no cambia ningún test. Si la lista de tiempos queda vieja solo se desequilibra; el recuento del job `e2e` atrapa cualquier test olvidado | `.github/workflows/ci.yml`, un script nuevo en `scripts/`, opcionalmente un fichero de tiempos |
| **E2** | Con E1, subir de 4 a **6 shards** e2e (los minutos de Actions son gratis en repo público) | De ~27,5 a **~19 min** (8 shards: ~14 min, pero entonces manda la partida completa, 17 min) | Estimado | Bajo. Más jobs simultáneos: comprobar el límite de jobs concurrentes de la cuenta (hoy se lanzan 14 a la vez) | `.github/workflows/ci.yml` |
| **D1** | PR que solo toca documentación o capturas → sin e2e ni partida completa (ampliando `decidir-e2e`). Los unitarios se mantienen | Esos PR, de ~40 a **~1-3 min** (o ~22 si se dejan los unitarios enteros) | Medido el «antes» (~40 min en un PR de solo README); el «después», estimado | Bajo si la lista de rutas es estricta. Riesgo: un `.md` que lea un e2e (hoy ninguno) | `.github/workflows/ci.yml` |
| **U1** | Unificar `arm-6` y `partida-3`: un único harness juega las 40 partidas una vez y las dos afirmaciones (turnos y proyectiles perdidos; presupuesto de vuelos) miran el mismo resultado. Antes, comprobar que las dos maneras de llevar `ultimoIntento` dan partidas idénticas | −1 607 s aquí; **unos −15 min de CPU en CI**, y el shard que llevaba `partida-3` baja a ~6-7 min | Medido el coste del fichero; ganancia estimada | Bajo-medio. `partida-3` es criterio de camino crítico de ia-n7, y la desviación de `arm-6` («este harness fue el que se olvidó de llevar turnosSeguidosDanioInsuficiente») muestra que ya divergieron una vez. Mantener un único harness evita justo eso | `tests/unit/partida/partida-3.test.ts`, `tests/unit/armas/arm-6.test.ts`, un util compartido en `tests/utils/` |
| **U2** | Partir las 40 partidas que queden (U1) en 3-4 ficheros por rango de semillas, para que `--test-shard` las reparta | Con U1, los ~47 min de CPU unitaria en CI quedan repartibles: el shard más largo, de ~22 a **~16 min** (y a ~6-8 min sumando U4) | Estimado | Bajo: las mismas partidas, en otros ficheros. Cuidado con que las proporciones globales (p. ej. el techo de proyectil perdido) se calculen sobre el total y no por trozo: o umbral por trozo con `minimoProporcional`, o un fichero final que agregue | ídem U1 |
| **U3** | `imp-9` y `nav-2` comparten las colocaciones de las mismas 500 semillas: memoizar en un util o fusionar | ~−130 s aquí | Estimado | Bajo | `tests/unit/impacto/imp-9.test.ts`, `tests/unit/naves/nav-2.test.ts` |
| **E3** | Quitar el e2e duplicado de vitaminas (dejar uno de los dos) y cambiar las esperas fijas de `pegajosa-borde`, `avisos-naves`, `pwa-sin-conexion` y similares por esperas a condición | ~−3 a −4 min de suma e2e, < 1 min de pared con 6 shards | Estimado | Bajo-medio: hay que asegurarse de que la condición nueva sigue probando «pasado el plazo» | `tests/e2e/evento-vitaminas.e2e.ts` o `eventos-visibles.e2e.ts`, `pegajosa-borde.e2e.ts`, `avisos-naves.e2e.ts`, `pwa-sin-conexion.e2e.ts` |
| **U4** | `--test-concurrency=3` en cada shard unitario, **después** de que `nav-4` y `sis-5` escriban su fuga en un `mkdtemp` como `guarda-azar-y-reloj` | ×2,2 en la pasada completa | **Medido** aquí (6 589 s → 2 951 s con 3 carriles), con el suelo en el fichero más largo | Medio: los tests con estado compartido fallarían de forma intermitente si no se arreglan antes. Algún test de tiempo (p. ej. `ia-n3`, «250 ms de CPU») puede acercarse a su umbral con carga | `package.json` (`test:unit`), `ci.yml`, `tests/unit/naves/nav-4.test.ts`, `tests/unit/sistema/sis-5.test.ts`, quizá los guiones `scripts/comprobar-*.mjs` (aceptar una raíz) |
| **U5** | Aplicar `muestra()` a `niv-3` ×3, `ia-3`, `ia-autodanio-3`, `imp-9`, `nav-2` y el golden de `rsp-2`; completa en `pruebas-largas.yml` | ~−1 170 s aquí, ~−11 min de CPU en CI | Estimado | Medio: umbrales estadísticos («≥ 8 puntos entre niveles», «≥ 4 de 5 semillas») con menos muestra pueden volverse ruidosos o dejar de discriminar; un fallo de golden se vería a la mañana siguiente y no en el PR | Los 8 ficheros citados |
| **E4** | Los e2e de partida entera (`cie-1`, `medicion-dispositivo` md-2, `arte-siluetas-5`, `encuadre-movil-4`, `multi-setup-partida`, `ia-punteria-6`) y `esp-3`: solo si el PR toca sus rutas, más un pase nocturno de e2e nuevo | −20 min de suma e2e ≈ −3 a −5 min de pared | Estimado | Medio-alto: se pierde cobertura de punta a punta en PRs que tocan rutas «lejanas» con efecto real. El criterio de rutas tiene que ser generoso | `.github/workflows/ci.yml`, workflow nocturno nuevo o `pruebas-largas.yml` |
| **E5** | Partida completa (3 jobs) solo en nocturno o por rutas | El suelo del CI baja de ~17 min al siguiente job (con E1, E2, U1 y U2: ~10-12 min) | Estimado | Alto: es el criterio pc-1/2/3 y genera las capturas que se revisan. **Decisión de producto** | `.github/workflows/ci.yml` |

### Efecto combinado (estimado, CI, PR normal)

| Escenario | Camino crítico |
|---|---|
| Hoy | ~38 min (e2e shard 1) |
| E1 | ~27,5 min (e2e) |
| E1 + E2 | ~22,5 min (manda `test-unit-shard`) |
| E1 + E2 (6 shards) + U1 + U2 | **~19-20 min** (empatan e2e ~19 min, partida completa ~17 min y unitarios ~16 min) |
| + 8 shards e2e, U4 | **~17-18 min** (manda la partida completa 820x1180) |
| + U5/E3/E4 | No bajan el camino crítico mientras exista la partida completa; ahorran minutos de runner y dejan margen para que la suite siga creciendo |
| + E5 | ~10-12 min |

## Fallos vistos en la medición local

Sin reintentos y con CPU compartida durante la primera hora fallaron 5 e2e.
En el CI del mismo commit de `dev` el e2e estuvo en verde, así que no se dan
como regresión, pero son los primeros a vigilar si se sube la carga por
runner:

- `efectos-visibles.e2e.ts` vis-1 (820x1180): área clara alrededor de la detonación 52 px² (pide ≥ 600).
- `layout-dos-zonas.e2e.ts` lay-3 (360x640): `Cannot read properties of null (reading 'x')`.
- `remate-impacto.e2e.ts` rem-1/2/4 (360x640): primer fotograma del remate 1,45 (pide ≤ 0,5).
- `render-4.e2e.ts` (360x640): el encuadre no deja las naves libres de zonas.
- `zonas-camara.e2e.ts` zc-7: una nave queda bajo la consola.

El CI usa `retries: 1`: cada fallo intermitente vuelve a pagar el test
entero, y en los largos eso son minutos.

## Lo que no se ha podido hacer

- **La partida completa no se ha ejecutado** aquí (3 tests de 8 a 16 min en
  CI): se usan los tiempos por paso del CI.
- **No se han podido descargar los `resultado-e2e.json` del CI** (el
  almacenamiento de artefactos no es accesible desde este entorno), así que
  la tabla por test es la medida aquí y no la del runner. Las duraciones por
  job del CI sí se han leído.
- La primera pasada unitaria en serie (como `npm run test:unit`) se cortó al
  llegar al límite de tiempo de una tarea en segundo plano. Se sustituyó por
  la pasada fichero a fichero, que da los mismos tiempos por fichero, pero
  **no hay una cifra de pared en serie medida de punta a punta**. La suma de
  ficheros (6 589 s) es su mejor aproximación, algo inflada por correr 3 a la
  vez.
- La comprobación de que `arm-6` y `partida-3` producen partidas idénticas
  (requisito de U1) no se ha ejecutado: cambiaría código de test.
