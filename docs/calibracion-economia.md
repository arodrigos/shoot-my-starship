# Calibración de la economía

Regenerado por `npm run calibrar:economia`. No a mano: los números salen de
`tests/utils/calibrarEconomia.ts`, el mismo cálculo que vigilan
`tests/unit/economia/calibrado.test.ts` y `parametros.ts`.

## Parámetros

- Mediana de los precios de las armas de pago con daño (M): **85 cr**
- `PRESUPUESTO_BASE` = round50(10 × M): **850 cr**
- `ARRASTRE_MAXIMO` = round5(0,25 × base): **215 cr**
- `PREMIO_LOTERIA` = round5(0,25 × base): **215 cr**
- Equipo (sin cambios por la calibración): Escudo 90 cr, Propulsores 60 cr

## Precios frente a la curva daño × facilidad

La facilidad es la de `docs/facilidad-armas.md`. «Valor» es el daño esperado
por crédito (daño máximo × facilidad / coste) dividido por su mediana: la banda
sana es [0.6; 1.6].

| Arma | Coste | Daño máx. | Facilidad | Curva | Desviación | Valor |
| --- | --- | --- | --- | --- | --- | --- |
| Pepinazo de Cortesía | 55 | 18 | 3.1 % | 60 | 8 % | 0.80 |
| Mortero Lamentable | 65 | 24 | 3.3 % | 70 | 7 % | 0.95 |
| Racimo de Tuppers | 85 | 20 | 6.6 % | 100 | 15 % | 1.22 |
| Despedida | 120 | 55 | 4.5 % | 125 | 4 % | 1.62 |
| Barrena Planetaria | 90 | 44 | 2.7 % | 90 | 0 % | 1.03 |
| Rayo Láser | 115 | 46 | 1.2 % | 80 | 44 % | 0.38 |
| Mosca Cojonera | 75 | 28 | 3.3 % | 75 | 0 % | 0.97 |
| Granada de Espoleta | 80 | 34 | 3.2 % | 85 | 6 % | 1.07 |
| Gancho Pegajoso | 115 | 24 | 8.5 % | 125 | 8 % | 1.39 |
| Minirobot Saltaplanetas | 85 | 40 | 2.6 % | 85 | 0 % | 0.96 |

### Desviaciones declaradas

- **Rayo Láser** (`rayo-laser`): Haz instantáneo inmune a la gravedad: la facilidad medida (1,2 %) subestima lo que paga el que no tiene que calcular la curva, así que el precio se queda cerca del máximo y su daño por crédito cae por debajo de la banda.

## Compras por estrategia (saldo inicial 850 cr, sin arrastre ni lotería)

| Comprador | Compras de arma de pago |
| --- | --- |
| Medio (la de precio más cercano a M) | 10 |
| Caro (la más cara asequible, Despedida una vez) | 7 |
| Barato (la de pago más barata) | 15 |
| Medio con dos escudos pagados | 8 |
| Medio en una segunda partida con el arrastre máximo (1065 cr) | 12 |

## Partidas de 3 IAs con la misma puntería (3 semillas)

Cada perfil de gasto juega con la puntería de Almirante Bisagra, los asientos
rotan por semilla y están activos el universo, la muerte súbita y el equipo.

| Perfil | Victorias (partidas con ganador) | Turno propio medio en que no llega ni a la más barata | Sin saldo en su 8.º turno | Paga en la ronda 10 |
| --- | --- | --- | --- | --- |
| ahorrador | 0/3 (0 %) | 13.0 | 0/3 (0 %) | 3/3 (100 %) |
| agresivo | 0/3 (0 %) | 10.0 | 0/3 (0 %) | 0/3 (0 %) |
| mixto | 3/3 (100 %) | no se queda sin saldo | 0/3 (0 %) | 1/3 (33 %) |
