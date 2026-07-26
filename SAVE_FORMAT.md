# Save Format

Save data is stored as versioned JSON-compatible objects in IndexedDB.

## Included fields

- seed
- player
- NPCs
- servants
- resources
- inventory
- rooms
- construction tasks
- crafting queue
- time
- quests
- collectibles
- settings
- inheritance history
- recent event log

## Migration approach

- The save format version is defined centrally.
- `migrateSaveGame` validates imported data, rejects unsupported future versions, and fills missing fields for older versions.
- Keep migrations additive and explicit.
