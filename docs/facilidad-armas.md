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
| Pepinazo de Cortesía | 18 | 55 | 0.93s | 3.2% | 55 |
| Mortero Lamentable | 24 | 70 | 0.90s | 3.4% | 65 |
| Zanjadora Manolita | 4 | 56 | 0.95s | 2.6% | 0 |
| Vertedero Portátil | 0 | 0 | n/a | 0.0% | 15 |
| Racimo de Tuppers | 20 | 62 | 0.69s | 6.8% | 85 |
| Petardo de Feria | 13 | 62 | 0.95s | 2.2% | 0 |
| La Pelota de Chatarra | 8 | 30 | 0.98s | 2.4% | 0 |
| Gravitón de Segunda Mano | 0 | 0 | n/a | 0.0% | 45 |
| Despedida | 55 | 115 | 0.88s | 4.6% | 120 |
| Barrena Planetaria | 44 | 38 | 0.87s | 2.7% | 90 |
| Rayo Láser | 46 | 80 | 0.45s | 1.3% | 115 |
| Mosca Cojonera | 28 | 50 | 0.91s | 3.4% | 75 |
| Granada de Espoleta | 34 | 62 | 0.92s | 3.3% | 80 |
| Gancho Pegajoso | 24 | 38 | 1.03s | 9.4% | 115 |
| Minirobot Saltaplanetas | 40 | 50 | 0.88s | 2.6% | 85 |

## Dominancia

Un arma domina a otra cuando iguala o supera su daño y su facilidad con igual
o menor coste -- la combinación que convertiría el reprecio (bloque
`armas-reprecio-roles`) en cosmético si no se corrige.

Ninguna encontrada en esta medición.
