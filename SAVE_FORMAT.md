# Save Format

Save data is stored as versioned JSON in IndexedDB.

## Current version

- `version: 8`

## Version 8 key fields

The main collections remain `player`, `npcs`, `humanServants`, `vampireVassals`, `strategicResources`, `inventory`, `rooms`, `constructionTasks`, `craftingQueue`, `time`, `worldCycle`, `quests`, `collectibles`, `inheritanceHistory`, `settings`, and `lastEventLog`.

### Free-Human world lifecycle

Each `npcs[]` Human now persists the explicit world-presence fields:

- `worldPresence` — `active` or `dormant`
- `dormantReason` — `regional`, `escaped`, `captured`, or `null`
- `dormantSinceDay` — first day of the current dormant period, or `null`
- `scheduledReturnDay` — deterministic possible return day for an escaped Human, or `null` when no return is scheduled
- `lastSeenDay` — most recent day the Human was active in the world

This state separates a persistent character record from an actor currently spawned on the map. Escaped Thralls are therefore not immediately restored as ordinary Village Edge actors. The nightly population resolver may later return them, and stale escaped records are pruned by retention age and hard cap.

Free Humans still persist Blood Resonance (`1..5`), Resolve (`1..5`), Disposition (`-100..100`), Fear (`0..100`), profession, traits, relationships and status (`wandering`, `fed`, `drained`, `turned`, `enthralled`). The obsolete `bloodQuality` and `recruitability` fields remain invalid.

## Human Thralls

Each `humanServants[]` entry has `kind: "human_servant"`, retains mortal identity metadata, and persists Control (`0..100`) and Resistance (`1..5`). Human Thralls intentionally do not use Loyalty, Ambition or Morale. Those belong to Vampire Vassals.

A source NPC remains `enthralled` and dormant while captive. If Control reaches zero, that identity returns to `wandering` but remains off-map with `dormantReason: "escaped"` until the nightly lifecycle makes it regionally eligible again.

## Population identity rules

`humanServants` and `vampireVassals` are separate explicit collections. The old generic `servants` field is invalid. Duplicate IDs are rejected within either stronghold collection and an ID may not occur in both collections. A Human Thrall deliberately shares identity with its source NPC record.

## Vampire resource rules

Ordinary vampire `hunger` was removed in save v6. Vitae is the personal blood/supernatural-energy resource for the player and Vampire Vassals. Saves containing stale `hunger` fields are rejected.

## World cycle IDs

Enemy and resource instance IDs are generated deterministically from the current day (for example `enemy-d4-1` and `resource-d4-wood-1`). `worldCycle.collectedResourceNodeIds` and `worldCycle.defeatedEnemyIds` still track depletion within the current prototype night and are reset by the current phase boundary. Continuous respawn scheduling replaces that authority in 0.6.5d.

## Old save compatibility

**Saves at versions 1 through 7 are intentionally incompatible with v8.** Loading or importing an older save returns a clear incompatibility error. There is no partial migration or silent repair; players must start a new game.

## Historical breaking changes

- v4 split the old `servants` collection into `humanServants` and `vampireVassals`.
- v5 introduced Blood Resonance / Resolve / Disposition / Fear and removed `bloodQuality` / `recruitability`.
- v6 removed ordinary vampire hunger and unified personal vampire sustenance around Vitae.
- v7 gave Human Thralls their Control / Resistance captivity model and removed human Loyalty / Ambition / Morale.
- v8 adds persistent active/dormant Human world lifecycle metadata, deterministic escaped-Human return scheduling, and bounded off-map retention.
