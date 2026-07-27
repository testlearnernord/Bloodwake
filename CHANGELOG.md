# Changelog

## 0.3.0 - Milestone 0.3 Tactical Combat Overhaul

- Added Ctrl target lock, mouse-wheel target cycling, and target-relative orbital movement.
- Replaced placeholder combat with visible Light Attack, Heavy Attack, Blood Lance, dodge, and shared bite/feed/drain/turn sequences.
- Added deterministic combat modules for targeting, movement, action-state timing, projectile stepping, bite commits, and enemy combat.
- Added real Blood Lance and holy projectiles with cleanup on impact, expiration, and scene shutdown.
- Added readable enemy telegraphs and distinct bandit, clergy hunter, and elite knight behaviors with no contact damage.
- Added combat HUD ability slots, locked-target status, delayed health feedback, damage numbers, hit flashes, blood bursts, and target rings.
- Replaced primary world tokens with generated silhouettes and combat presentation helpers.
- Preserved save format version 2, overlay input blocking, Pages smoke validation, and deterministic inventory/import safeguards.

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
