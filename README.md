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
se dibujan los halos de cada pozo y la ruta corta que seguiría el disparo,
junto con la banda de dispersión.

La consola ocupa como mucho el 40 % del alto, anclada abajo (centro,
izquierda o derecha) y respetando la zona segura de la pantalla. Tiene tres
estados: desplegada, mínima y oculta; oculta solo deja una pestaña de 48 × 48
«Mostrar controles». El estado y el anclaje se recuerdan (`consola:estado` y
`consola:anclaje`). Las bromas y avisos flotan sobre el borde superior de la
consola.

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

Los halos de gravedad son de 3 a 4 anillos por pozo, calculados con la
aceleración real (cada anillo marca donde el tirón cae a la mitad que en el
anterior, `src/sim/gravedad/halos.ts`). Siguen a la masa viva del planeta y a
los eventos que cambian la gravedad.

Un tiro que sale de la pantalla se pierde: al cruzar cualquiera de los cuatro
bordes más un margen de 24 u (`MARGEN_SALIDA_U`, `src/sim/fisica/vuelo.ts`),
también por arriba, el vuelo termina sin detonar ni dañar, y aparece el aviso
«¡Perdido!» junto al borde de salida. La previsualización corta igual, y la IA
no gasta turnos en tiros que salen.

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
| Pepinazo de Cortesía | 35 | equilibrada: ni la más floja ni la más fuerte |
| Mortero Lamentable | 45 | área máxima permitida: perdona el error de ángulo, cuesta en consecuencia |
| Zanjadora Manolita | 0 | gratis, de daño bajo y difícil de acertar -- fondo de armario |
| Vertedero Portátil | 15 | utilitaria: rellena terreno, precio por volumen afectado, no por daño |
| Racimo de Tuppers | 40 | cinco perdigones que estallan juntos en el punto de impacto: área media con daño combinado limitado |
| Petardo de Feria | 0 | gratis, de daño bajo, difícil y además una de cada cuatro falla del todo |
| La Pelota de Chatarra | 0 | gratis, de daño bajo: rueda hasta un agujero, pero no garantiza cuál |
| Gravitón de Segunda Mano | 45 | utilitaria: reposiciona, precio por magnitud del desplazamiento, no por daño |
| Despedida | 85 | la más cara y la más dañina: un solo uso, con autodaño real de por medio |
| Barrena Planetaria | 65 | atraviesa terreno y pega fuerte: cara y de las de más daño |
| Rayo Láser | 80 | recta e inmune a la gravedad, pero de las más difíciles de acertar: cara por eso |
| Mosca Cojonera | 50 | trayectoria errática: difícil de planear, castiga bien si llega |
| Granada de Espoleta | 55 | cuenta atrás desde el disparo: área grande, momento de detonar incierto |
| Gancho Pegajoso | 90 | se agarra a planeta o nave y su onda de un octavo de pantalla daña a todo lo cercano, menos cuanto más lejos |
| Minirobot Saltaplanetas | 60 | lento pero seguro: tarda unos turnos en llegar y te deja jugar mientras tanto |

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

La zona de impacto de cada nave es exactamente su silueta dibujada (a escala
1,5, `ESCALA_DIBUJO_NAVE`): un polígono de 10 a 16 vértices por asiento
(`src/sim/naves/geometriaCasco.ts`), sin ningún círculo de colisión aparte. Un proyectil impacta en el primer punto
en que su trayectoria corta ese contorno (aunque avance 60 u en un solo paso);
si pasa fuera, aunque sea a una unidad, sigue de largo. El daño de una
explosión cae con la distancia 2D real entre el punto donde estalla y el borde
de la silueta (`distanciaACasco`, `src/sim/naves/contacto.ts`), hasta el radio
de daño de esa arma: dentro de la silueta es el máximo declarado, y un tiro
que roza el borde del radio hace poco daño. Con el deterioro, la silueta se
abolla y la zona de impacto se abolla con ella. Entender esto es la clave para
leer por qué un disparo "que parecía bueno" no hizo apenas nada: probablemente
pasó cerca, no dentro.

El tiro propio no roza a quien dispara: la nave queda inmune a su proyectil
hasta que este sale de su silueta y se aleja al menos 6 u de ella, sea cual
sea el arma y el ángulo. Una nave muerta queda en su sitio como fantasma
translúcido con el nombre del jugador, y no detiene ningún tiro.

### Daño y empuje a la vista

La barra de vida y el nombre de cada nave van en el color de su asiento, y el
daño recibido sale como un número flotante en el color del atacante. La nave
golpeada sale despedida en la dirección en que venía el proyectil, curvada por
los pozos y deslizándose por los bordes; submuniciones, explosiones de área y
eventos radiales empujan con su propia velocidad. Cada arma tiene forma y
colores propios (`src/juego/armas/aspecto.ts`), iguales en el selector, en
reposo y en vuelo, donde apunta a su rumbo y deja estela. Con movimiento
reducido no hay números flotantes, estelas, giros ni vaivén del fantasma.

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
previsualización dibuja el recorrido. Tras recibir daño, una nave se desplaza
en la dirección del disparo, de modo que repetir el disparo sin volver a
apuntar no acierta.

## Eventos del universo

Cada 2 a 5 turnos ocurre un evento, ya sorteado y anunciado en el
pronóstico («Próximo evento en N turnos», y un turno antes cuál es y a quién
cae). Pueden ser buenos o malos: lotería galáctica, vitaminas (doble daño 3
turnos), virus (mitad de daño 3 turnos), reparación de planetas, terremoto
galáctico, gravedad ×2 o ÷2, viento solar, agujero negro errante, y dos
objetos que flotan bajo la gravedad y actúan si chocan con una nave: el
corazón galáctico (+50 % de vida) y la tormenta solar (−25 %). Cada uno de
los once eventos se ve en pantalla: los que duran, con aura, icono, estela,
espiral o latido sobre lo que afectan; los instantáneos, con lluvia de
monedas, barrido o sacudida con polvo (la sacudida respeta el interruptor
«Sacudida» y el movimiento reducido). Se apagan con `?eventos=0` en la URL.

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

## Voz y resúmenes

Cada tres turnos resueltos, un resumen gracioso de cómo va la partida (quién gana,
rachas, muerte súbita cercana) aparece en el bocadillo y se lee en voz alta.
Ya no hay chiste por disparo. Los resúmenes se leen en voz alta con la Web Speech API del navegador, a través
de `easy-speech` (fijada en 2.4.0). No hay ficheros de audio ni servicios de
terceros: solo se usan voces **locales** en castellano (`es-*` con
`localService`), porque las voces remotas (las «Google español» de Chrome de
escritorio) mandarían el texto, con los nombres de los jugadores, a un
servidor ajeno. Si el dispositivo no tiene una voz así, el juego sigue en
texto, lo avisa una vez y deshabilita el interruptor.

- El interruptor «Voz» está en la consola, activado por defecto, y se recuerda
  en `voz:activada`. No afecta a la música ni a los efectos.
- La síntesis se desbloquea en el gesto de «Jugar» (o al pulsar el
  interruptor), igual que la música.
- Cada personaje tiene su timbre (velocidad 0,9–1,0 y tono 0,95–1,1, en
  `src/contenido/vocesPersonajes.ts`) sobre la misma voz del sistema, que es la
  de mejor calidad entre las locales en castellano.
- Habla de uno en uno sin cortes (la frase en curso termina; como mucho queda
  una pendiente), baja la música al 35 %
  mientras habla y calla durante el relevo y al ocultar la pestaña.

## Rendimiento

Objetivo: todo toque pinta su resultado en 200 ms o menos. La
previsualización, la resolución del disparo y la decisión de la IA se calculan
en un Web Worker (`src/juego/motor`); sin Worker se calculan en línea con el
mismo resultado. Mientras la IA decide se muestra «<nombre> está apuntando…».
Tras un impacto, el terreno solo repinta el rectángulo afectado, con una única
subida a la GPU por frame.

Para medirlo en tu propio dispositivo, abre el juego con `?rendimiento=1`:
aparece un recuadro con p95, max, frames largos, INP y un veredicto («Respuesta
≤ 200 ms» o «Supera 200 ms»). Detalle en `docs/rendimiento.md`.

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
npm run calibrar:economia             # recalibra precios y saldo, regenera docs/calibracion-economia.md
npm run medir:eventos                 # calendario de eventos sobre muchas semillas
```

El CI (`.github/workflows/ci.yml`) ejecuta todas estas comprobaciones en
cada push y cada pull request. Los tests estadísticos largos (ia-n*, arm-6,
partida-3, nav-3, nucleo-4...) corren ahí con una muestra reducida
(`tests/utils/muestra.ts`); la batería completa (`PRUEBA_LARGA=1`) corre cada
noche en `.github/workflows/pruebas-largas.yml`. La partida completa
(`tests/e2e/partida-completa.e2e.ts`: de la portada al final en 360x640,
820x1180 y 1180x820 con CPU ×4, comprobando que cada toque responde en 200 ms
o menos) va en su propio job, `e2e-partida-completa`, uno por tamaño de
pantalla; sus capturas y su tabla de respuesta se suben como artefacto del
CI. El smoke test de traspaso
(`tests/smoke/traspaso.spec.ts`) es independiente de esta lista: lo ejecuta
la etapa de traspaso contra la URL real ya desplegada, con
`BASE_URL="$DEPLOY_URL" npx playwright test tests/smoke/traspaso.spec.ts`.

## Changelog

- **Consola compacta** (#179): la consola no pasa del 40 % del alto, va
  anclada abajo y se puede minimizar, ocultar y mover a izquierda o derecha.
- **Rendimiento** (#180, #187): refresco incremental del terreno sin parón
  antes de la explosión; simulación en un Web Worker con medidor de respuesta;
  panel `?rendimiento=1` para medir en el dispositivo.
- **Tiros que salen de la pantalla** (#181, #196, #197): se pierden sin
  detonar al cruzar el borde más 24 u por cualquiera de los cuatro lados; el
  aviso «¡Perdido!» se ve junto al borde de salida. El mortero de la IA ajusta
  la potencia para que el arco quepa en pantalla.
- **Nave quieta al disparar** (#182): el propio tiro ya no roza al tirador al
  salir de su silueta.
- **Halos de gravedad** (#183): anillos por nivel calculados con la física
  real, que siguen a la masa y a la gravedad vivas.
- **Siluetas a escala 1,5** (#184): la zona de impacto es la silueta dibujada
  a su nuevo tamaño.
- **Minirobot** (#185, #186): cada detonación tiene una sola explosión, el
  robot desaparece en el mismo instante y, si se va por el borde, sale
  «¡Perdido!».
- **Empuje direccional** (#188): la nave golpeada se desplaza en la dirección
  del disparo, sin dejar de cumplirse que repetir el tiro no acierta.
- **Vida, daño y fantasmas** (#189, #190): barra de vida en el color del
  asiento, número de daño flotante en el color del atacante y fantasma
  translúcido con nombre para las naves muertas.
- **Racimo de Tuppers** (#191): estalla en cinco perdigones agrupados en el
  punto de impacto, con un tope de daño combinado por nave.
- **Eventos visibles** (#192): los once eventos tienen su representación en
  pantalla.
- **Aspecto de las armas** (#193): forma y colores propios por arma en el
  selector, en reposo y en vuelo, con estela y giro.
- **Voz de los chistes** (#194): lectura en voz alta con voces locales en
  castellano e interruptor «Voz».
- **Precios para 600 créditos** (#195): catálogo recalibrado para el saldo de
  600 créditos (sustituye la calibración intermedia de #184); la calibración y
  las mediciones de la IA recorren cinco semillas.
- **Partida completa en el CI** (#198): un test recorre una partida entera en
  tres tamaños de pantalla, con capturas y medida de respuesta, en el job
  `e2e-partida-completa`.
