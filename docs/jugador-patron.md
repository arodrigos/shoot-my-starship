# El jugador patrón

Congelado en `ia-autodanio-5`: es el rival de referencia contra el que se
miden las tres personalidades de la IA (`npm run medir:ia`, `ia-3.test.ts`).
No es un jugador óptimo ni representa a ningún perfil de persona real -- es
un disparador determinista, sembrado, contra el que "autoimpacto al 5% o por
debajo" y "La Contable gana más que Chispa" tienen un significado estable de
una ejecución a otra.

## Qué dispara

Implementado en `tests/utils/loteAleatorio.ts`, export `fuenteAleatoria`:

1. Calcula la solución balística exacta (`resolverSolucionesBalisticas`) desde
   su posición a la de la nave rival, con la gravedad del mundo.
2. Añade ruido sembrado (dos tiradas de `EstadoAleatorio`, nunca
   `Math.random`): hasta ±8° de ángulo y hasta ±10% de potencia sobre la
   solución exacta, con la potencia recortada siempre al rango [80, 100].
3. Dispara siempre `pepinazo-cortesia` -- nunca cambia de arma ni reacciona
   al estado de la partida.

No evita autoimpactarse, no gestiona `usosMaximos`, no corrige tras fallar:
apunta razonablemente bien y dispara fuerte, sin más. Esa simplicidad
deliberada es lo que lo hace **reproducible y suficiente** como vara de
medir: dos personalidades distintas enfrentadas a él producen un ranking
estable sin que el propio jugador patrón introduzca su propia variabilidad
de "cuánto le importa" ganar.

## El mundo

`MUNDO_LOTE` (`tests/utils/loteAleatorio.ts`): 960×540px, gravedad 1.0,
deriva 0. Más pequeño que los 1920×1080 del juego real (`nucleo-2`/`3`/`6`)
a propósito: con terreno real, cada disparo clona la máscara entera, y medir
cientos de partidas sobre un mundo a tamaño completo es demasiado lento para
CI. El tamaño no afecta a lo que se mide (tasas y promedios), solo al coste
por disparo.

Las naves arrancan siempre en `NAVE0_X = 150` (la personalidad bajo medición)
y `NAVE1_X = 810` (el jugador patrón), 660px de separación, sobre el mismo
terreno generado por partida con la semilla maestra del lote.

## Semillas

- `npm run medir:ia` y `ia-autodanio-3.test.ts` usan la semilla maestra
  `2024` (la misma que calibró las bandas de dificultad de `ia-3`) y
  `NUM_PARTIDAS_MEDICION_IA = 200` partidas -- el mínimo que pide el
  criterio.
- `semillasDelLote(semillaMaestra, n)` deriva las `n` semillas de partida a
  partir de la semilla maestra con el mismo generador sembrado que el resto
  del núcleo: la misma semilla maestra reproduce siempre el mismo lote de
  partidas, byte a byte (`ia-autodanio-5.test.ts` lo comprueba corriendo el
  harness dos veces y comparando el informe entero).

## Qué mide `npm run medir:ia`

Por personalidad, jugando sus 200 partidas contra el jugador patrón
(`tests/utils/medirIA.ts`, función `medirPersonalidad`):

- **Tasa de victoria**: partidas ganadas / partidas jugadas.
- **Error medio de impacto**: distancia horizontal media, en píxeles, entre
  el punto de impacto de cada disparo de la IA y la posición del objetivo en
  el momento de disparar.
- **Tasa de autoimpacto**: eventos `autoimpacto` de la IA / disparos de la
  IA -- cuenta tanto el autodaño garantizado de catálogo (Despedida) como el
  autoimpacto por trayectoria real (`impactoPropio`, gravedad).

El informe incluye también la cifra de autoimpacto **previa al bloque**
`ia-autodanio` (medida una sola vez contra el commit
`c63de318d62d15873648bd129af30fe41eb64f1d`, el padre de la PR #82, con este
mismo harness y la misma semilla maestra) para que el cambio sea comparable:

| Personalidad       | Autoimpacto previo (c63de31) | Autoimpacto actual |
| ------------------ | ----------------------------:| -------------------:|
| La Contable         | 43.47%                        | ≤5% (medido en CI)  |
| Almirante Bisagra   | 17.97%                        | ≤5% (medido en CI)  |
| Chispa              | 0.00%                         | ≤5% (medido en CI)  |

La cifra previa queda fija como referencia histórica (no se recalcula en
cada ejecución: ese commit ya no es el código que corre). La cifra actual la
recalcula `npm run medir:ia` cada vez que se ejecuta, y `ia-autodanio-3.test.ts`
la hace cumplir en CI.

## Por qué bajó tanto

El hallazgo de `ia-autodanio-3`: `usosMaximos` (el límite de usos de un arma,
Despedida = 1) nunca se comprobaba para la IA -- solo lo aplicaba el selector
del jugador humano (`src/juego/control/store.ts`). Sin ese límite, una
personalidad que prefiere Despedida (daño al rival Y autodaño garantizado,
`danio-y-autodanio` en el catálogo) podía reelegirla turno tras turno,
autodañándose casi cada vez que disparaba. `elegirArma` (`src/sim/ia/decidir.ts`)
ahora recibe cuántas veces lleva disparada cada arma esta nave
(`usosPorArma`) y descarta las agotadas de la lista de preferencia de la
personalidad antes de aplicar sus pesos -- ni reordena esa lista (lo que ya
rompió las bandas de `ia-3` en un intento anterior) ni toca la fórmula de
ángulo/potencia que `ia-4` fija bit a bit, solo evita reproponer un arma que
ya no se puede volver a disparar. `Partida.ts` (la partida en vivo) y el
harness de medición (`tests/utils/medirIA.ts`) trackean este contador cada
uno por su lado y se lo pasan a `crearFuenteIA`, igual que ya hacían con
`ultimoIntento`.
