# Shoot my starship

Artillería por turnos en el Cinturón de la Deriva: naves varadas
disparándose en mundos de chatarra con terreno destructible, diez armas y
rivales con mala idea. Next.js (App Router) + Phaser 4, 100% cliente, sin
cuenta y sin instalar nada.

## Desarrollo

```bash
npm ci
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Comprobaciones

```bash
npm run lint                        # ESLint
npm run typecheck                   # tsc --noEmit en modo estricto
npm run build                       # build de producción
npm run verificar:presupuesto-bundle  # JS del primer arranque <= 1.2MB gzip
npm run test:e2e                    # Playwright, contra un build local
```

El CI (`.github/workflows/ci.yml`) ejecuta todas estas comprobaciones en
cada push y cada pull request.
