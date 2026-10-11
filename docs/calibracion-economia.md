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
| Pepinazo de Cortesía | 40 | 18 | 2.6 % | 40 | 0 % | 0.79 |
| Mortero Lamentable | 50 | 24 | 2.8 % | 50 | 0 % | 0.91 |
| Racimo de Tuppers | 45 | 20 | 2.8 % | 45 | 0 % | 0.84 |
| Despedida | 85 | 55 | 3.3 % | 85 | 0 % | 1.45 |
| Barrena Planetaria | 70 | 44 | 2.5 % | 70 | 0 % | 1.06 |
| Rayo Láser | 80 | 46 | 0.8 % | 55 | 45 % | 0.31 |
| Mosca Cojonera | 55 | 28 | 2.9 % | 55 | 0 % | 1.00 |
| Granada de Espoleta | 60 | 34 | 2.7 % | 60 | 0 % | 1.04 |
| Gancho Pegajoso | 80 | 24 | 6.9 % | 80 | 0 % | 1.40 |
| Minirobot Saltaplanetas | 65 | 40 | 2.4 % | 65 | 0 % | 1.00 |

### Desviaciones declaradas

- **Rayo Láser** (`rayo-laser`): Haz instantáneo inmune a la gravedad: la facilidad medida (1,2 %) subestima lo que paga el que no tiene que calcular la curva, así que el precio se queda cerca del máximo y su daño por crédito cae por debajo de la banda.

## Compras por estrategia (saldo inicial 600 cr, sin lotería)

| Comprador | Compras de arma de pago |
| --- | --- |
| Medio (la de precio más cercano a M) | 10 |
| Caro (la más cara asequible, Despedida una vez) | 7 |
| Barato (la de pago más barata) | 15 |
| Medio con dos escudos pagados | 7 |

## Partidas de 3 IAs con la misma puntería (no ejecutado en esta pasada)

Se omite la simulación con `--sin-simulacion`.
