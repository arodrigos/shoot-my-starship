# Shoot my starship

Artillería espacial por turnos: de dos a cuatro naves flotando entre los
planetas de un sistema generado por semilla, con la gravedad de esos mismos
planetas curvando el tiro. Terreno destructible, quince armas con precio
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

- **Barra libre**: las quince armas están disponibles desde el primer
  turno, sin coste.
- **Con presupuesto** (economía por ronda): todos los asientos, también las
  IAs, parten del mismo presupuesto (`PRESUPUESTO_BASE` = 600 créditos,
  `src/sim/economia/parametros.ts`). No hay pantalla previa de compra: todas
  las armas están siempre en el selector y cada una de pago se cobra al
  disparar (seleccionar o cambiar de arma no cobra). Una arma que el saldo no
  cubre se ve deshabilitada con «Te faltan N cr», y el núcleo rechaza esa
  entrada sin cambiar el estado. **No hay ingreso por daño**: el saldo depende
  solo del presupuesto y del gasto. Cada partida empieza con
  los 600 créditos fijos, sin importar lo que sobró en la anterior. Las
  tres armas gratis siempre están y no cobran, pero hacen solo el 25 % del daño
  del arma de pago más floja. Cada IA decide su compra en cada turno según su
  perfil de gasto (`decidirCompraTurno`). El saldo vive solo en memoria de la
  pestaña.

### Multijugador local (2 a 4 naves)

Todo ocurre en el mismo dispositivo, por turnos, sin servidor. Con dos o más
humanos, entre turnos de jugadores distintos aparece una pantalla de relevo
que tapa el campo, resume el turno anterior y exige un toque ("Soy ...") antes
de enseñar nada; el ajuste "todos vemos todo" desactiva el relevo. Gana la última nave
en pie.

### El catálogo: quince armas, cada una con su papel

El precio sale de la combinación de daño y facilidad de acierto medida con el
simulador real (`npm run medir:armas`, informe en `docs/facilidad-armas.md`):
caras = mucho daño y fáciles; baratas = poco daño y difíciles. Las tres
armas de coste 0 (**Zanjadora Manolita**, **Petardo de Feria** y **La Pelota
de Chatarra**) son el fondo de armario.

| Arma | Precio (cr) | Papel |
| --- | --- | --- |
| Pepinazo de Cortesía | 55 | equilibrada: ni la más floja ni la más fuerte |
| Mortero Lamentable | 65 | área máxima permitida: perdona el error de ángulo, cuesta en consecuencia |
| Zanjadora Manolita | 0 | gratis, de daño bajo y difícil de acertar -- fondo de armario |
| Vertedero Portátil | 15 | utilitaria: rellena terreno, precio por volumen afectado, no por daño |
| Racimo de Tuppers | 85 | cinco proyectiles dispersos: área grande repartida en vez de concentrada |
| Petardo de Feria | 0 | gratis, de daño bajo, difícil y además una de cada cuatro falla del todo |
| La Pelota de Chatarra | 0 | gratis, de daño bajo: rueda hasta un agujero, pero no garantiza cuál |
| Gravitón de Segunda Mano | 45 | utilitaria: reposiciona, precio por magnitud del desplazamiento, no por daño |
| Despedida | 125 | la más cara y la más dañina: un solo uso, con autodaño real de por medio |
| Barrena Planetaria | 90 | atraviesa terreno y pega fuerte: cara y de las de más daño |
| Rayo Láser | 115 | recta e inmune a la gravedad, pero de las más difíciles de acertar: cara por eso |
| Mosca Cojonera | 75 | trayectoria errática: difícil de planear, castiga bien si llega |
| Granada de Espoleta | 80 | cuenta atrás desde el disparo: área grande, momento de detonar incierto |
| Gancho Pegajoso | 115 | se agarra a planeta o nave y su onda de un octavo de pantalla daña a todo lo cercano, menos cuanto más lejos |
| Minirobot Saltaplanetas | 85 | lento pero seguro: tarda unos turnos en llegar y te deja jugar mientras tanto |

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

La zona de impacto de cada nave es exactamente su silueta dibujada: un
polígono de 10 a 16 vértices por asiento (`src/sim/naves/geometriaCasco.ts`),
sin ningún círculo de colisión aparte. Un proyectil impacta en el primer punto
en que su trayectoria corta ese contorno (aunque avance 60 u en un solo paso);
si pasa fuera, aunque sea a una unidad, sigue de largo. El daño de una
explosión cae con la distancia 2D real entre el punto donde estalla y el borde
de la silueta (`distanciaACasco`, `src/sim/naves/contacto.ts`), hasta el radio
de daño de esa arma: dentro de la silueta es el máximo declarado, y un tiro
que roza el borde del radio hace poco daño. Con el deterioro, la silueta se
abolla y la zona de impacto se abolla con ella. Entender esto es la clave para
leer por qué un disparo "que parecía bueno" no hizo apenas nada: probablemente
pasó cerca, no dentro.

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

## Presupuesto y precios

En el modo «Con presupuesto» cada arma de pago, el escudo y los propulsores
se cobran al usarlos, no al seleccionarlos. El precio de cada arma sale de su
daño y de lo fácil que es acertar con ella (`src/sim/armas/precio.ts`); el
saldo de partida (fijo, sin arrastre) está en `src/sim/economia/parametros.ts`. La
lotería galáctica solo existe en este modo. Las tres armas gratis nunca se
agotan, pero hacen un 25 % del daño de la de pago más floja y cada disparo
tiene un 25 % de provocar un evento al azar sobre cualquier nave viva.

## Escudos y propulsores

Son equipo, en la pestaña «Equipo» del selector, y usarlos gasta el turno:
o disparas, o te proteges, o te mueves. El **escudo** (90 cr en presupuesto)
bloquea el daño y el empuje de los disparos ajenos durante 2 turnos tuyos; no
frena los objetos de evento ni el drenaje de la muerte súbita. Los
**propulsores** (60 cr) lanzan la nave con la misma gravedad que un proyectil
y la cortan al llegar al círculo marcado, de área un cuarto de la pantalla. La
previsualización dibuja el recorrido. Tras recibir daño, una nave se recoloca
dentro de un octavo de la diagonal, de modo que repetir el disparo sin volver
a apuntar no acierta.

## Eventos del universo

Cada 2 a 5 turnos ocurre un evento, ya sorteado y anunciado en el
pronóstico («Próximo evento en N turnos», y un turno antes cuál es y a quién
cae). Pueden ser buenos o malos: lotería galáctica, vitaminas (doble daño 3
turnos), virus (mitad de daño 3 turnos), reparación de planetas, terremoto
galáctico, gravedad ×2 o ÷2, viento solar, agujero negro errante, y dos
objetos que flotan bajo la gravedad y actúan si chocan con una nave: el
corazón galáctico (+50 % de vida) y la tormenta solar (−25 %). Se apagan con
`?eventos=0` en la URL.

## Muerte súbita

Para que ninguna partida se alargue sin fin, desde la ronda 10 todas las
naves vivas pierden vida a la vez al empezar cada ronda: 5, 10, 15, 20…
El escudo no lo frena. Una ronda antes aparece «Muerte súbita en 1 ronda».
Durante la muerte súbita no hay curas: los corazones flotantes se disuelven y
no se programan ni corazones ni reparaciones (tampoco los que provocan las
armas gratis). Si las últimas naves caen en el mismo paso, es un empate real
(«¡Empate!»), también con dos naves. Toda partida acaba antes de empezar la
ronda 16 (`src/sim/partida/muerteSubita.ts`). Se apaga con `?muerte=0`.

## Música y sonido

Todo el audio se genera con Web Audio, sin ficheros. Hay dos controles
independientes en la consola: «Sonido» (efectos, silenciado por defecto) y
«Música» (activada por defecto, se recuerda entre sesiones). Ninguno de los
dos crea el audio hasta un gesto tuyo: pulsar «Jugar» o el propio control.
La música es un bucle sobre una escala pentatónica que tarda más de 60 s en
repetirse y suena por debajo de los efectos.

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
