# Architecture

## Goals

- Browser-only, static deployment
- Deterministic gameplay simulation
- Strict TypeScript with testable pure systems
- Lightweight vanilla DOM UI without framework dependencies

## Structure

- `src/config`: title, save version, balancing constants
- `src/data`: traits, professions, items, combat actions, abilities, enemy attacks, enemies, quests, collectibles
- `src/simulation`: pure gameplay systems (generation, inheritance, inventory, crafting, building, servants, combat math, targeting, movement, action state, bite pipeline, projectile math, enemy combat)
- `src/game`: Phaser world scene, combat presentation, and UI/game bridge
- `src/app`: application coordinator and state creation
- `src/ui`: shell, top bar, HUD, overlays, icon registry, tooltips, notifications, shortcut state
- `src/persistence`: IndexedDB save slots, validation, and migration
- `src/tests`: deterministic unit tests

## Key decisions in Milestone 0.3

- Keep save version 2 unchanged by storing runtime combat state outside persistent save data.
- Keep Phaser combat orchestration in the scene, but move calculations and timings into focused pure combat modules.
- Use shared data-driven action and enemy-attack definitions so damage timing and presentation timing stay aligned.
- Keep all menu screens in the existing overlay host so management UI still blocks gameplay input.
- Keep lock-on HUD and combat cooldowns in the plain-DOM UI layer through typed bridge snapshots.
- Preserve the separation between `strategicResources` and `inventory`.

## Combat module responsibilities

- `src/data/combatActions.ts`: player action timings, costs, windows, and presentation IDs
- `src/data/abilities.ts`: projectile definitions and HUD-facing ranged metadata
- `src/data/enemyAttacks.ts`: telegraphed enemy attack definitions by enemy type
- `src/simulation/combat/actionState.ts`: player action state machine and cooldown/cost rules
- `src/simulation/combat/targeting.ts`: lock validation, selection, cycling, and unlock rules
- `src/simulation/combat/movement.ts`: free and target-relative orbital movement math
- `src/simulation/combat/projectiles.ts`: deterministic projectile direction, lifetime, range, and one-hit rules
- `src/simulation/combat/enemyCombat.ts`: enemy windup/active/recovery state stepping
- `src/simulation/combat/bite.ts`: shared feed/drain/turn validation and commit pipeline
- `src/game/combat/CombatPresentation.ts`: generated silhouettes, telegraphs, target rings, floating numbers, flashes, and afterimages

## Known limitations

- World composition still uses the compact three-zone prototype map.
- Enemy population remains intentionally small for this milestone.
- Presentation favors small generated silhouettes and shape effects over authored animation sheets.
