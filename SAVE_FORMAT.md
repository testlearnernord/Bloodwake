# Save Format

Save data is stored as versioned JSON in IndexedDB.

## Current version

- `version: 7`

## Version 7 key fields

- `seed` — world seed
- `characterRoll` — deterministic vampire generation roll
- `player` — vampire player state including equipment and Vitae
- `npcs` — free humans with Blood Resonance and recruitment-facing metadata
- `humanServants` — captive Human Thralls held in the stronghold
- `vampireVassals` — autonomous vampire vassals created by Turning
- `strategicResources`
  - `bloodEssence`
  - `security`
  - `gold`
  - `knowledge`
  - `influence`
- `inventory` — physical items and stacks
- `rooms`
- `constructionTasks`
- `craftingQueue`
- `time`
- `worldCycle`
  - `cycle` — increments each new night
  - `collectedResourceNodeIds` — collected resource nodes for the current cycle
  - `defeatedEnemyIds` — defeated enemy instances for the current cycle
- `quests`
- `collectibles`
- `inheritanceHistory`
- `settings`
- `lastEventLog`

## v7 Human Thralls

Each `humanServants[]` entry has `kind: "human_servant"` and retains the captive's mortal identity, including family name, faction, profession, traits, Blood Resonance, Resolve, Disposition, Fear and relationships.

Human Thralls additionally persist:

- `control` — integer `0..100`; current strength of the vampiric bond
- `resistance` — integer `1..5`; how quickly the captive pushes against Control
- `stress` — current strain on the captive
- operational worker fields such as priorities/current task, reserved for the expanding human-work system

Human Thralls intentionally **do not** persist `loyalty`, `ambition`, or `morale`. Those belong to Vampire Vassals. A v7 save containing those obsolete fields on a Human Thrall is rejected.

Free humans may use status `enthralled` while the corresponding Human Thrall is held in the stronghold. If Control reaches zero and the captive escapes, that free-human record returns to `wandering`.

## Free-human metadata

Free humans in `npcs` use:

- `bloodResonance` — integer `1..5`
- `resolve` — integer `1..5`
- `disposition` — integer `-100..100`
- `fear` — integer `0..100`
- `status` — `wandering`, `fed`, `drained`, `turned`, or `enthralled`

The obsolete `bloodQuality` and `recruitability` fields are not accepted.

## Population identity rules

`humanServants` and `vampireVassals` are separate explicit collections. The old generic `servants` field is invalid.

ID rules enforced at load time:

- no duplicate IDs within `humanServants`
- no duplicate IDs within `vampireVassals`
- no ID may appear in both explicit stronghold population collections

A Human Thrall deliberately shares identity with its source free-human NPC record. The NPC remains marked `enthralled` while captive and is not spawned as a free human.

## Vampire resource rules

Ordinary vampire `hunger` was removed in save v6. Vitae is the personal blood/supernatural-energy resource for the player and Vampire Vassals. Saves containing stale `hunger` fields are rejected.

## Old save compatibility

**Saves at versions 1 through 6 are intentionally incompatible with v7.**

Loading or importing an older save returns a clear incompatibility error. There is no partial migration or silent repair. Players must start a new game, and old slots remain deletable.

## Historical breaking changes

- v4 split the old `servants` collection into `humanServants` and `vampireVassals`.
- v5 introduced the current free-human Blood Resonance / Resolve / Disposition / Fear metadata and removed `bloodQuality` / `recruitability`.
- v6 removed ordinary vampire hunger and unified personal vampire sustenance around Vitae.
- v7 gives Human Thralls their actual captivity model: Control / Resistance, retained mortal identity, housing and Food upkeep foundations, with human Loyalty / Ambition / Morale removed.

## World cycle IDs

Stable resource node IDs currently include `wood-node`, `herb-node`, `ore-node`, `stone-node`, and `food-node`.

Stable enemy instance IDs currently include `bandit-1`, `clergy-1`, and `knight-1`.

The memory fragment collectible is tracked in `collectibles`, not `defeatedEnemyIds`.

## Compatibility notes

- Storage/database key names remain unchanged.
- Breaking schema changes may reject old saves rather than retaining migration or compatibility shims.
- Active feature work must not modify `docs/archive/*`.
