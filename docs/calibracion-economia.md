# Calibración de la economía

Regenerado por `npm run calibrar:economia`. No a mano: los números salen de
`tests/utils/calibrarEconomia.ts`, el mismo cálculo que vigilan
`tests/unit/economia/calibrado.test.ts` y `parametros.ts`.

## Parámetros

- Mediana de los precios de las armas de pago con daño (M): **82.5 cr**
- `PRESUPUESTO_BASE` fijo, sin arrastre entre partidas: **600 cr**
- `PREMIO_LOTERIA` fijo: **150 cr**
- Equipo (sin cambios por la calibración): Escudo 90 cr, Propulsores 60 cr

## Precios frente a la curva daño × facilidad

La facilidad es la de `docs/facilidad-armas.md`. «Valor» es el daño esperado
por crédito (daño máximo × facilidad / coste) dividido por su mediana: la banda
sana es [0.6; 1.6].

| Arma | Coste | Daño máx. | Facilidad | Curva | Desviación | Valor |
| --- | --- | --- | --- | --- | --- | --- |
| Pepinazo de Cortesía | 55 | 18 | 2.4 % | 50 | 10 % | 0.76 |
| Mortero Lamentable | 65 | 24 | 2.5 % | 60 | 8 % | 0.90 |
| Racimo de Tuppers | 60 | 20 | 2.5 % | 55 | 9 % | 0.81 |
| Despedida | 125 | 55 | 3.2 % | 115 | 9 % | 1.37 |
| Barrena Planetaria | 90 | 44 | 2.3 % | 90 | 0 % | 1.09 |
| Rayo Láser | 115 | 46 | 0.9 % | 75 | 53 % | 0.35 |
| Mosca Cojonera | 75 | 28 | 2.8 % | 70 | 7 % | 1.02 |
| Granada de Espoleta | 80 | 34 | 2.4 % | 75 | 7 % | 0.99 |
| Gancho Pegajoso | 118 | 24 | 7.9 % | 120 | 2 % | 1.56 |
| Minirobot Saltaplanetas | 85 | 40 | 2.2 % | 80 | 6 % | 1.01 |

### Desviaciones declaradas

- **Rayo Láser** (`rayo-laser`): Haz instantáneo inmune a la gravedad: la facilidad medida (1,2 %) subestima lo que paga el que no tiene que calcular la curva, así que el precio se queda cerca del máximo y su daño por crédito cae por debajo de la banda.

## Compras por estrategia (saldo inicial 600 cr, sin lotería)

| Comprador | Compras de arma de pago |
| --- | --- |
| Medio (la de precio más cercano a M) | 7 |
| Caro (la más cara asequible, Despedida una vez) | 5 |
| Barato (la de pago más barata) | 10 |
| Medio con dos escudos pagados | 5 |

## Partidas de 3 IAs con la misma puntería (10 semillas)

Cada perfil de gasto juega con la puntería de Almirante Bisagra, los asientos
rotan por semilla y están activos el universo, la muerte súbita y el equipo.

| Perfil | Victorias (partidas con ganador) | Turno propio medio en que no llega ni a la más barata | Sin saldo en su 8.º turno | Paga en la ronda 10 |
| --- | --- | --- | --- | --- |
| ahorrador | 3/8 (38 %) | 13.0 | 0/10 (0 %) | 8/9 (89 %) |
| agresivo | 2/8 (25 %) | 9.0 | 0/9 (0 %) | 0/7 (0 %) |
| mixto | 3/8 (38 %) | no se queda sin saldo | 0/9 (0 %) | 5/9 (56 %) |

### Bandas de cal-3 con estas semillas

- CUMPLE: ahorrador: gana entre el 20 % y el 50 % de las partidas con ganador (38 %)
- CUMPLE: ahorrador: dispara de pago en la ronda 10 en ≥ 70 % de las partidas que llegan (89 %)
- CUMPLE: agresivo: gana entre el 20 % y el 50 % de las partidas con ganador (25 %)
- FUERA DE BANDA: agresivo: sin saldo para la más barata en su 8.º turno propio en ≥ 80 % de las partidas que llegan (0 %)
- CUMPLE: mixto: gana entre el 20 % y el 50 % de las partidas con ganador (38 %)

Con pocas semillas el intervalo de cada tasa es ancho: la comprobación que
manda es la de `PRUEBA_LARGA=1 npm run calibrar:economia -- --semillas 60`.
