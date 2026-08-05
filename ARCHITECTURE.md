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

## Key decisions in Milestone 0.6.1b

- **Save format v4 is active.** `SaveGame` replaces `servants: Servant[]` with two separate arrays: `humanServants: HumanServant[]` and `vampireVassals: VampireVassal[]`. The legacy `servants` field is absent from v4 saves; its presence causes rejection.
- **Old saves (v1, v2, v3) are intentionally incompatible.** Loading or importing an old save returns a clear error; no partial load, no silent empty population, no resource grants. Players must start a new game.
- **Population collections are separated.** All former vampire servants become vampire vassals in new games. Human recruitment remains deferred; `humanServants` is always empty until implemented.
- **Turn creates a `VampireVassal`.** `applyHumanAction` now appends to `vampireVassals`. Duplicate prevention is enforced at commit time (a vassal is only appended if its ID does not already exist in `vampireVassals`).
- **Work shift operates on `vampireVassals`.** `runWorkShift` and `selectTaskForVassal` in `src/simulation/servants/` operate on `VampireVassal[]` temporarily until day/night job separation is implemented.
- **World scene sync uses `vampireVassals`.** `WorldScene.syncVassalsWithState()` replaces `syncServantsWithState()`.
- **Population overlay shows separate sections.** The Domain Population overlay renders a Human Servants section (currently empty with a placeholder message) and a Vampire Vassals section.
- **Player-facing terminology updated.** "Turn to Servant" → "Turn into Vassal". The population overlay is titled "Domain Population".
- **`Servant` type retained** in `src/types/models.ts` as a `@deprecated` reference kept for `legacyPopulation.ts`. It is not used in any production runtime path.
- **Validation enforces ID uniqueness.** `validateSaveGame` rejects: duplicate IDs within `humanServants`, duplicate IDs within `vampireVassals`, and any ID shared across both collections.

## Key decisions in Milestone 0.6.1a

- Introduced explicit `HumanServant` (discriminator `kind: "human_servant"`) and `VampireVassal` (discriminator `kind: "vampire_vassal"`) types in `src/types/models.ts`.
- The existing `Servant` type is preserved as a `@deprecated` legacy model for `legacyPopulation.ts` only.
- Added pure conversion helpers in `src/simulation/population/legacyPopulation.ts`: `convertLegacyHumanServant`, `convertLegacyVampireVassal`, and `splitLegacyServants`. These clone all nested mutable objects and never mutate the source.

## Key decisions in Milestone 0.5

- Introduced `WorldCycleState` in `SaveGame` to track persistent resource node and enemy depletion within a night cycle.
- Created `advanceWorldPhase()` in `src/simulation/time/phaseAdvance.ts` as the single authoritative lifecycle function for phase transitions.
- Resource nodes and enemy instances use stable string IDs defined in `WorldScene`; depletion is stored in save state, not Phaser objects.
- `WorldScene.syncWorldCycleWithState()` rebuilds world entities when a new night begins, using the cycle number as the trigger.
- Vampire vassal and room world representations are passive scene objects created in `createVassals()` / `createRooms()` and kept in sync by `syncVassalsWithState()` / `syncRoomsWithState()`.
- Human population replenishment uses deterministic IDs (`human-d{day}-{index}`) derived from world seed and day number to prevent collisions across cycles.
- Hunger cap and starvation logic live in `advanceWorldPhase()` to keep them testable and centralized.
- Save format v3 adds `worldCycle` with sanitization and deduplication of identifier arrays.

## Key decisions in Milestone 0.4

- Keep save version 2 unchanged by storing runtime combat state outside persistent save data.
- Keep Phaser combat orchestration in the scene, but move calculations and timings into focused pure combat modules.
- Use shared data-driven action and enemy-attack definitions so damage timing and presentation timing stay aligned.
- Keep all menu screens in the existing overlay host so management UI still blocks gameplay input.
- Keep lock-on HUD and combat cooldowns in the plain-DOM UI layer through typed bridge snapshots.
- Preserve the separation between `strategicResources` and `inventory`.
- Keep browser-conflicting shortcuts blocked only while gameplay owns focus.
- Keep UI scale as a local setting that changes shell variables without adding framework/runtime dependencies.
- Prefer disabling misleading controls with real reasons over rendering fake-active actions.

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

## Playability integration points

- `src/app/App.ts`: binds truthful overlay state, browser-safe shortcut guards, local UI scale, and human context actions to persistent save data.
- `src/ui/overlays/overlays.ts`: renders servant usefulness, room/crafting readiness, inheritance summaries, and pause/settings controls.
- `src/ui/uiState.ts`: centralizes typing-target checks and browser-safe gameplay shortcut capture rules.
- `src/persistence/settings.ts`: stores local-only presentation settings such as UI scale.

## Known limitations

- World composition still uses the compact three-zone prototype map.
- Enemy population remains intentionally small for this milestone.
- Presentation favors small generated silhouettes and shape effects over authored animation sheets.
- Base defense systems such as raids, traps, walls, and path blocking remain deferred.
