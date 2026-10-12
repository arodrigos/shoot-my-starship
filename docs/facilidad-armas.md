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
| Pepinazo de Cortesía | 18 | 55 | 1.05s | 2.6% | 35 |
| Zanjadora Manolita | 4 | 56 | 1.07s | 2.5% | 0 |
| Vertedero Portátil | 0 | 0 | n/a | 0.0% | 15 |
| Racimo de Tuppers | 20 | 30 | 1.03s | 2.5% | 40 |
| La Pelota de Chatarra | 8 | 30 | 1.08s | 2.4% | 0 |
| Gravitón de Segunda Mano | 0 | 0 | n/a | 0.0% | 45 |
| Despedida | 55 | 115 | 0.99s | 3.3% | 80 |
| Barrena Planetaria | 44 | 38 | 1.10s | 2.5% | 65 |
| Rayo Láser | 46 | 80 | 0.57s | 0.8% | 80 |
| Mosca Cojonera | 28 | 50 | 1.06s | 2.9% | 50 |
| Gancho Pegajoso | 24 | 38 | 0.93s | 6.9% | 75 |
| Minirobot Saltaplanetas | 40 | 50 | 1.09s | 2.4% | 60 |

## Dominancia

Un arma domina a otra cuando iguala o supera su daño y su facilidad con igual
o menor coste -- la combinación que convertiría el reprecio (bloque
`armas-reprecio-roles`) en cosmético si no se corrige.

Ninguna encontrada en esta medición.
