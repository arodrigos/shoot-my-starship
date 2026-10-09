# Calibración de la economía

Regenerado por `npm run calibrar:economia`. No a mano: los números salen de
`tests/utils/calibrarEconomia.ts`, el mismo cálculo que vigilan
`tests/unit/economia/calibrado.test.ts` y `parametros.ts`.

## Parámetros

- Mediana de los precios de las armas de pago con daño (M): **57.5 cr**
- `PRESUPUESTO_BASE` fijo, sin arrastre entre partidas: **600 cr**
- `PREMIO_LOTERIA` fijo: **150 cr**
- Equipo (sin cambios por la calibración): Escudo 90 cr, Propulsores 60 cr

## Precios frente a la curva daño × facilidad

La facilidad es la de `docs/facilidad-armas.md`. «Valor» es el daño esperado
por crédito (daño máximo × facilidad / coste) dividido por su mediana: la banda
sana es [0.6; 1.6].

| Arma | Coste | Daño máx. | Facilidad | Curva | Desviación | Valor |
| --- | --- | --- | --- | --- | --- | --- |
| Pepinazo de Cortesía | 35 | 18 | 2.2 % | 35 | 0 % | 0.86 |
| Mortero Lamentable | 45 | 24 | 2.4 % | 45 | 0 % | 0.98 |
| Racimo de Tuppers | 40 | 20 | 2.4 % | 40 | 0 % | 0.92 |
| Despedida | 85 | 55 | 2.9 % | 85 | 0 % | 1.43 |
| Barrena Planetaria | 65 | 44 | 2.0 % | 65 | 0 % | 1.03 |
| Rayo Láser | 85 | 46 | 1.1 % | 60 | 42 % | 0.45 |
| Mosca Cojonera | 50 | 28 | 2.3 % | 50 | 0 % | 0.98 |
| Granada de Espoleta | 55 | 34 | 2.3 % | 55 | 0 % | 1.08 |
| Gancho Pegajoso | 90 | 24 | 8.1 % | 90 | 0 % | 1.65 |
| Minirobot Saltaplanetas | 60 | 40 | 2.0 % | 60 | 0 % | 1.02 |

### Desviaciones declaradas

- **Rayo Láser** (`rayo-laser`): Haz instantáneo inmune a la gravedad: la facilidad medida (1,2 %) subestima lo que paga el que no tiene que calcular la curva, así que el precio se queda cerca del máximo y su daño por crédito cae por debajo de la banda.
- **Gancho Pegajoso** (`gancho-pegajoso`): Se pega a un planeta o a una nave y su onda de 1/8 de diagonal la hace la más fácil del catálogo (8,1 %): su daño por crédito queda por encima de la banda y subir más el precio lo pondría por encima de la Despedida.

## Compras por estrategia (saldo inicial 600 cr, sin lotería)

| Comprador | Compras de arma de pago |
| --- | --- |
| Medio (la de precio más cercano a M) | 10 |
| Caro (la más cara asequible, Despedida una vez) | 7 |
| Barato (la de pago más barata) | 17 |
| Medio con dos escudos pagados | 7 |

## Partidas de 3 IAs con la misma puntería (5 semillas maestras × 4 partidas)

Cada perfil de gasto juega con la puntería de Almirante Bisagra, los asientos
rotan por semilla y están activos el universo, la muerte súbita y el equipo.

| Semilla maestra | Perfil | Victorias (partidas con ganador) | Turno propio medio en que no llega ni a la más barata | Sin saldo en su 8.º turno | Paga en la ronda 10 |
| --- | --- | --- | --- | --- | --- |
| 2024 | ahorrador | 0/3 (0 %) | 14.0 | 0/3 | 3/3 (100 %) |
| 2024 | agresivo | 0/3 (0 %) | no se queda sin saldo | 0/3 | 3/3 (100 %) |
| 2024 | mixto | 3/3 (100 %) | no se queda sin saldo | 0/4 | 3/4 (75 %) |
| 2028 | ahorrador | 2/3 (67 %) | 13.0 | 0/4 | 3/3 (100 %) |
| 2028 | agresivo | 0/3 (0 %) | no se queda sin saldo | 0/4 | 2/2 (100 %) |
| 2028 | mixto | 1/3 (33 %) | no se queda sin saldo | 0/3 | 3/3 (100 %) |
| 3031 | ahorrador | 0/2 (0 %) | 13.0 | 0/3 | 2/2 (100 %) |
| 3031 | agresivo | 0/2 (0 %) | 13.0 | 0/3 | 3/3 (100 %) |
| 3031 | mixto | 2/2 (100 %) | no se queda sin saldo | 0/4 | 4/4 (100 %) |
| 4057 | ahorrador | 1/4 (25 %) | 13.0 | 0/4 | 4/4 (100 %) |
| 4057 | agresivo | 2/4 (50 %) | 13.0 | 0/4 | 3/3 (100 %) |
| 4057 | mixto | 1/4 (25 %) | no se queda sin saldo | 0/3 | 1/3 (33 %) |
| 5099 | ahorrador | 3/4 (75 %) | no se queda sin saldo | 0/4 | 2/2 (100 %) |
| 5099 | agresivo | 1/4 (25 %) | no se queda sin saldo | 0/3 | 1/1 (100 %) |
| 5099 | mixto | 0/4 (0 %) | no se queda sin saldo | 0/2 | 0/1 (0 %) |

### Bandas de cal-6a con estas semillas

- FUERA DE BANDA: ahorrador: gana entre el 20 % y el 45 % en 1 de 5 semillas (mínimo 4; 0 %, 67 %, 0 %, 25 %, 75 %)
- FUERA DE BANDA: ahorrador: ninguna semilla pasa del 50 % (máximo 75 %)
- FUERA DE BANDA: agresivo: gana entre el 20 % y el 45 % en 1 de 5 semillas (mínimo 4; 0 %, 0 %, 0 %, 50 %, 25 %)
- CUMPLE: agresivo: ninguna semilla pasa del 50 % (máximo 50 %)
- FUERA DE BANDA: mixto: gana entre el 20 % y el 45 % en 2 de 5 semillas (mínimo 4; 100 %, 33 %, 100 %, 25 %, 0 %)
- FUERA DE BANDA: mixto: ninguna semilla pasa del 50 % (máximo 100 %)
- CUMPLE: ahorrador: dispara de pago en la ronda 10 en ≥ 70 % de las partidas que llegan (100 %)

Con pocas partidas por semilla cada tasa es muy gruesa (una victoria más o
menos mueve decenas de puntos): la comprobación que manda es la de
`PRUEBA_LARGA=1 npm run calibrar:economia -- --partidas 40`.
