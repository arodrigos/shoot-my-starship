# Shoot my starship

Artillería espacial por turnos: de dos a cuatro naves flotando entre los
planetas de un sistema generado por semilla, con la gravedad de esos mismos
planetas curvando el tiro. Terreno destructible, dieciséis armas con precio
y papel propios, dos modos de juego, partidas de 1 a 4 humanos en el mismo
dispositivo y rivales de IA con mala idea. Next.js (App Router) + Phaser 4,
100% cliente, sin cuenta y sin instalar nada.

## Cómo jugar

Desde la pantalla de inicio se elige rival y modo, cuántos humanos y cuántos
rivales de IA (de 2 a 4 naves en total), y se pulsa "Jugar". Para apuntar se
arrastra por la consola inferior (arriba/abajo ajusta el ángulo, que cubre los
360°; izquierda/derecha ajusta la potencia) y se dispara con "Disparar". El
proyectil vuela de verdad, curvado por la gravedad de los planetas: al apuntar
se dibuja el círculo de influencia de cada pozo y la ruta corta que seguiría
el disparo, junto con la banda de dispersión.

### Física: gravedad y potencia

La gravedad está recalibrada para que se note: un tiro que pasa cerca de un
planeta se desvía varios radios de casco, no un puñado de píxeles. Disparar
más fuerte lo hace más recto, pero también más impreciso: la dispersión
angular crece con el cuadrado de la potencia
(`dispersionPorPotenciaGrados`, `src/sim/balistica/dispersionPotencia.ts`) y
pasa de despreciable a notarse por encima de la potencia
`UMBRAL_POTENCIA_DISPERSION_VISIBLE`. Es determinista (sale de la semilla de
la partida, el turno y la nave), así que la previsualización enseña las dos
trayectorias extremas de esa banda y no miente.

### Los dos modos

- **Barra libre**: las dieciséis armas están disponibles desde el primer
  turno, sin coste.
- **Con presupuesto** (economía por ronda): cada humano parte del mismo
  presupuesto (`PRESUPUESTO_BASE` = 1000 créditos, `src/sim/partida/economia.ts`)
  y, antes de jugar, elige sus armas en una pantalla de selección que muestra
  precio, daño y facilidad de acierto medida de cada una. Cada arma elegida es
  un disparo: el saldo baja al elegir, no al disparar, y nunca queda negativo.
  **No hay ingreso por daño**: el saldo depende solo del presupuesto y del
  gasto. Lo que no se gasta se arrastra a la ronda siguiente con un tope de un
  presupuesto base (`saldoDeRonda`). Si se agota el arsenal o se empieza sin
  elegir nada, solo quedan las tres armas gratis. La IA no usa presupuesto. El
  saldo vive solo en memoria de la pestaña.

### Multijugador local (2 a 4 naves)

Todo ocurre en el mismo dispositivo, por turnos, sin servidor. Con dos o más
humanos, entre turnos de jugadores distintos aparece una pantalla de relevo
que tapa el campo, resume el turno anterior y exige un toque ("Soy ...") antes
de enseñar nada; en modo presupuesto la selección de armas de cada jugador
también va tras ese toque, para que el siguiente no vea el arsenal del
anterior. El ajuste "todos vemos todo" desactiva el relevo. Gana la última nave
en pie.

### El catálogo: dieciséis armas, cada una con su papel

El precio sale de la combinación de daño y facilidad de acierto medida con el
simulador real (`npm run medir:armas`, informe en `docs/facilidad-armas.md`):
caras = mucho daño y fáciles; baratas = poco daño y difíciles. Las tres
armas de coste 0 (**Zanjadora Manolita**, **Petardo de Feria** y **La Pelota
de Chatarra**) son el fondo de armario.

| Arma | Precio (cr) | Papel |
| --- | --- | --- |
| Pepinazo de Cortesía | 55 | equilibrada: ni la más floja ni la más fuerte |
| Tostadora Orbital | 75 | daño alto con radio contenido: exige puntería, no regala área |
| Mortero Lamentable | 65 | área máxima permitida: perdona el error de ángulo, cuesta en consecuencia |
| Zanjadora Manolita | 0 | gratis, de daño bajo y difícil de acertar -- fondo de armario |
| Vertedero Portátil | 15 | utilitaria: rellena terreno, precio por volumen afectado, no por daño |
| Racimo de Tuppers | 85 | cinco proyectiles dispersos: área grande repartida en vez de concentrada |
| Petardo de Feria | 0 | gratis, de daño bajo, difícil y además una de cada cuatro falla del todo |
| La Pelota de Chatarra | 0 | gratis, de daño bajo: rueda hasta un agujero, pero no garantiza cuál |
| Gravitón de Segunda Mano | 45 | utilitaria: reposiciona, precio por magnitud del desplazamiento, no por daño |
| Despedida | 120 | la más cara y la más dañina: un solo uso, con autodaño real de por medio |
| Andanada de Flechas | 105 | tres proyectiles en abanico: cubre un ángulo, no un punto |
| Barrena Planetaria | 90 | atraviesa terreno y pega fuerte: cara y de las de más daño |
| Rayo Láser | 115 | recta e inmune a la gravedad, pero de las más difíciles de acertar: cara por eso |
| Mosca Cojonera | 75 | trayectoria errática: difícil de planear, castiga bien si llega |
| Granada de Espoleta | 80 | cuenta atrás desde el disparo: área grande, momento de detonar incierto |
| Gancho Pegajoso | 85 | se pega donde toque primero: elige el punto, no el momento, y pega fuerte |

### Qué le pasa a un planeta al que le arrancas un trozo

La masa de un planeta es su recuento de píxeles sólidos por su densidad
(`masaPlaneta`, `src/sim/gravedad/planetas.ts`): cuando un impacto le arranca
terreno, su masa baja de verdad y con ella su tirón gravitatorio sobre los
próximos proyectiles. Lo que **no** cambia nunca es su centro de atracción ni
su radio: son fijos desde que se genera el sistema, decisión declarada del
diseño para que un planeta afeitado por un lado no desplace su tirón en
silencio -- si el centro se recalculara como centroide, la previsualización
de trayectoria empezaría a mentir en cuanto el terreno deja de ser simétrico.

### Qué cuenta como impacto

Cada nave tiene un casco con tamaño: un radio de colisión fijo de 22px
(`RADIO_CASCO_NAVE_PX`, `src/sim/naves/impacto.ts`), no un punto. El daño de
una explosión cae con la distancia 2D real entre el punto donde estalla el
proyectil y el casco de la nave, hasta el radio de daño de esa arma
concreta -- por eso un tiro que roza el borde del radio de daño hace poco
daño, y uno que revienta pegado al casco hace el máximo declarado del arma.
Entender esto es la clave para leer por qué un disparo "que parecía bueno"
no hizo apenas nada: probablemente pasó cerca, no dentro.

### Qué juzgar al jugar

Esto es un refinamiento sobre un juego que ya funcionaba, no un juego nuevo.
Al jugar unas partidas, lo que de verdad hay que evaluar es:

- Si apuntar entre varios pozos de gravedad se siente controlable (una
  curva que se puede aprender y corregir) o caótico (una lotería que no
  responde a la intención del gesto).
- Si acertar un disparo bien apuntado resulta satisfactorio o, al
  contrario, imposible de conseguir de forma consistente.
- Si el modo con presupuesto añade una decisión real (qué arsenal merece la
  pena por su coste) o solo fricción (una pantalla de selección que no
  cambia cómo se juega).
- Si las bromas por disparo y por impacto (los bancos de frases por
  personalidad, `src/contenido/bancoBromas.ts`) siguen sonando frescas
  turno tras turno o cansan antes de que termine la partida.

## Desarrollo

```bash
npm ci
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Comprobaciones

```bash
npm run lint                          # ESLint
npm run typecheck                     # tsc --noEmit en modo estricto
npm run build                         # build de producción
npm run verificar:presupuesto-bundle  # JS del primer arranque <= 1.3MB gzip
npm run verificar:activos             # sin activos binarios ni URLs externas (ver ACTIVOS.md)
npm run test:unit                     # núcleo de simulación, sin navegador
PRUEBA_LARGA=1 npm run test:unit      # ídem, con la muestra completa de los tests estadísticos
npm run test:e2e                      # Playwright, contra un build local
```

El CI (`.github/workflows/ci.yml`) ejecuta todas estas comprobaciones en
cada push y cada pull request. Los tests estadísticos largos (ia-n*, arm-6,
partida-3, nav-3, nucleo-4...) corren ahí con una muestra reducida
(`tests/utils/muestra.ts`); la batería completa (`PRUEBA_LARGA=1`) corre cada
noche en `.github/workflows/pruebas-largas.yml`. El smoke test de traspaso
(`tests/smoke/traspaso.spec.ts`) es independiente de esta lista: lo ejecuta
la etapa de traspaso contra la URL real ya desplegada, con
`BASE_URL="$DEPLOY_URL" npx playwright test tests/smoke/traspaso.spec.ts`.
