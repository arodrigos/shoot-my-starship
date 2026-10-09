# Calibración de la economía

Regenerado por `npm run calibrar:economia`. No a mano: los números salen de
`tests/utils/calibrarEconomia.ts`, el mismo cálculo que vigilan
`tests/unit/economia/calibrado.test.ts` y `parametros.ts`.

## Parámetros

- Mediana de los precios de las armas de pago con daño (M): **62.5 cr**
- `PRESUPUESTO_BASE` fijo, sin arrastre entre partidas: **600 cr**
- `PREMIO_LOTERIA` fijo: **150 cr**
- Equipo (sin cambios por la calibración): Escudo 90 cr, Propulsores 60 cr

## Precios frente a la curva daño × facilidad

La facilidad es la de `docs/facilidad-armas.md`. «Valor» es el daño esperado
por crédito (daño máximo × facilidad / coste) dividido por su mediana: la banda
sana es [0.6; 1.6].

| Arma | Coste | Daño máx. | Facilidad | Curva | Desviación | Valor |
| --- | --- | --- | --- | --- | --- | --- |
| Pepinazo de Cortesía | 40 | 18 | 2.4 % | 40 | 0 % | 0.80 |
| Mortero Lamentable | 50 | 24 | 2.5 % | 50 | 0 % | 0.88 |
| Racimo de Tuppers | 45 | 20 | 2.5 % | 45 | 0 % | 0.82 |
| Despedida | 90 | 55 | 3.2 % | 90 | 0 % | 1.44 |
| Barrena Planetaria | 70 | 44 | 2.3 % | 70 | 0 % | 1.07 |
| Rayo Láser | 85 | 46 | 0.9 % | 60 | 42 % | 0.36 |
| Mosca Cojonera | 55 | 28 | 2.8 % | 55 | 0 % | 1.05 |
| Granada de Espoleta | 60 | 34 | 2.4 % | 60 | 0 % | 1.00 |
| Gancho Pegajoso | 90 | 24 | 7.9 % | 90 | 0 % | 1.55 |
| Minirobot Saltaplanetas | 65 | 40 | 2.2 % | 65 | 0 % | 1.00 |

### Desviaciones declaradas

- **Rayo Láser** (`rayo-laser`): Haz instantáneo inmune a la gravedad: la facilidad medida (1,2 %) subestima lo que paga el que no tiene que calcular la curva, así que el precio se queda cerca del máximo y su daño por crédito cae por debajo de la banda.

## Compras por estrategia (saldo inicial 600 cr, sin lotería)

| Comprador | Compras de arma de pago |
| --- | --- |
| Medio (la de precio más cercano a M) | 10 |
| Caro (la más cara asequible, Despedida una vez) | 7 |
| Barato (la de pago más barata) | 15 |
| Medio con dos escudos pagados | 7 |

## Partidas de 3 IAs con la misma puntería (5 semillas maestras × 4 partidas)

Cada perfil de gasto juega con la puntería de Almirante Bisagra, los asientos
rotan por semilla y están activos el universo, la muerte súbita y el equipo.

| Semilla maestra | Perfil | Victorias (partidas con ganador) | Turno propio medio en que no llega ni a la más barata | Sin saldo en su 8.º turno | Paga en la ronda 10 |
| --- | --- | --- | --- | --- | --- |
| 2024 | ahorrador | 1/2 (50 %) | 14.0 | 0/4 | 3/4 (75 %) |
| 2024 | agresivo | 0/2 (0 %) | no se queda sin saldo | 0/3 | 3/3 (100 %) |
| 2024 | mixto | 1/2 (50 %) | no se queda sin saldo | 0/4 | 3/4 (75 %) |
| 2028 | ahorrador | 1/3 (33 %) | 13.0 | 0/4 | 4/4 (100 %) |
| 2028 | agresivo | 0/3 (0 %) | no se queda sin saldo | 0/4 | 3/3 (100 %) |
| 2028 | mixto | 2/3 (67 %) | no se queda sin saldo | 0/3 | 3/3 (100 %) |
| 3031 | ahorrador | 0/2 (0 %) | 13.0 | 0/3 | 1/2 (50 %) |
| 3031 | agresivo | 1/2 (50 %) | 12.0 | 0/3 | 3/3 (100 %) |
| 3031 | mixto | 1/2 (50 %) | no se queda sin saldo | 0/4 | 4/4 (100 %) |
| 4057 | ahorrador | 1/4 (25 %) | 13.0 | 0/4 | 4/4 (100 %) |
| 4057 | agresivo | 2/4 (50 %) | 12.0 | 0/4 | 3/3 (100 %) |
| 4057 | mixto | 1/4 (25 %) | no se queda sin saldo | 0/3 | 1/3 (33 %) |
| 5099 | ahorrador | 2/3 (67 %) | 14.0 | 0/3 | 2/2 (100 %) |
| 5099 | agresivo | 0/3 (0 %) | 12.0 | 0/2 | 2/2 (100 %) |
| 5099 | mixto | 1/3 (33 %) | no se queda sin saldo | 0/2 | 0/0 (n/a) |

### Bandas de cal-6a con estas semillas

- FUERA DE BANDA: ahorrador: gana entre el 20 % y el 45 % en 2 de 5 semillas (mínimo 4; 50 %, 33 %, 0 %, 25 %, 67 %)
- FUERA DE BANDA: ahorrador: ninguna semilla pasa del 50 % (máximo 67 %)
- FUERA DE BANDA: agresivo: gana entre el 20 % y el 45 % en 0 de 5 semillas (mínimo 4; 0 %, 0 %, 50 %, 50 %, 0 %)
- CUMPLE: agresivo: ninguna semilla pasa del 50 % (máximo 50 %)
- FUERA DE BANDA: mixto: gana entre el 20 % y el 45 % en 2 de 5 semillas (mínimo 4; 50 %, 67 %, 50 %, 25 %, 33 %)
- FUERA DE BANDA: mixto: ninguna semilla pasa del 50 % (máximo 67 %)
- CUMPLE: ahorrador: dispara de pago en la ronda 10 en ≥ 70 % de las partidas que llegan (88 %)

Con pocas partidas por semilla cada tasa es muy gruesa (una victoria más o
menos mueve decenas de puntos): la comprobación que manda es la de
`PRUEBA_LARGA=1 npm run calibrar:economia -- --partidas 40`.
