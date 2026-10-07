# Calibración de la economía

Regenerado por `npm run calibrar:economia`. No a mano: los números salen de
`tests/utils/calibrarEconomia.ts`, el mismo cálculo que vigilan
`tests/unit/economia/calibrado.test.ts` y `parametros.ts`.

## Parámetros

- Mediana de los precios de las armas de pago con daño (M): **85 cr**
- `PRESUPUESTO_BASE` fijo, sin arrastre entre partidas: **600 cr**
- `PREMIO_LOTERIA` fijo: **150 cr**
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
| Despedida | 125 | 55 | 4.5 % | 125 | 0 % | 1.55 |
| Barrena Planetaria | 90 | 44 | 2.7 % | 90 | 0 % | 1.03 |
| Rayo Láser | 115 | 46 | 1.2 % | 80 | 44 % | 0.38 |
| Mosca Cojonera | 75 | 28 | 3.3 % | 75 | 0 % | 0.97 |
| Granada de Espoleta | 80 | 34 | 3.2 % | 85 | 6 % | 1.07 |
| Gancho Pegajoso | 115 | 24 | 8.5 % | 125 | 8 % | 1.39 |
| Minirobot Saltaplanetas | 85 | 40 | 2.6 % | 85 | 0 % | 0.96 |

### Desviaciones declaradas

- **Rayo Láser** (`rayo-laser`): Haz instantáneo inmune a la gravedad: la facilidad medida (1,2 %) subestima lo que paga el que no tiene que calcular la curva, así que el precio se queda cerca del máximo y su daño por crédito cae por debajo de la banda.

## Compras por estrategia (saldo inicial 600 cr, sin lotería)

| Comprador | Compras de arma de pago |
| --- | --- |
| Medio (la de precio más cercano a M) | 7 |
| Caro (la más cara asequible, Despedida una vez) | 5 |
| Barato (la de pago más barata) | 10 |
| Medio con dos escudos pagados | 4 |

## Partidas de 3 IAs con la misma puntería (no ejecutado en esta pasada semillas)

Se omite la simulación con `--sin-simulacion`.
