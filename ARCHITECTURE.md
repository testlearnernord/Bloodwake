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

## Compatibility maintenance rule

Compatibility code is temporary infrastructure, not permanent architecture.

Any new compatibility layer must document:
- why it exists,
- which current system replaces it, and
- the milestone in which it must be removed.

Once a supported transition has ended, obsolete compatibility models, aliases, conversion helpers, and tests must be removed instead of being retained for hypothetical future use.

## Key decisions in Milestone 0.6.1c

- Removed the obsolete `ServantType` and `Servant` compatibility model after Save v4 became authoritative.
- Removed `legacyPopulation.ts` and its conversion-only tests because save versions 1–3 are intentionally unsupported.
- Removed the deprecated `selectTaskForServant` and `servantCanWork` aliases. Current code uses `selectTaskForVassal`, `canVassalWorkInPhase`, and `vassalCanWork` directly.
- Current gameplay behavior is unchanged: `HumanServant` and `VampireVassal` remain the authoritative population models.

## Key decisions in Milestone 0.6.1b

- **Save format v4 is active.** `SaveGame` uses two separate arrays: `humanServants: HumanServant[]` and `vampireVassals: VampireVassal[]`. The legacy `servants` field is absent from v4 saves; its presence causes rejection.
- **Old saves (v1, v2, v3) are intentionally incompatible.** Loading or importing an old save returns a clear error; no partial load, no silent empty population, no resource grants. Players must start a new game.
- **Population collections are separated.** Human recruitment remains deferred; new games start with an empty `humanServants` list until implemented.
- **Turn creates a `VampireVassal`.** `applyHumanAction` appends to `vampireVassals`. Duplicate prevention is enforced at commit time.
- **Work shift operates on `vampireVassals`.** `runWorkShift` and `selectTaskForVassal` in `src/simulation/servants/` operate on `VampireVassal[]` temporarily until day/night job separation is implemented.
- **World scene sync uses `vampireVassals`.** `WorldScene.syncVassalsWithState()` is the authoritative vassal world-sync path.
- **Population overlay shows separate sections.** The Domain Population overlay renders Human Servants and Vampire Vassals separately.
- **Player-facing terminology updated.** "Turn to Servant" became "Turn into Vassal" and the population overlay is titled "Domain Population".
- **Validation enforces ID uniqueness.** `validateSaveGame` rejects duplicate IDs within either population collection and any ID shared across both.

## Key decisions in Milestone 0.6.1a

- Introduced explicit `HumanServant` (discriminator `kind: "human_servant"`) and `VampireVassal` (discriminator `kind: "vampire_vassal"`) types in `src/types/models.ts`.
- These explicit population models became authoritative in Milestone 0.6.1b; the temporary compatibility layer was removed in Milestone 0.6.1c.

## Key decisions in Milestone 0.5

- Introduced `WorldCycleState` in `SaveGame` to track persistent resource node and enemy depletion within a night cycle.
- Created `advanceWorldPhase()` in `src/simulation/time/phaseAdvance.ts` as the single authoritative lifecycle function for phase transitions.
- Resource nodes and enemy instances use stable string IDs defined in `WorldScene`; depletion is stored in save state, not Phaser objects.
- `WorldScene.syncWorldCycleWithState()` rebuilds world entities when a new night begins, using the cycle number as the trigger.
- Vampire vassal and room world representations are passive scene objects created in `createVassals()` / `createRooms()` and kept in sync by `syncVassalsWithState()` / `syncRoomsWithState()`.
- Human population replenishment uses deterministic IDs (`human-d{day}-{index}`) derived from world seed and day number to prevent collisions across cycles.
- Phase lifecycle logic remains centralized in `advanceWorldPhase()`; current vampire sustenance uses the unified Vitae rules documented below.
- Save format v3 added `worldCycle` with sanitization and deduplication of identifier arrays.

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
- `src/ui/overlays/overlays.ts`: renders population usefulness, room/crafting readiness, inheritance summaries, and pause/settings controls.
- `src/ui/uiState.ts`: centralizes typing-target checks and browser-safe gameplay shortcut capture rules.
- `src/persistence/settings.ts`: stores local-only presentation settings such as UI scale.

## Known limitations

- World composition still uses the compact three-zone prototype map.
- Enemy population remains intentionally small for this milestone.
- Presentation favors small generated silhouettes and shape effects over authored animation sheets.
- Base defense systems such as raids, traps, walls, and path blocking remain deferred.


## Unified Vampire Vitae boundary

- `VampireCharacter` and `VampireVassal` carry Vitae/maxVitae and never use Food as personal sustenance.
- Vitae condition is derived through `src/simulation/blood/vitaeCondition.ts`; thresholds/effects are not persisted.
- Player dawn upkeep consumes personal Vitae. Vassal domain upkeep is deliberately deferred until Blood Stock/Dominion supplies the source/sink.
- Human Food requirements belong to Human Servants and must not be reintroduced through `PopulationBase`.


## Human work boundary (0.6.3b)

Human Thrall work lives in `src/simulation/servants/humanWork.ts` and is intentionally separate from the Vampire Vassal night-production pipeline.

Rules:
- Human Thralls resolve labor after a daytime phase.
- Vampire Vassals continue using the existing night task system.
- Shared data types such as priorities/current task may be reused, but mortal Control/Stress must not be translated into Vampire Loyalty/Morale.
- Do not create placeholder Research or Guarding rewards merely to make a button appear active.
- Future visible worker actors must present this simulation state rather than owning a second independent job simulation.

## Human Thrall boundary (0.6.3a)

`HumanServant` and `VampireVassal` share only operational population fields. Human Thralls must not acquire loyalty/ambition/morale compatibility fields. Their authority model lives in `simulation/servants/humanThralls.ts` through Control/Resistance, housing, Food upkeep and reassertion. Vampire Vassal politics remain separate. Compatibility aliases for the removed human loyalty fields are forbidden; save v7 rejects them.
