# Save Format

Save data is stored as versioned JSON in IndexedDB.

## Current version

- `version: 4`

## Version 4 key fields

- `seed` (world seed)
- `characterRoll` (deterministic vampire generation roll)
- `player` (includes `equipment`)
- `npcs`
- `humanServants` — array of recruited human servants *(new in v4; currently always empty pending recruitment implementation)*
- `vampireVassals` — array of vampire vassals created by the Turn action *(new in v4; replaces `servants`)*
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
- `worldCycle`
  - `cycle` — monotonically increasing world cycle number; increments each new night
  - `collectedResourceNodeIds` — stable node IDs collected during the current cycle (cleared on new night)
  - `defeatedEnemyIds` — stable enemy instance IDs defeated during the current cycle (cleared on new night)
- `quests`
- `collectibles`
- `inheritanceHistory`
- `lastEventLog`

## v4 population fields

`humanServants` is an array of `HumanServant` objects (each with `kind: "human_servant"`).  
`vampireVassals` is an array of `VampireVassal` objects (each with `kind: "vampire_vassal"`).  
The legacy `servants` field is **not present** in v4 saves. Any save that contains `servants` will be rejected.

ID uniqueness rules enforced at load time:
- No duplicate IDs within `humanServants`.
- No duplicate IDs within `vampireVassals`.
- No ID may appear in both collections.

## Old save compatibility

**Saves at version 1, 2, or 3 are intentionally incompatible with v4.**  
Loading or importing an old save returns a clear error: *"This save belongs to an incompatible older game version."*  
No partial load, no silent empty population, no resource grants will occur.  
Players must start a new game.  
Existing old save slots remain deletable.

## v3 → v4 breaking changes

- `servants` removed; replaced by `humanServants` and `vampireVassals`.
- No automatic migration from v1/v2/v3 to v4.
- Human recruitment is deferred; `humanServants` will always be empty until implemented.
- Day-phase human servant work is deferred; vampire vassals work only at night.

## World cycle node and enemy IDs

Stable resource node IDs: `wood-node`, `herb-node`, `ore-node`, `stone-node`, `food-node`.

Stable enemy instance IDs: `bandit-1`, `clergy-1`, `knight-1`.

The memory fragment collectible is never stored in `defeatedEnemyIds`; its collection state is tracked in `collectibles`.

## Compatibility notes

- Storage/database key names are intentionally unchanged to avoid breaking existing browser storage.
- Future schema updates should remain additive and explicit.
