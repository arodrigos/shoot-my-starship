# Shoot my starship

Artillería espacial por turnos: dos naves flotando entre los planetas de un
sistema generado por semilla, apuntando con la gravedad de esos mismos
planetas curvando el tiro. Terreno destructible, once armas, dos modos de
juego y un rival con mala idea. Next.js (App Router) + Phaser 4, 100%
cliente, sin cuenta y sin instalar nada.

## Cómo jugar

Desde la pantalla de inicio se elige rival y modo, y se pulsa "Jugar". Para
apuntar, se arrastra en la mitad inferior de la pantalla (arriba/abajo ajusta
el ángulo, izquierda/derecha ajusta la potencia) y se dispara con el botón
"Disparar". El proyectil vuela de verdad, curvado por la gravedad de los
planetas del sistema -- no hay una fórmula recta que corregir a ojo, hay que
sentir hacia dónde tira cada pozo.

### Los dos modos

- **Barra libre**: las once armas están disponibles desde el primer turno,
  sin coste. Pensado para probar el catálogo entero y la física de gravedad
  sin que el dinero sea una preocupación.
- **Con presupuesto**: se empieza con un saldo inicial de 1000 créditos
  (`SALDO_INICIAL`, `src/sim/partida/economia.ts`) y cada disparo cuesta
  créditos según el arma elegida; acertar ingresa créditos por el daño
  causado. El saldo vive solo en memoria de la pestaña: recargar la página lo
  devuelve al valor inicial, no se guarda ninguna partida a medio jugar.

### Las tres armas gratis

Tres de las once armas del catálogo (`src/sim/armas/catalogo.ts`) cuestan 0
créditos siempre, también en modo con presupuesto: **Pepinazo de Cortesía**,
**Zanjadora Manolita** y **Petardo de Feria**. El resto tiene un coste fijo
por disparo, independiente de si acierta o falla.

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
- Si el modo con presupuesto añade una decisión real (qué arma merece la
  pena por su coste) o solo fricción (un número que baja sin que cambie
  cómo se juega).
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
