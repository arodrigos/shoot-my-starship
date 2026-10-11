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
| Pepinazo de Cortesía | 18 | 55 | 1.00s | 2.2% | 35 |
| Mortero Lamentable | 24 | 70 | 0.97s | 2.4% | 45 |
| Zanjadora Manolita | 4 | 56 | 1.02s | 2.1% | 0 |
| Vertedero Portátil | 0 | 0 | n/a | 0.0% | 15 |
| Racimo de Tuppers | 20 | 30 | 0.98s | 2.1% | 40 |
| Petardo de Feria | 13 | 62 | 0.94s | 1.7% | 0 |
| La Pelota de Chatarra | 8 | 30 | 1.00s | 1.9% | 0 |
| Gravitón de Segunda Mano | 0 | 0 | n/a | 0.0% | 45 |
| Despedida | 55 | 115 | 0.92s | 2.9% | 85 |
| Barrena Planetaria | 44 | 38 | 0.99s | 2.0% | 65 |
| Rayo Láser | 46 | 80 | 0.46s | 1.1% | 80 |
| Mosca Cojonera | 28 | 50 | 0.93s | 2.3% | 50 |
| Granada de Espoleta | 34 | 62 | 0.99s | 2.3% | 55 |
| Gancho Pegajoso | 24 | 38 | 0.81s | 8.1% | 90 |
| Minirobot Saltaplanetas | 40 | 50 | 0.99s | 2.0% | 60 |

## Dominancia

Un arma domina a otra cuando iguala o supera su daño y su facilidad con igual
o menor coste -- la combinación que convertiría el reprecio (bloque
`armas-reprecio-roles`) en cosmético si no se corrige.

Ninguna encontrada en esta medición.
