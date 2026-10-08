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
| Pepinazo de Cortesía | 18 | 55 | 1.31s | 2.4% | 55 |
| Mortero Lamentable | 24 | 70 | 1.27s | 2.5% | 65 |
| Zanjadora Manolita | 4 | 56 | 1.32s | 2.0% | 0 |
| Vertedero Portátil | 0 | 0 | n/a | 0.0% | 15 |
| Racimo de Tuppers | 20 | 62 | 1.27s | 2.5% | 60 |
| Petardo de Feria | 13 | 62 | 1.40s | 1.5% | 0 |
| La Pelota de Chatarra | 8 | 30 | 1.26s | 1.8% | 0 |
| Gravitón de Segunda Mano | 0 | 0 | n/a | 0.0% | 45 |
| Despedida | 55 | 115 | 1.16s | 3.2% | 125 |
| Barrena Planetaria | 44 | 38 | 1.28s | 2.3% | 90 |
| Rayo Láser | 46 | 80 | 0.49s | 0.9% | 115 |
| Mosca Cojonera | 28 | 50 | 1.25s | 2.8% | 75 |
| Granada de Espoleta | 34 | 62 | 1.30s | 2.4% | 80 |
| Gancho Pegajoso | 24 | 38 | 1.09s | 7.9% | 118 |
| Minirobot Saltaplanetas | 40 | 50 | 1.29s | 2.2% | 85 |

## Dominancia

Un arma domina a otra cuando iguala o supera su daño y su facilidad con igual
o menor coste -- la combinación que convertiría el reprecio (bloque
`armas-reprecio-roles`) en cosmético si no se corrige.

Ninguna encontrada en esta medición.
