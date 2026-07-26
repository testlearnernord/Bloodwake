# Architecture

## Goals

- Browser-only, static deployment
- Deterministic gameplay simulation
- Strict TypeScript with testable pure systems
- Lightweight vanilla DOM UI without framework dependencies

## Structure

- `src/config`: title, save version, balancing constants
- `src/data`: traits, professions, items, recipes, rooms, quests, collectibles, enemies
- `src/simulation`: pure gameplay systems (generation, inheritance, inventory, crafting, building, servants, combat stats)
- `src/game`: Phaser world scene and UI/game bridge
- `src/app`: application coordinator and state creation
- `src/ui`: shell, top bar, HUD, overlays, icon registry, tooltips, notifications, shortcut state
- `src/persistence`: IndexedDB save slots, validation, and migration
- `src/tests`: deterministic unit tests

## Key decisions in Milestone 0.2

- Split physical items and strategic resources in the save model.
- Keep all menu screens in a single reusable overlay host (one major overlay open at a time).
- Keep Phaser simulation independent from DOM rendering by using a typed bridge.
- Centralize menu shortcuts and icon rendering in `src/ui` modules.
- Use local inline SVG icon registry instead of network assets.

## Known limitations

- Combat feel remains intentionally lightweight pending Milestone 0.3.
- Overlay layouts prioritize desktop and are compact on narrower windows.
- Tactical lock-on and animation state machines are deferred.
