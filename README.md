# Shoot my starship

Artillería espacial por turnos: de dos a cuatro naves flotando entre los
planetas de un sistema generado por semilla, con la gravedad de esos mismos
planetas curvando el tiro. Terreno destructible, doce armas con precio
y papel propios, dos modos de juego, partidas de 1 a 4 humanos en el mismo
dispositivo y rivales de IA con mala idea. Next.js (App Router) + Phaser 4,
100% cliente, sin cuenta y sin instalar nada.

## Cómo jugar

Desde la pantalla de inicio se elige rival y modo, cuántos humanos y cuántos
rivales de IA (de 2 a 4 naves en total), el nivel de los rivales y el reloj de
turno, y se pulsa "Jugar". El título y el
interruptor «Música» van en una barra fija arriba y «Jugar» en otra fija
abajo, así que en ningún tamaño hace falta desplazarse para encontrarlos.

Para apuntar se apoya el dedo en cualquier punto del lienzo y se gira
alrededor de la propia nave (`src/juego/control/apuntado.ts`):
- **Dirección:** la flecha sigue al dedo alrededor de la nave y cubre los 360°,
  sin topes: una vuelta del dedo es una vuelta del tiro.
- **Fuerza:** en el mismo gesto, alejar el dedo de la nave sube la fuerza y
  acercarlo la baja, 0,3 por píxel, entre 0 y 100.
- **Toque:** un movimiento de menos de 4 px no cambia nada, así que apoyar el
  dedo no mueve el apuntado. El resultado depende del recorrido, no de
  cuántos eventos táctiles entregue el dispositivo.
- **Cerca de la nave:** a menos de 30 px de ella el apuntado se queda quieto;
  al salir de esa zona se sigue desde donde estaba.
- **Flecha:** sale de la nave, crece con la fuerza y lleva en la punta la
  etiqueta «grados · fuerza». Se aparta si el dedo la taparía.

Con la consola desplegada también se puede ajustar cada valor por separado
(`src/juego/hud/ControlHUD.tsx`):
- **Barra «Ángulo»** (0° a 360°, con el valor en décimas) y **barra
  «Potencia»** (0 % a 100 %): tocar o deslizar el dedo dentro de una barra
  fija su valor según dónde esté el dedo en ella (borde izquierdo, mínimo;
  derecho, máximo) y no toca el otro.
- **Pasos finos**: los botones `-0.1°`/`+0.1°` y `-1%`/`+1%` a los lados de
  cada barra.
- **Resto de la consola**: arrastrar desde un punto libre mueve los dos a la
  vez (en vertical el ángulo, en horizontal la potencia). Un gesto que empieza
  en cualquier punto de la fila del ángulo o de la potencia (barra, borde,
  hueco o botones de paso) nunca arranca ese arrastre doble, y las barras
  ocupan todo el alto de su fila, así que ajustar el ángulo con el dedo ya no
  mueve la potencia.

Se dispara con "Disparar". El proyectil vuela de verdad, curvado por la
gravedad de los planetas, cuyos halos marcan cada pozo. Mientras se apunta se
ve una trayectoria corta (`src/juego/mira/trayectoriaPantalla.ts`), medida en
la pantalla y no en el mundo para que se lea igual con o sin zoom. Si L es el
lado mayor de la pantalla:
- la línea central, simulada con la misma física que el disparo, llega hasta
  2/8 de L o hasta donde choca;
- un abanico estrecho (±9°) la acompaña hasta 1/8 de L, y uno ancho y tenue
  (±45°) sigue de 1/8 a 2/8 de L;
- con la Mosca Cojonera las aperturas son el doble.

El abanico ancho no se calcula solo con sus dos bordes: son nueve
trayectorias repartidas por toda la apertura (bordes y centro incluidos) y se
pinta en tiras entre cada par de vecinas, recortadas entre 1/8 y 2/8 de L,
sin líneas entre tiras: solo llevan trazo los dos bordes. Así, aunque con la
Mosca (±90°) un borde choque enseguida contra el planeta, el resto del abanico
sigue viéndose.

La trayectoria no depende de la potencia y siempre se ve: si el cálculo no
llega a tiempo, se dibujan dos cuñas rectas con las mismas aperturas.

### Cámara: zoom y desplazamiento

El mundo se ve entero por defecto. Con dos dedos sobre el lienzo se pellizca
para acercar (hasta ×3) y se deslizan juntos para moverse; si el segundo dedo llega
con el apuntado ya empezado, el apuntado vuelve a como estaba al apoyar el
primero. En escritorio, la rueda acerca o aleja anclada al puntero, y el
pellizco del trackpad hace lo mismo. El encuadre nunca sale del mundo salvo por lo que tapa el HUD.

Con el HUD tapando parte de la pantalla (consola, ⚙, recuadro de
`?rendimiento=1`), la cámara solo se mueve si una nave, el proyectil o el impacto
quedarían tapados: entonces encuadra ese grupo en el mayor rectángulo libre, con
zoom ≤ 1 y pudiendo salir del mundo por el lado tapado (lo de fuera se ve como
espacio). Si nada queda tapado, la vista es la completa de siempre. Plegar,
ocultar o reanclar la consola, girar el dispositivo y «Texto grande» reencuadran
en 300 ms; apartarse la consola al disparar no mueve las naves. En modo manual
(zoom) la cámara no se reencuadra sola. Con `?rendimiento=1` el recuadro enseña
`reencuadre: N ms`, y `__debug.zonasCamara()` (solo lectura) da las zonas, el
rectángulo libre y si el encuadre es válido.

Con zoom aparece a la derecha el botón «Ver todo», que vuelve a la vista
completa en 300 ms (sin animación con movimiento reducido). Al cambiar de
turno, y antes de que el relevo enseñe nada, la cámara vuelve a la vista completa sin animar.
Con zoom, la cámara sigue al proyectil en vuelo sin dejar que se escape por el
borde. La primera vez de cada partida sale la ayuda «Pellizca con dos dedos
para acercar; «Ver todo» para volver», que se va al primer toque. Un único
controlador mueve la cámara (`src/juego/camara/controladorCamara.ts`).

La consola ocupa como mucho el 40 % del alto (con «Texto grande», todo el alto menos 64 px, para que Disparar, Repetir y el selector de arma sigan dentro de la pantalla). Ese tope es la variable CSS `--alto-max-consola`, definida en `src/app/globals.css` y vigilada por `tests/e2e/consola-texto-grande.e2e.ts`. Va anclada abajo (centro,
izquierda o derecha) y respetando la zona segura de la pantalla. Tiene tres
estados: desplegada, mínima y oculta; oculta solo deja una pestaña de 48 × 48
«Mostrar controles». El estado y el anclaje se recuerdan (`consola:estado` y
`consola:anclaje`). En mínima, el icono del arma y su precio van sobre una
pastilla con fondo opaco, para que se lean con cualquier planeta detrás.

Las ayudas del apuntado y de la cámara viven dentro de la zona de la consola
(encima de sus controles, o de la pestaña si está oculta), así que la cámara las aparta de las
naves y el ✕ de la del apuntado nunca cae sobre una. Con «Texto grande» la de
la cámara espera a que se cierre la del apuntado: juntas no dejan franja para encuadrar las naves. El resto de avisos (cartel de evento, broma,
reacción) van en una capa propia, aparte de la consola, y se ven aunque esté
oculta. Esa capa elige entre empezar a 130 px del borde superior, por debajo
del rótulo de la deriva, o ir justo encima de la consola: el sitio que no
pisa ninguna nave, y solo cambia entre avisos. Si los dos pisan alguna, los
avisos pasan por encima sin recoger toques; la capa nunca reencuadra la
cámara. Cada aviso lleva fondo opaco. En las partidas espaciales el
rótulo «Vacío: aquí no empuja nada…» se ve 4 s y se desvanece para no tapar
ningún planeta (con movimiento reducido desaparece sin transición). Solo hay
un «¡Perdido!» a la vez: el siguiente retira el anterior, y si arriba está el
aviso de versión nueva, el «¡Perdido!» baja para quedar debajo de él.

### Ajustes

Arriba a la derecha hay un único botón ⚙, fuera de la consola, así que está
al alcance aunque la consola esté mínima, oculta o apartada durante el vuelo.
Abre un panel (en dos columnas en pantallas anchas y bajas, como una tableta
apaisada, para que se vea entero con «Cerrar» dentro) con:
- **Histórico**: los mensajes de la partida.
- **Sacudida**, **Vibración** (solo donde el dispositivo vibra; ver
  «Vibración»), **Rastro**, **Sonido**, **Música** y **Voz**, cada uno con
  una línea que explica qué hace. Si el dispositivo no tiene voz local en
  castellano, el aviso sale debajo de «Voz».
- **Texto grande**: agranda un 30 % los textos HTML del HUD (consola, menú,
  avisos, relevo y parte de guerra), no la portada ni los textos pintados en
  el lienzo. Se aplica al momento, sin reiniciar la partida, y se recuerda
  entre visitas.
- El estado del juego sin conexión y la versión instalada.

**Legibilidad.** Todo texto HTML del HUD (consola, menú, avisos, relevo y
parte de guerra) mide 14 px o más y pasa por `tamTexto()`
(`src/juego/hud/legibilidad.ts`), que lo multiplica por `--escala-texto`. Los
pares de color del HUD llegan a 4,5:1 (WCAG AA), y «Otra partida» lleva texto
oscuro sobre el coral. En el parte de guerra el contenido va sobre un panel
opaco, se desplaza si no cabe y «Otra partida» queda fija al pie. El texto
pintado en el lienzo no cambia.

Tocar el lienzo no cierra el panel, porque ese toque apunta; se cierra con
«Cerrar», con Escape o volviendo a pulsar ⚙, y se cierra solo al disparar
para no tapar la trayectoria.

**Rastro** (activado por defecto, se recuerda en
`rastro-ultimo-disparo:activo`) dibuja a guiones y tenue la trayectoria del
último disparo, sea de quien sea, en el color de quien disparó y con el
contorno de su silueta en el punto de impacto. Cada disparo sustituye al
anterior, y un tiro perdido no lleva silueta.

**Lectores de pantalla**: una región `aria-live="polite"` invisible
(`src/juego/hud/AnunciosHUD.tsx`) anuncia el cambio de turno («Tu turno» o
«Turno de <nombre>»), «¡Tiempo! Disparo automático» y el ganador. Vive solo en
memoria y se vacía en cada partida.

### Física: gravedad y potencia

La gravedad está recalibrada para que se note: un tiro que pasa cerca de un
planeta se desvía varios radios de casco, no un puñado de píxeles. Disparar
más fuerte lo hace más recto, pero también más impreciso: la dispersión
angular crece con el cuadrado de la potencia
(`dispersionPorPotenciaGrados`, `src/sim/balistica/dispersionPotencia.ts`) y
pasa de despreciable a notarse por encima de la potencia
`UMBRAL_POTENCIA_DISPERSION_VISIBLE`. Es determinista (sale de la semilla de
la partida, el turno y la nave). La trayectoria que se ve al apuntar no
dibuja esa dispersión: su abanico tiene la misma apertura a cualquier
potencia.

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

- **Barra libre**: las doce armas están disponibles desde el primer
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
  dos armas gratis siempre están y no cobran, pero hacen solo el 25 % del daño
  del arma de pago más floja. Cada IA decide su compra en cada turno según su
  perfil de gasto (`decidirCompraTurno`). El saldo vive solo en memoria de la
  pestaña.

### Multijugador local (2 a 4 naves)

Todo ocurre en el mismo dispositivo, por turnos, sin servidor. Con dos o más
humanos, entre turnos de jugadores distintos aparece una pantalla de relevo
que tapa el campo, resume el turno anterior y exige un toque ("Soy ...") antes
de enseñar nada; el ajuste "todos vemos todo" desactiva el relevo. Gana la última nave
en pie.

Las pestañas de jugador muestran el nombre entero siempre que cabe. Con 3 o 4
naves se quitan primero los títulos de delante («Almirante Bisagra» pasa a
«Bisagra») y solo si ni así cabe se corta con elipsis. «Jugador 2» conserva
su número. El nombre completo sigue disponible para los lectores de pantalla.

### Nivel de la IA

Con algún rival de IA en la partida, bajo «Elige rival» aparece «Nivel» con
tres opciones: **Fácil** (falla más, para jugar con peques o empezar),
**Normal** (el juego de siempre, por defecto) y **Difícil** (afina más). Vale
para todos los rivales de la partida y no cambia su personalidad ni cómo
hablan: solo ensancha o estrecha su margen de error al apuntar
(`src/sim/ia/nivel.ts`). El nivel elegido se recuerda junto con el rival, en
`partida-completa:progreso`. En la partida, la barra de cada rival de IA
enseña su nivel en una segunda línea.

### Reloj de turno

«Reloj de turno» ofrece **Off**, **30 s**, **45 s** y **60 s**. Viene en Off
y no se recuerda entre sesiones. Con reloj, cada turno humano tiene una cuenta
atrás en una píldora sobre la pestaña del jugador activo, que se pone ámbar
y late en los últimos 10 s (sin latido con movimiento reducido). Si se acaba
el tiempo, sale «¡Tiempo! Disparo automático» y se dispara solo lo que haya
en la mira, con el arma gratis si la elegida no se puede usar; el escudo y
los propulsores nunca se activan solos. El reloj solo corre mientras el
turno se puede jugar: arranca tras «Soy ...» (o al habilitarse «Disparar» si
no hay relevo), se para durante el disparo, el relevo y los turnos de la IA,
y se pausa si sales de la app.

### El catálogo: doce armas, cada una con su papel

El precio sale de la combinación de daño y facilidad de acierto medida con el
simulador real (`npm run medir:armas`, informe en `docs/facilidad-armas.md`):
caras = mucho daño y fáciles; baratas = poco daño y difíciles. Las dos
armas de coste 0 (**Zanjadora Manolita** y **La Pelota de Chatarra**) son el
fondo de armario. Los motivos de las tres armas retiradas están en
`docs/catalogo-armas.md`.

| Arma | Precio (cr) | Papel |
| --- | --- | --- |
| Pepinazo de Cortesía | 35 | equilibrada: ni la más floja ni la más fuerte |
| Zanjadora Manolita | 0 | gratis, de daño bajo y difícil de acertar -- fondo de armario |
| Vertedero Portátil | 15 | utilitaria: rellena terreno, precio por volumen afectado, no por daño |
| Racimo de Tuppers | 40 | tres perdigones en fila, bien separados: cubre ancho con tres cráteres pequeños y cada nave recibe solo el daño del más fuerte |
| La Pelota de Chatarra | 0 | gratis, de daño bajo: rueda hasta un agujero, pero no garantiza cuál |
| Gravitón de Segunda Mano | 45 | utilitaria: reposiciona, precio por magnitud del desplazamiento, no por daño |
| Despedida | 80 | la más cara y la más dañina: un solo uso, con autodaño real de por medio |
| Barrena Planetaria | 65 | atraviesa terreno y pega fuerte: cara y de las de más daño |
| Rayo Láser | 75 | recta e inmune a la gravedad, pero de las más difíciles de acertar: cara por eso |
| Mosca Cojonera | 50 | trayectoria errática: difícil de planear, castiga bien si llega |
| Gancho Pegajoso | 75 | se agarra a planeta o nave y su onda de un octavo de pantalla daña a todo lo cercano, menos cuanto más lejos |
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

Los cuatro colores de asiento (azul, rojo, verde y lila,
`src/juego/naves/paletaNaves.ts`) están medidos para distinguirse también con
protanopía, deuteranopía y tritanopía, y para contrastar con el fondo
(`tests/unit/naves/paleta-daltonismo.test.ts`: ΔE2000 ≥ 12 entre asientos y
contraste WCAG ≥ 3). El azul y el lila se retocaron porque para un tritanope
eran casi iguales.

El golpe que destruye una nave lleva remate: un destello blanco breve, una
pausa corta con la explosión congelada y un acercamiento de cámara ×1,5 al
punto del impacto antes de volver al encuadre, en menos de un segundo, sin
tocar la simulación. Ese golpe no sacude la cámara. Con movimiento reducido
o con «Sacudida» apagada queda solo el destello, que no retrasa el turno.

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
lotería galáctica solo existe en este modo. Las dos armas gratis nunca se
agotan, pero hacen un 25 % del daño de la de pago más floja y cada disparo
tiene un 25 % de provocar un evento al azar sobre cualquier nave viva.

## Escudos y propulsores

Son equipo, en la pestaña «Equipo» del selector, y usarlos gasta el turno:
o disparas, o te proteges, o te mueves. El **escudo** (90 cr en presupuesto)
bloquea el daño y el empuje de los disparos ajenos durante 2 turnos tuyos; no
frena los objetos de evento ni el drenaje de la muerte súbita. Los
**propulsores** (60 cr) lanzan la nave con la misma gravedad que un proyectil
y la cortan al llegar al círculo marcado, de área un cuarto de la pantalla. La
previsualización dibuja el recorrido. Si la ruta apunta contra el planeta y
la nave se quedaría a menos de 12 u de donde está, se pinta en rojo, sale
«Bloqueado: apunta lejos del planeta» y no se puede gastar el turno. Si el
vuelo previsto no supera el largo de la nave, sale «Vuelo corto: la nave
apenas se mueve.» en el mismo hueco de avisos, pero solo avisa: se puede
lanzar igual (`src/juego/control/vueloPropulsores.ts`). Tras recibir daño, una nave se desplaza
en la dirección del disparo, de modo que repetir el disparo sin volver a
apuntar no acierta.

## Eventos del universo

Cada 2 a 5 turnos ocurre un evento, ya sorteado y anunciado en el
pronóstico («Próximo evento en N turnos», y un turno antes cuál es y a quién
cae). Pueden ser buenos o malos: lotería galáctica, vitaminas (doble daño 3
turnos), virus (mitad de daño 3 turnos), reparación de planetas, terremoto
galáctico, gravedad ×2 o ÷2, viento solar, agujero negro errante, y dos
objetos que flotan bajo la gravedad y actúan si chocan con una nave: el
corazón galáctico (+75 de vida) y la tormenta solar (−35). Cada uno de
los once eventos se ve en pantalla: los que duran, con aura, icono, estela,
espiral o latido sobre lo que afectan; los instantáneos, con lluvia de
monedas, barrido o sacudida con polvo (la sacudida respeta el interruptor
«Sacudida» y el movimiento reducido). Se apagan con `?eventos=0` en la URL.

## Muerte súbita

Para que ninguna partida se alargue sin fin, desde la ronda 14 todas las
naves vivas pierden vida a la vez al empezar cada ronda: 4, 8, 12, 16… Cada
nave empieza con 150 de vida (`src/sim/naves/vida.ts`).
El escudo no lo frena. Una ronda antes aparece «Muerte súbita en 1 ronda».
Durante la muerte súbita no hay curas: los corazones flotantes se disuelven y
no se programan ni corazones ni reparaciones (tampoco los que provocan las
armas gratis). Si las últimas naves caen en el mismo paso, es un empate real
(«¡Empate!»), también con dos naves. Toda partida acaba antes de empezar la
ronda 22 (`src/sim/partida/muerteSubita.ts`). Se apaga con `?muerte=0`.

## Música y sonido

Todo el audio se genera con Web Audio, sin ficheros. Hay dos controles
independientes en Ajustes (⚙): «Sonido» (efectos, silenciado por defecto) y
«Música» (activada por defecto, se recuerda entre sesiones). Ninguno de los
dos crea el audio hasta un gesto tuyo: pulsar «Jugar» o el propio control.
La música es un bucle sobre una escala pentatónica que tarda más de 60 s en
repetirse y suena por debajo de los efectos.

## Voz y resúmenes

Cada tres turnos resueltos, un resumen gracioso de cómo va la partida (quién gana,
rachas, desplazamientos, muerte súbita cercana) aparece en el bocadillo y se
lee en voz alta. Ya no hay chiste por disparo. Si solo juega un humano, los
textos le hablan a él («Tu nave», «Te desplazaron: estabas aquí.»), y los
rivales de IA aparecen con su nombre corto («Bisagra», «La Contable»,
«Chispa»), el mismo de las pestañas. Los resúmenes se leen en voz alta con la Web Speech API del navegador, a través
de `easy-speech` (fijada en 2.4.0). No hay ficheros de audio ni servicios de
terceros: solo se usan voces **locales** en castellano (`es-*` con
`localService`), porque las voces remotas (las «Google español» de Chrome de
escritorio) mandarían el texto, con los nombres de los jugadores, a un
servidor ajeno. Si el dispositivo no tiene una voz así, el juego sigue en
texto, lo avisa una vez y deshabilita el interruptor.

- El interruptor «Voz» está en Ajustes (⚙), activado por defecto, y se recuerda
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
aparece un recuadro con p95, max, frames largos, INP, la latencia del último
toque en «Rastro», la del reloj de turno (`reloj-turno`, del toque en
«Soy ...» a la píldora pintada), la del último gesto de cámara
(`gesto-camara`) y la de «Ver todo» (`ver-todo`), y un veredicto («Respuesta ≤ 200 ms» o «Supera 200 ms»).
El botón «Medir» del recuadro juega una partida de medición sin intervención
(cinco tramos, máximo 150 s desde que pinta; los disparos del humano los elige el
simulador para que detonen sin matar al rival, y los frames se miden con el
intervalo real del rAF) y copia al portapapeles un resumen listo para pegar
en un issue. Si un tramo no impacta o el simulador no encuentra tiro, la medición acaba INCOMPLETA con su motivo («sin impacto» o «sin tiro»). Detalle en `docs/rendimiento.md`.

La trayectoria de apuntado (la línea y su abanico)
tiene un presupuesto de cómputo de 32 ms
(`PRESUPUESTO_COMPUTO_ABANICO_MS`, `src/sim/armas/previsualizacion.ts`): si
un cálculo lo supera, se dibujan las cuñas rectas antes que un trazado que ya
ha costado más de lo prometido. Mientras tanto no se recalcula con cada
movimiento del dedo; se vuelve a pedir una sola vez pasados 1,5 s
(`REINTENTO_MIRA_OCULTA_MS`, `src/juego/mira/miraOculta.ts`) o al cambiar de
turno.

## Vibración

En el móvil, el juego vibra un instante al pulsar «Disparar» con un arma (y
cuando el reloj de turno dispara por ti) y cuando un tiro hace daño a una
nave, sea quien sea el que dispara. Cada suceso tiene su patrón
(`PATRONES_VIBRACION`, `src/juego/control/vibracion.ts`): un pulso corto al
disparar, un doble pulso al hacer daño a una nave y uno más largo al
destruirla. Cuenta el daño, no el contacto: una detonación junto a la nave que
le quita vida sin tocar su silueta también vibra, y un impacto sin daño no.
Ninguno pasa de 200 ms, los impactos seguidos se limitan a uno cada 250 ms (un
Racimo de Tuppers da una sola vibración) y no vibra con la pestaña oculta ni
durante la partida automática de «Medir».

Se apaga sola si el sistema pide reducir el movimiento
(`prefers-reduced-motion`), y no hace nada donde el dispositivo no la admite:
sin `navigator.vibrate` o sin pantalla táctil no hay nada que cambie. La
preferencia se guarda en `localStorage` (`vibracion:activa`; solo el valor
`0` la apaga). Para las pruebas, `window.__debug.vibracion()` devuelve una
instantánea de solo lectura con las últimas llamadas; el doble de
`navigator.vibrate` para Playwright está en `tests/utils/vibracionFalsa.ts`.

El interruptor «Vibración» está en Ajustes (⚙), justo debajo de «Sacudida». Se
aplica al momento y, al pasar a On, el mismo toque da un pulso de prueba. Con
«reducir movimiento» activado sale deshabilitado, en Off y con el motivo; la
preferencia guardada no se toca.

### Qué se nota en cada dispositivo

- **Android con Chrome, Edge o Samsung Internet**: vibra, y el interruptor
  aparece en Ajustes.
- **Android con Firefox**: el interruptor aparece, pero el navegador no vibra;
  el pulso de prueba al pasar a On lo delata.
- **iPhone e iPad, con cualquier navegador** (también instalado como app): no
  vibra y no hay interruptor, porque iOS no ofrece la API.
- **Ordenador**: no hay interruptor.
- **Con «reducir movimiento» activado** en el sistema: queda apagada.
- **Android en silencio o con la vibración del sistema apagada**: puede no
  vibrar aunque esté en On.

## Pantalla encendida durante la partida

Mientras hay una partida en curso, el juego pide al navegador que no apague ni
atenúe la pantalla (Screen Wake Lock API), para que un rato sin tocar nada
—pensar el tiro, pasar el dispositivo, la IA jugando— no corte el ritmo, la
música ni la voz.

- Se pide dentro del gesto de «Jugar», «Continuar» y «Otra partida». En la
  portada no se pide nunca.
- Se suelta al aparecer el parte de guerra, y el navegador lo suelta solo
  cuando la página queda oculta; al volver, si la partida sigue, se pide otra
  vez. Si el sistema lo suelta o lo rechaza con la partida en curso, se
  reintenta en el siguiente toque (hasta 3 rechazos seguidos por partida).
- Si el navegador no lo soporta o lo rechaza, el juego sigue igual que sin esta
  mejora: no aparece ningún aviso ni error.
- En la PWA instalada en iOS solo funciona desde iOS 18.4; en versiones
  anteriores la pantalla se apaga como siempre.
- Playwright no simula el apagado de pantalla: los e2e usan un doble de
  `navigator.wakeLock` (`tests/utils/wakeLockFalso.ts`) y leen el estado en
  `window.__debug.pantallaEncendida()`.

## Jugar sin conexión

En el build de producción, un service worker de
[Serwist](https://serwist.pages.dev/) (`src/app/sw.ts`, servido en
`/serwist/sw.js`) guarda el juego entero la primera vez que se abre con
conexión; desde entonces se juega sin red. Al terminar la primera instalación
sale unos segundos «Listo para jugar sin conexión», y el pie del panel de
Ajustes enseña el estado y la versión. Con `npm run dev` no se registra.

Cuando hay una versión nueva, se descarga en segundo plano (también se
comprueba cada 30 minutos y al volver a la pestaña) y aparece «Hay una versión
nueva» con «Recargar» y «Luego». La versión nueva solo se activa al pulsar
«Recargar», nunca a mitad de partida; «Luego» oculta el aviso hasta la
siguiente carga.

Si la caché sirviera una versión que no toca, abrir el juego con `?sw=0`
desinstala el service worker, borra sus cachés y recarga sin él.

## Stack y dependencias

- **Next.js 16** (App Router, TypeScript estricto) y **React 19**. Phaser se
  monta sin SSR porque toca `window` al cargarse.
- **Phaser 4** para el lienzo del juego y **simplex-noise** para el terreno.
- **easy-speech** para la voz (Web Speech API del navegador).
- **Serwist** (`@serwist/window`, `@serwist/turbopack`, `serwist`) para el
  service worker sin conexión.
- Desarrollo y pruebas: ESLint, `node:test` con `tsx`, **fast-check**
  (propiedades), **Playwright** con `@axe-core/playwright`, y `canvas`,
  `jsdom`, `pngjs`, `pixelmatch` y `culori` para pruebas de render y de color.

No hay base de datos, cuentas, servidor propio ni migraciones: todo corre en
el navegador.

## Desarrollo

El CI usa Node 22.

```bash
npm ci
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Para probar el build de
producción (el único en el que se registra el service worker):

```bash
npm run build
npm run start
```

### Estructura del código

La regla que lo ordena todo: `src/sim` es el núcleo de la simulación, puro y
determinista, y no puede importar Phaser, React ni Next ni tocar `window`,
`document` o `performance` (lo vigila `scripts/comprobar-frontera-nucleo.mjs`).
Así un test de Node sobre el núcleo prueba lo mismo que ve el jugador, y el
mismo código corre en el hilo principal y en el Worker de simulación. Todo
el azar del núcleo sale de la semilla que vive en el estado
(`src/sim/aleatorio.ts`), nunca de `Math.random`.

| Carpeta | Qué hay |
| --- | --- |
| `src/app` | rutas de Next (App Router): la página del juego, el manifiesto, el service worker (`sw.ts`, `serwist/`) y las páginas de prueba bajo `pruebas/` que usan los e2e |
| `src/sim/partida` | el motor de turnos: `avanzar()` toma estado + entrada y devuelve el estado siguiente y sus eventos |
| `src/sim/{armas,balistica,fisica,gravedad}` | catálogo de armas (datos, sin ramas por arma), resolución del disparo, vuelo del proyectil y gravedad de N cuerpos |
| `src/sim/{terreno,sistema,naves,universo}` | máscara de terreno destructible, generación del sistema planetario, colocación y daño de naves, eventos del universo |
| `src/sim/{ia,economia,equipo}` | rivales de IA (solo proponen una entrada de turno; ver `scripts/comprobar-frontera-ia.mjs`), precios y saldo, escudos y propulsores |
| `src/juego/motor` | el Worker de simulación y su protocolo de mensajes (solo datos planos) |
| `src/juego/escenas` | la escena de Phaser de la partida real (`Partida.ts`) |
| `src/juego/scenes` | escenas de andamiaje para las páginas de prueba (`Sandbox`, `Siluetas`), no la partida |
| `src/juego/control` | stores que conectan la escena de Phaser con el HUD de React |
| `src/juego/hud` | componentes React superpuestos al lienzo |
| `src/juego/*` (resto) | render, cámara, audio, efectos, PWA, partida guardada y medición de rendimiento |
| `src/contenido` | textos del juego: bromas, reacciones, voces, resúmenes, y el lector de `no-copiar.md` con el que los tests comprueban que ningún texto copia nombres ajenos |
| `src/debug/tipos.ts` | el tipo de `window.__debug`, los ganchos que usan los e2e |
| `tests/unit`, `tests/e2e`, `tests/smoke`, `tests/utils` | `node:test` sobre el núcleo, Playwright contra el build de producción, smoke de traspaso y utilidades compartidas |
| `scripts/` | guardas de arquitectura (`comprobar-*.mjs`) y mediciones (`medir-*.ts`, `calibrar-economia.ts`) |
| `docs/` | catálogo de armas, calibración de la economía, rendimiento e informes |

### Variables de entorno

El juego no necesita ninguna para arrancar. Las que el código lee hoy:

| Variable | Dónde | Para qué |
| --- | --- | --- |
| `VERCEL_GIT_COMMIT_SHA` | build (`next.config.ts`) | revisión del build; sin ella se usa `git rev-parse HEAD` y, sin git, un identificador aleatorio |
| `NEXT_PUBLIC_VERSION_APP` | la fija `next.config.ts` | versión que enseña Ajustes y que versiona el precache; no hay que ponerla a mano |
| `BASE_URL` | Playwright (`tests/origen.ts`) | apunta los tests a una URL ya desplegada en vez de levantar `npm run start`; sin ella, el origen local es `http://127.0.0.1:3000`. El localStorage que siembran los tests usa el origen que salga de aquí |
| `URL_OBJETIVO` | `scripts/smoke-traspaso.sh` | despliegue contra el que corre `npm run smoke:traspaso`; sin ella, construye si hace falta y arranca el juego en local |
| `CI` | Playwright | activa un reintento por test |
| `SEMILLAS_EVT_1` | `tests/unit/universo-eventos.test.ts` | semillas del test de propiedades del calendario (evt-1); sin ella, las del CI |
| `PRUEBA_LARGA` | tests y scripts | con `1`, muestra completa en los tests estadísticos y en `medir:eventos` / `calibrar:economia` |
| `CAPTURAS_DIR`, `RUTA_CAPTURA` | e2e | carpeta o fichero donde guardar capturas; sin ellas no se guardan |
| `COMPROBAR_PUBLICO_PATRONES` | `scripts/comprobar-publico.mjs`, `tests/unit/documentacion/ms-4.test.ts` | patrones privados que buscan esa comprobación y el test de ms-4 sobre el README; llega del CI (secret de Actions). Sin ella el script falla; el test falla con `CI` puesta y, en local, se salta |

## Comprobaciones

```bash
npm run lint                          # ESLint
npm run typecheck                     # tsc --noEmit en modo estricto
npm run build                         # build de producción
npm run verificar:presupuesto-bundle  # JS del primer arranque <= 1.3MB gzip
npm run verificar:activos             # sin activos binarios ni URLs externas (ver ACTIVOS.md)
npm run test:unit                     # núcleo de simulación, sin navegador
PRUEBA_LARGA=1 npm run test:unit      # ídem, con la muestra completa de los tests estadísticos
npm run test:eventos-1000             # solo el test de propiedades del calendario (evt-1), con 1000 semillas
npm run test:e2e                      # Playwright; levanta npm run start, así que pide npm run build antes
npm run smoke:traspaso                # smoke de tests/smoke/traspaso.spec.ts, en local o contra URL_OBJETIVO
npm run calibrar:economia             # recalibra precios y saldo, regenera docs/calibracion-economia.md
npm run medir:eventos                 # calendario de eventos sobre muchas semillas
```

Además, el CI pasa las guardas de arquitectura de `scripts/comprobar-*.mjs`.
Son búsquedas mecánicas sobre el código, sin navegador, y se pueden lanzar
en local una a una (`node scripts/comprobar-frontera-nucleo.mjs`). Cada script
explica en su cabecera qué regla protege y por qué; entre ellas: el núcleo no
toca el navegador ni `Math.random`, la IA no escribe terreno, la gravedad solo
tira de los proyectiles, el resolver no ramifica por id de arma y ningún
efecto visual nace sin su techo en `registroEfectos.ts`.
`comprobar-publico.mjs` necesita `COMPROBAR_PUBLICO_PATRONES` y sin ella
falla. El test de ms-4 lee esos mismos patrones para comprobar que el README
no menciona la infraestructura: en el CI le llegan a los shards de
`test-unit` y, sin ellos, falla; en local, sin la variable, `npm run
test:unit` lo da por saltado.

`culori` es solo una dependencia de desarrollo: la usa el test de la paleta
de asientos para simular el daltonismo y medir el contraste, y no llega al
juego.

Los e2e bloquean los service workers, salvo `tests/e2e/pwa-sin-conexion.e2e.ts`,
para que ninguna prueba juzgue algo servido desde la caché.

Para depurar, `window.__debug` expone ganchos de la partida. Entre ellos,
`__debug.calculosPrevisualizacion` cuenta cuántas veces se ha pedido la mira
al Worker, y `__debug.forzarMiraOculta(true)` la oculta por el mismo camino
que un cálculo demasiado caro, sin reintento automático, hasta llamar a
`__debug.forzarMiraOculta(false)`. `__debug.pwa` da el estado del service
worker y la versión.

El CI (`.github/workflows/ci.yml`) ejecuta todas estas comprobaciones en
cada push y cada pull request. Los tests estadísticos largos (ia-n*, arm-6,
partida-3, nav-3, nucleo-4...) corren ahí con una muestra reducida
(`tests/utils/muestra.ts`); la batería completa (`PRUEBA_LARGA=1`) corre cada
noche en `.github/workflows/pruebas-largas.yml`. El test de propiedades del
calendario (evt-1) corre en el CI con pocas semillas; para pasarlo con 1000
(varios minutos), `npm run test:eventos-1000` en local o, sin máquina propia,
el workflow «Pruebas a demanda» con `tipo` = `unit`, `specs` =
`tests/unit/universo-eventos.test.ts` y `semillas_evt_1` = `1000`. La partida completa
(`tests/e2e/partida-completa.e2e.ts`: de la portada al final en 360x640,
820x1180 y 1180x820 con CPU ×4, comprobando que cada toque responde en 200 ms
o menos) va en su propio job, `e2e-partida-completa`, uno por tamaño de
pantalla; sus capturas y su tabla de respuesta se suben como artefacto del
CI.

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
- **Racimo de Tuppers** (#191): se abre en tres perdigones en fila, a 70 u entre
  sí, y cada nave recibe solo el daño del más fuerte.
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
- **Doce armas** (#217): se retiran Mortero, Petardo y Granada (los motivos
  están en `docs/catalogo-armas.md`) y la economía se recalibra para el
  catálogo final, con un saldo fijo de 600 créditos. Si había un arma guardada
  que ya no existe, se sustituye por la de por defecto.
- **Apuntado con el dedo** (#220, #226): se apoya el dedo en cualquier punto y
  se desliza; el movimiento perpendicular gira el tiro y el radial cambia la
  fuerza. Una flecha con «grados · fuerza» sale de la nave. Los ejes se fijan
  al apoyar el dedo, y el resultado ya no depende de cuántos eventos táctiles
  entregue el dispositivo.
- **Inicio y pestañas** (#221, #223, #225): «Jugar» y «Música» están siempre a
  la vista, sin desplazarse. Las pestañas de jugador quitan los títulos antes
  de cortar el nombre. El inicio explica el gesto nuevo.
- **Avisos con sitio propio** (#227): la reacción, la ayuda de apuntado y el
  aviso de «sin voz» pasan a la capa de avisos, bajo la franja de interruptores
  y con fondo opaco. Antes el aviso de voz salía en 11 px y sin fondo, tapado por
  otros textos, y el rótulo de la deriva cruzaba el interruptor «Voz».
- **Rótulo de la deriva** (#245): en las partidas espaciales, «Vacío…» se
  desvanece a los 4 s y deja de tapar planetas.
- **Menú de ajustes** (#246): un único botón ⚙ arriba a la derecha reúne
  Histórico, Sacudida, Sonido, Música y Voz, que salen de la consola.
- **Jugar sin conexión** (#247, #248): service worker de Serwist, aviso de
  versión nueva con «Recargar» y «Luego», estado y versión en Ajustes, y
  `?sw=0` para desinstalarlo. El estado pasa a «Lista para jugar sin
  conexión» también al recargar con el worker ya activo.
- **Textos** (#249): segunda persona cuando solo juega un humano, nombre corto
  de los rivales en los resúmenes, «Gratis» una sola vez en la ficha del arma
  y ayuda del gesto con el mismo sentido que la portada.
- **Avisos sin solapes** (#252): un solo «¡Perdido!» a la vez, que baja si el
  aviso de versión nueva ocupa arriba; en la portada ese aviso no tapa
  «Música», y el histórico queda por encima de la ayuda de apuntado.
- **Mira oculta** (#258): la mira oculta por presupuesto de cómputo ya no se
  recalcula con cada movimiento; se reintenta una vez a los 1,5 s. Ganchos
  `__debug.calculosPrevisualizacion` y `__debug.forzarMiraOculta`.
- **Rastro del último disparo** (#259): trayectoria a guiones del último tiro
  con la silueta en el impacto, interruptor «Rastro» en Ajustes y su latencia
  en `?rendimiento=1`.
- **Remate del golpe decisivo** (#260): destello, pausa y acercamiento de
  cámara al destruir una nave; con movimiento reducido o «Sacudida» apagada,
  solo el destello.
- **Nivel de la IA** (#262): Fácil, Normal o Difícil en la portada, para todos
  los rivales; se recuerda entre sesiones y se ve en la barra de cada rival.
- **Paleta para daltonismo** (#269): colores de asiento medidos con
  protanopía, deuteranopía y tritanopía; el azul y el lila se retocan. `culori`
  entra solo como dependencia de desarrollo.
- **Reloj de turno** (#270): Off, 30, 45 o 60 s por turno humano, elegido en
  la portada; al agotarse dispara solo lo que haya en la mira.
- **Marca del asiento** (#271, #277, #278): mini-silueta del asiento en las
  pestañas de vida y en el número de daño; con cuatro naves la pestaña no
  corta el nombre y el turno se marca con una sombra interior.
- **Partida guardada** (#272, #275, #276): se guarda al cerrar cada turno y al
  ocultar la página; la portada ofrece continuar la partida interrumpida o
  descartarla, y avisa si no se puede guardar.
- **Movimiento de naves y propulsores** (#284, #319): el tirador no se
  desplaza con su propio tiro, el Gravitón solo empuja si alcanza y los
  propulsores salen de la superficie. Por debajo de 12 u contra un obstáculo
  quedan bloqueados (ruta roja y botón deshabilitado); si el vuelo no supera el
  largo de la nave, solo se avisa de «Vuelo corto».
- **Respuesta al disparo** (#285, #294, #295): el proyectil sale y el impacto
  se anima mientras el trabajador cierra el turno; el fogonazo se pinta en el
  toque, el service worker no sirve del precache el arranque del trabajador y
  un cierre de turno largo no da al trabajador por mudo.
- **Objetos y minirobot visibles** (#286, #296, #299): los objetos de evento y
  su aplicación se ven en pantalla; la detonación del minirobot tiene destello,
  partículas y número propios, y el bocadillo cuenta su daño aunque el tiro
  falle o se pierda.
- **Premios en el parte de guerra** (#287, #288): estadísticas por asiento y
  una tarjeta de premios en el parte de guerra.
- **Música con tensión** (#289): la música gana percusión y bajo a medida que
  la partida se aprieta.
- **Apuntado de 360°** (#290): el dedo gira alrededor de la nave y la flecha
  lo sigue en toda la vuelta.
- **Trayectoria corta en pantalla** (#291, #300, #301, #318, #320): la mira se
  mide sobre el lado mayor de la pantalla con un abanico de dos tramos; el
  abanico ancho se pinta en tiras entre nueve trayectorias aunque sus bordes
  choquen pronto.
- **Cámara con gestos** (#293): zoom y desplazamiento con dos dedos o con la
  rueda, botón «Ver todo» y seguimiento del proyectil.
- **Consola y etiquetas** (#283, #298, #316, #317): la consola plegada también
  se puede ocultar; el arma de la barra mínima va sobre fondo opaco para leerse
  sobre cualquier fondo; las etiquetas de un impacto a quemarropa se apartan
  en vez de pisarse.
- **Pruebas y guardias** (#297, #322, #323, #324): `forzarFinDePartida` cierra
  también partidas de cuatro asientos; `npm run test:eventos-1000` lanza evt-1
  con 1000 semillas; el origen local de los tests sale de `BASE_URL` en un
  único sitio; los guardias de `scripts/` comprueban su caso negativo sin
  escribir en `src/`.
- **Documentación al día** (#325, #326, #372): el README cuenta el aviso de
  vuelo corto, el origen local de los tests y `npm run smoke:traspaso`;
  `DISTANCIA_MINIMA_PROPULSORES` pierde el sufijo `_PX` porque mide unidades
  del mundo; `tests/unit/readme-rutas.test.ts` falla si el README cita una
  ruta de `src/`, `tests/`, `docs/` o `scripts/` que ya no existe.
- **Pantalla encendida** (#327): durante la partida se pide al navegador que
  no apague ni atenúe la pantalla (Screen Wake Lock); se suelta al salir el
  parte de guerra, y donde no se admite el juego sigue igual, sin avisos.
- **Anuncios para lectores de pantalla** (#328): una región `aria-live`
  invisible anuncia el cambio de turno, «¡Tiempo! Disparo automático» y el
  ganador.
- **Contraste y tamaño mínimo** (#329, #331, #333): todo texto HTML del HUD
  mide 14 px o más y sus colores llegan a 4,5:1 (WCAG AA). El parte de guerra
  va sobre panel opaco y por encima del resto del HUD, con las cifras de cada
  asiento en filas en vez de una tabla cortada, y se quita en el mismo clic de
  «Otra partida»; la marca del asiento va junto al nombre en todas las
  pestañas.
- **Texto grande** (#330, #332, #334, #339, #356): interruptor en Ajustes que
  agranda un 30 % los textos HTML del HUD, al momento y recordado entre
  visitas. Con él, las pestañas de vida no cortan el nombre (dos columnas con
  tres o cuatro naves, fila propia en el 1 contra 1), la píldora del reloj no
  pisa el nombre, la ayuda inicial se desplaza si no cabe y la consola puede
  ocupar todo el alto menos 64 px para que «Disparar» siga en pantalla.
- **Medir en el dispositivo** (#346, #349, #350, #354): con `?rendimiento=1`,
  el botón «Medir» juega solo una partida aparte de cinco tramos y copia al
  portapapeles un resumen para pegar en un issue. El tope de 150 s cuenta
  desde que la partida pinta, los disparos los elige el simulador para que
  detonen y los frames se miden con el intervalo real de rAF.
- **Cámara que esquiva el HUD** (#347, #348, #351): si la consola u otro
  elemento del HUD taparía una nave, el proyectil o el impacto, la cámara
  encuadra ese grupo en el hueco libre; con la vista alejada, lo de fuera del
  mundo se ve con estrellas, y el remate vuelve al encuadre de antes.
  `__debug.zonasCamara()` da las zonas y el rectángulo libre.
- **Avisos fuera de las naves** (#352, #353, #355, #357): la ayuda del
  apuntado (y con «Texto grande» también la de la cámara) vive en la zona de
  la consola, y el resto de avisos va arriba o encima de la consola, donde no
  pise ninguna nave. El aviso de precisión ya no empuja «Disparar» fuera de la
  pantalla y se retira al bajar la potencia; un test exige que «¡Perdido!» se
  lea.
- **Barras de ángulo y potencia con el dedo** (#373): un gesto que empieza en
  la fila del ángulo o de la potencia ya no arranca el arrastre doble de la
  consola, así que ajustar el ángulo no mueve la potencia; las barras ocupan
  todo el alto de su fila.
- **Vibración** (#374, #375): en el móvil, un pulso corto al disparar, uno
  doble al alcanzar una nave y uno más largo al destruirla; se apaga sola con
  «reducir movimiento». Interruptor «Vibración» en Ajustes, solo si el
  dispositivo táctil tiene la API de vibración, con un pulso de prueba al
  pasar a On.
- **Vibración por daño** (#376): la vibración de impacto sigue al daño, así que
  una detonación junto a la nave que le hace daño sin tocar su silueta también
  vibra.
- **Ajustes en tableta apaisada** (#377): en pantallas anchas y bajas el panel
  de Ajustes va en dos columnas y se ve entero, con «Cerrar» dentro.
- **Patrones de ms-4 fuera del repo** (#381): el test de ms-4 ya no lleva en
  claro los términos que el README no puede mencionar; los lee de
  `COMPROBAR_PUBLICO_PATRONES`, el mismo secret que `scripts/comprobar-publico.mjs`,
  que el CI pasa ahora también a `test-unit`.
- **Píxeles destruidos de todo el mundo** (#383): el recuento de píxeles
  arrancados (`contarPixelesDestruidos`, `src/sim/terreno/estadisticas.ts`)
  cuenta toda celda con material que queda en aire, no solo las de valor
  `SOLIDO`: vaciar cualquier planeta o un anillo de escombro suma ya al premio
  «Topo Espacial» y al «Mérito Geológico» del parte de guerra. Tapar un
  material con otro (Vertedero Portátil) no cuenta.
