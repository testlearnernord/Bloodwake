# Architecture

## Goals

- Browser-only, static deployment
- Deterministic gameplay simulation
- Testable systems separated from Phaser-specific code
- Small understandable modules for future Copilot-driven iteration

## Structure

- `src/config`: central game title, save version, and balancing constants
- `src/data`: data-driven definitions for traits, professions, items, recipes, rooms, quests, collectibles, enemies, and servant events
- `src/simulation`: pure gameplay systems for generation, inheritance, building, crafting, servants, and time
- `src/game`: Phaser scene and bridge integration
- `src/app`: UI shell and state creation
- `src/persistence`: IndexedDB save slots, validation, migration, and local settings
- `src/tests`: deterministic unit tests

## Key decisions

- The initial world uses one Phaser scene with three contiguous zones to keep the playable slice small.
- Stronghold management uses DOM panels so simulation UIs stay decoupled from the render loop.
- Save validation and migration are explicit, versioned, and JSON-friendly.
- Trait behavior uses data plus a small effect-handler registry rather than a single giant switch.

## Known limitations

- The world is a compact slice rather than a broad region map.
- Room placement supports only the current fixed-size grid.
- Equipment management is minimal and not yet a drag-and-drop inventory.
