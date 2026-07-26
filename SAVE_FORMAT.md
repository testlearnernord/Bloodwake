# Save Format

Save data is stored as versioned JSON in IndexedDB.

## Current version

- `version: 2`

## Version 2 key fields

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
- `quests`
- `collectibles`
- `inheritanceHistory`
- `lastEventLog`

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

## Compatibility notes

- Storage/database key names are intentionally unchanged to avoid breaking existing browser storage.
- Future schema updates should remain additive and explicit.
