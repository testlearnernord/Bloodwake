# Changelog

## 0.2.0 - Milestone 0.2 UI/Inventory Overhaul

- Rebranded core user-facing title references to **Bloodwake**.
- Added fullscreen desktop shell with compact strategic top bar and action-RPG bottom HUD.
- Replaced permanent sidebar with single-overlay management system.
- Added deterministic world seed + character roll generation and reroll behavior.
- Removed automatic starter servant from new games.
- Added typed item definitions (category, rarity, icon, stack limits, equip slot, consumable effect metadata).
- Added deterministic inventory helpers for stack, add/remove/consume, and equip/unequip logic.
- Split strategic resources from physical inventory items.
- Updated room building and crafting to consume item inventory.
- Added player equipment loadout impact to combat stats and armor mitigation.
- Added Healing Draught usable consumable behavior.
- Added save format version 2 and v1→v2 migration.
- Added startup fatal-error fallback panel to prevent blank startup pages.
- Added `npm run smoke:pages` and CI/deploy smoke checks for GitHub Pages output.
