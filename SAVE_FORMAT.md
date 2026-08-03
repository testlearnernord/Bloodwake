# Save Format

Save data is stored as versioned JSON in IndexedDB.

## Current version

- `version: 3`

## Version 3 key fields

- `seed` (world seed)
- `characterRoll` (deterministic vampire generation roll)
- `player` (includes `equipment`)
- `npcs`
- `servants`
- `strategicResources`
  - `bloodEssence`
  - `security`
  - `gold`
  - `knowledge`
  - `influence`
- `inventory` (physical items and stacks)
- `rooms`
- `constructionTasks`
- `craftingQueue`
- `time`
- `worldCycle` *(new in v3)*
  - `cycle` — monotonically increasing world cycle number; increments each new night
  - `collectedResourceNodeIds` — stable node IDs collected during the current cycle (cleared on new night)
  - `defeatedEnemyIds` — stable enemy instance IDs defeated during the current cycle (cleared on new night)
- `quests`
- `collectibles`
- `inheritanceHistory`
- `lastEventLog`

## v2 → v3 migration behavior

- Preserves all player, NPCs, servants, rooms, construction, crafting queue, quests, collectibles, inheritance history, and logs.
- Adds `worldCycle` with `cycle: 0`, empty `collectedResourceNodeIds`, empty `defeatedEnemyIds`.
- Sanitizes any existing `worldCycle` identifiers: rejects non-alphanumeric/non-hyphen IDs, IDs longer than 64 characters, deduplicates arrays, and caps each array at 500 entries.

## v1 → v2 migration behavior

- Preserves player, NPCs, servants, rooms, construction, crafting queue, quests, collectibles, inheritance history, and logs.
- Keeps existing servants (including legacy starter servants) untouched.
- Normalizes title to `Bloodwake`.
- Adds `characterRoll` default `0` when missing.
- Adds `player.equipment` default `{}` when missing.
- Converts legacy tangible resource counters into inventory item entries.
- Converts legacy `Blood Essence`/`Security` into `strategicResources`.
- Merges duplicate compatible stacks.
- Rejects malformed saves with useful errors.

## World cycle node and enemy IDs

Stable resource node IDs: `wood-node`, `herb-node`, `ore-node`, `stone-node`, `food-node`.

Stable enemy instance IDs: `bandit-1`, `clergy-1`, `knight-1`.

The memory fragment collectible is never stored in `defeatedEnemyIds`; its collection state is tracked in `collectibles`.

## Compatibility notes

- Storage/database key names are intentionally unchanged to avoid breaking existing browser storage.
- Future schema updates should remain additive and explicit.
