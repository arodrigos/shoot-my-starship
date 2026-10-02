# Facilidad de acierto por arma

Regenerado por `npm run medir:armas` (`armas-metrica`). No a mano: estos
números salen de `facilidadDeAcierto`, que barre toda la rejilla
ángulo x potencia con el resolutor de vuelo real sobre 20 escenarios
sembrados (`tests/utils/medirArmas.ts`). El mismo cálculo lo vigila
`tests/unit/armas/armas-metrica.test.ts`: si este informe cambia, es porque
el test ya lo detectó primero.

La facilidad es la fracción de esas combinaciones que causan daño real sobre
la nave objetivo -- un radio de efecto mayor o una dispersión angular que
sigue impactando suben este número por sí solos, sin ninguna ponderación
aparte que mantener sincronizada con el resolutor.

## Catálogo

| Arma | Daño máx. | Radio de efecto (px) | Tiempo de vuelo medio | Facilidad medida | Coste |
| --- | --- | --- | --- | --- | --- |
| Pepinazo de Cortesía | 20 | 70 | 1.08s | 2.5% | 0 |
| Tostadora Orbital | 30 | 50 | 1.08s | 2.5% | 30 |
| Mortero Lamentable | 24 | 65 | 1.08s | 2.5% | 40 |
| Zanjadora Manolita | 4 | 30 | 1.08s | 2.5% | 0 |
| Vertedero Portátil | 0 | 0 | n/a | 0.0% | 20 |
| Racimo de Tuppers | 11 | 42 | 0.83s | 5.1% | 50 |
| Petardo de Feria | 22 | 60 | 1.05s | 2.0% | 0 |
| La Pelota de Chatarra | 18 | 55 | 1.08s | 2.5% | 35 |
| Gravitón de Segunda Mano | 0 | 0 | n/a | 0.0% | 45 |
| Despedida | 60 | 130 | 1.08s | 3.0% | 80 |
| Andanada de Flechas | 14 | 40 | 1.51s | 6.7% | 55 |
| Barrena Planetaria | 26 | 45 | 1.05s | 2.6% | 90 |
| Rayo Láser | 28 | 55 | 0.50s | 1.3% | 120 |
| Mosca Cojonera | 16 | 45 | 1.10s | 2.9% | 40 |
| Granada de Espoleta | 24 | 60 | 1.08s | 2.5% | 45 |
| Gancho Pegajoso | 26 | 52 | 1.08s | 2.5% | 50 |

## Dominancia

Un arma domina a otra cuando iguala o supera su daño y su facilidad con igual
o menor coste -- la combinación que convertiría el reprecio (bloque
`armas-reprecio-roles`) en cosmético si no se corrige.

- **pepinazo-cortesia** domina a **zanjadora-manolita** (igual o más daño, igual o más facilidad, igual o menos coste).
- **pepinazo-cortesia** domina a **vertedero-portatil** (igual o más daño, igual o más facilidad, igual o menos coste).
- **pepinazo-cortesia** domina a **pelota-de-chatarra** (igual o más daño, igual o más facilidad, igual o menos coste).
- **pepinazo-cortesia** domina a **graviton-segunda-mano** (igual o más daño, igual o más facilidad, igual o menos coste).
- **tostadora-orbital** domina a **mortero-lamentable** (igual o más daño, igual o más facilidad, igual o menos coste).
- **tostadora-orbital** domina a **pelota-de-chatarra** (igual o más daño, igual o más facilidad, igual o menos coste).
- **tostadora-orbital** domina a **graviton-segunda-mano** (igual o más daño, igual o más facilidad, igual o menos coste).
- **tostadora-orbital** domina a **rayo-laser** (igual o más daño, igual o más facilidad, igual o menos coste).
- **tostadora-orbital** domina a **granada-de-espoleta** (igual o más daño, igual o más facilidad, igual o menos coste).
- **tostadora-orbital** domina a **gancho-pegajoso** (igual o más daño, igual o más facilidad, igual o menos coste).
- **mortero-lamentable** domina a **graviton-segunda-mano** (igual o más daño, igual o más facilidad, igual o menos coste).
- **mortero-lamentable** domina a **granada-de-espoleta** (igual o más daño, igual o más facilidad, igual o menos coste).
- **zanjadora-manolita** domina a **vertedero-portatil** (igual o más daño, igual o más facilidad, igual o menos coste).
- **zanjadora-manolita** domina a **graviton-segunda-mano** (igual o más daño, igual o más facilidad, igual o menos coste).
- **vertedero-portatil** domina a **graviton-segunda-mano** (igual o más daño, igual o más facilidad, igual o menos coste).
- **petardo-de-feria** domina a **vertedero-portatil** (igual o más daño, igual o más facilidad, igual o menos coste).
- **petardo-de-feria** domina a **graviton-segunda-mano** (igual o más daño, igual o más facilidad, igual o menos coste).
- **pelota-de-chatarra** domina a **graviton-segunda-mano** (igual o más daño, igual o más facilidad, igual o menos coste).
- **despedida** domina a **barrena-planetaria** (igual o más daño, igual o más facilidad, igual o menos coste).
- **despedida** domina a **rayo-laser** (igual o más daño, igual o más facilidad, igual o menos coste).
- **mosca-cojonera** domina a **graviton-segunda-mano** (igual o más daño, igual o más facilidad, igual o menos coste).
- **granada-de-espoleta** domina a **graviton-segunda-mano** (igual o más daño, igual o más facilidad, igual o menos coste).
