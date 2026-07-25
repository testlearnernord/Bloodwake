# Vampire Breed

Vampire Breed is a free browser-based 2D vampire action RPG vertical slice built with TypeScript, Phaser 3, Vite, IndexedDB, and plain HTML/CSS.

> Current status: initial playable vertical slice.

Screenshot placeholder: launch locally with `npm run dev` and capture the current build when visuals change.

## Zero-cost architecture

- Runs entirely in the browser
- Deploys to GitHub Pages as a static site
- Uses no backend, accounts, runtime APIs, or paid services
- Bundles all gameplay code and uses only local placeholder visuals

## What is actually implemented

- Seeded starting vampire generation with configurable trait rarity rules
- Deterministic human generation, feeding, draining, and turning
- Trait inheritance with retained traits, sire traits, incompatibility cleanup, and mutations
- Playable top-down Phaser scene with movement, attacks, dodge, enemy AI, resource pickup, a memory fragment, death, and respawn
- Stronghold room placement, phase advancement, servant priorities, automated work, and crafting queues
- IndexedDB save slots, manual save, auto-save, export/import, validation, and migration scaffolding
- Unit tests for RNG, generation, inheritance, crafting, building, servant tasking, time rules, and save logic

## Controls

- `WASD`: move
- `Left Mouse`: primary attack
- `Right Mouse`: heavy attack
- `Space`: dodge
- `E`: interact / collect
- `F`: feed on a nearby human
- `Tab`: pause or management toggle
- `Escape`: pause menu

## Feature overview

- Ruined Stronghold, Forest Road, and Village Edge zones
- Vitae and Blood Essence as separate resources
- One intro quest chain and one collectible memory fragment
- Human and vampire servants with transparent task reasons
- Room building: Coffin Chamber, Storage Room, Workshop, Servant Quarters, Blood Cellar
- Crafting: Wood Planks, Iron Ingot, Simple Sword, Leather Armor, Healing Draught

## Local installation

```bash
npm install
npm run dev
```

## npm commands

```bash
npm run dev
npm run lint
npm test
npm run build
npm run preview
npm run typecheck
npm run format
```

## Testing

The project uses deterministic Vitest unit tests. Run `npm test` for the suite and `npm run typecheck` plus `npm run lint` before merging.

## Production build

`npm run build` creates a Vite production build configured with the `/Bloodwake/` base path required for GitHub Pages repository hosting.

## GitHub Pages deployment

GitHub Actions runs CI for lint, typecheck, tests, and build, then publishes `dist/` to GitHub Pages from `main`.

## Save-data warning

Save files live in IndexedDB in the current browser. Import/export JSON is provided for backup, but schema changes may still require migrations in future milestones.

## Roadmap summary

The current milestone focuses on the first vertical slice. Next milestones expand combat depth, stronghold automation, more quests, and broader bloodline progression.

## License

MIT. See `LICENSE`.

## Disclaimer

This is a fictional gothic strategy-action game set in a stylized historical fantasy world.
