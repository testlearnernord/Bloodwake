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

## Current save/state authority (0.6.3e)

Historical milestone implementation notes belong in `CHANGELOG.md` and `docs/archive/`; this document describes current authority only.

- **Save format v10 is authoritative.** Prototype saves v1-v9 are intentionally unsupported rather than carried through permanent compatibility layers.
- **Population is explicit.** `humanServants`, `bloodDonors`, and `vampireVassals` are separate collections; the legacy generic `servants` field is invalid.
- **Human identity is persistent.** `npcs` owns free/dormant Human lifecycle metadata, while Stronghold population arrays own their captive/vampire roles.
- **Construction has one authority.** `BuiltRoom.status/progress` represents placed construction. The unused `constructionTasks` save/model path was removed in 0.6.3e.
- **Blood Essence has one authority.** Strategic Blood Essence lives only in `SaveGame.strategicResources.bloodEssence`; VampireCharacter no longer duplicates it.
- **Recovered memories have one authority.** `SaveGame.collectibles[].discovered` owns memory recovery; VampireCharacter no longer carries a duplicate `memoryFragments` list.
- **Blood Stock is separate from Vitae and Blood Essence.** `bloodStock.amount` is bounded by built Blood Cellar capacity. No passive donor production exists yet.
- **World presentation is a projection.** WorldScene renders population, rooms, tasks and encounters from simulation state rather than owning a second authoritative roster.
- **Phase-batched work remains transitional.** Human/Vassal reward settlement and the global inventory are explicitly temporary until the 0.6.5 continuous-simulation migration documented in `docs/SIMULATION_TRANSITION_PLAN.md`.

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


## Nightly world lifecycle boundary (0.6.3c)

Nightly variation is derived from `seed + day` through pure functions in `src/simulation/world/nightlyWorld.ts`. `WorldScene` renders those spawn definitions; it does not own encounter composition or Human persistence.

Free Humans now carry explicit `worldPresence` lifecycle metadata. An escaped Thrall becomes a dormant off-map Human and may receive a deterministic return day. Regional Humans rotate through a bounded candidate pool, and new Humans are generated only to keep that pool viable. Dormant escaped Humans are pruned by age and a hard cap so a long-running save cannot accumulate an unbounded list of former captives.

The current Day -> Night phase transition calls this lifecycle resolver only as a temporary scheduler. Milestone 0.6.5a will move the trigger to `WorldClock` without changing the lifecycle authority.

## Visible work / actor task boundary (0.6.3b3)

World movement is a projection of authoritative task selection, not a second job system. Human Thralls use `selectTaskForHumanThrall` during day and Vampire Vassals use `selectTaskForVassal` during night to derive destinations. `domainActorTasks.ts` owns presentation-safe task plans and motion state (`idle -> moving_to_task -> working -> returning`); it never awards resources, completes recipes, advances construction, or mutates population state. The existing phase-batched production paths are temporary and must be inventoried in 0.6.3b4 before continuous world-time conversion.

## Domain world presence boundary (0.6.3b2)

Controlled population world actors are projections of simulation state. `humanServants` is the sole source for Human Thrall actors and `vampireVassals` is the sole source for Vampire Vassal actors. WorldScene may display names, current work and deterministic Stronghold anchors, but it must not own a second population/job state. Enthrallment, escape and elevation therefore add/remove world actors by changing simulation state, not by mutating a separate roster. Visible pathing and job animation belong to 0.6.3b3.

## Thrall elevation boundary (0.6.3b1)

Elevation converts one existing `HumanServant` into one `VampireVassal`. The mortal Thrall is the source of current learned profession skills, equipment, stress and other captivity-era state; the persisted NPC identity supplies human-only background such as Ambition for inheritance. Elevation removes the Human Thrall entry, marks the mortal NPC identity `turned`, records inheritance, and creates a Vampire Vassal through the same shared vassal factory as direct Turning.

Learned profession skills are not bloodline inheritance. `inheritVampire()` therefore accepts explicit learned host skills and never copies the sire's profession skill map by default.

## Human Thrall boundary (0.6.3a)

`HumanServant` and `VampireVassal` share only operational population fields. Human Thralls must not acquire loyalty/ambition/morale compatibility fields. Their authority model lives in `simulation/servants/humanThralls.ts` through Control/Resistance, housing, Food upkeep and reassertion. Vampire Vassal politics remain separate. Compatibility aliases for the removed human loyalty fields are forbidden; save v7 rejects them.
