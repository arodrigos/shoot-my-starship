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
| Pepinazo de Cortesía | 35 | 18 | 2.6 % | 35 | 0 % | 0.83 |
| Racimo de Tuppers | 40 | 20 | 2.5 % | 40 | 0 % | 0.78 |
| Despedida | 80 | 55 | 3.3 % | 80 | 0 % | 1.41 |
| Barrena Planetaria | 65 | 44 | 2.5 % | 65 | 0 % | 1.05 |
| Rayo Láser | 75 | 46 | 0.8 % | 55 | 36 % | 0.30 |
| Mosca Cojonera | 50 | 28 | 2.9 % | 50 | 0 % | 1.01 |
| Gancho Pegajoso | 75 | 24 | 6.9 % | 75 | 0 % | 1.37 |
| Minirobot Saltaplanetas | 60 | 40 | 2.4 % | 60 | 0 % | 0.99 |

### Desviaciones declaradas

- **Rayo Láser** (`rayo-laser`): Haz instantáneo inmune a la gravedad: la facilidad medida (1,2 %) subestima lo que paga el que no tiene que calcular la curva, así que el precio se queda cerca del máximo y su daño por crédito cae por debajo de la banda.

## Compras por estrategia (saldo inicial 600 cr, sin lotería)

| Comprador | Compras de arma de pago |
| --- | --- |
| Medio (la de precio más cercano a M) | 9 |
| Caro (la más cara asequible, Despedida una vez) | 8 |
| Barato (la de pago más barata) | 17 |
| Medio con dos escudos pagados | 6 |

## Partidas de 3 IAs con la misma puntería (no ejecutado en esta pasada)

Se omite la simulación con `--sin-simulacion`.
