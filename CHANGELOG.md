# Changelog

## 0.4.0 - Milestone 0.4 Playability and Core-Loop Integration

- Added Tab / Shift+Tab target cycling, middle-mouse cursor lock, stronger target ring readability, and more predictable angular lock order.
- Stopped combat silhouettes from visually rotating upside down by keeping presentation upright while preserving gameplay aiming logic.
- Added browser-safe gameplay input guards for Ctrl/Cmd+S, Ctrl/Cmd+P, Tab focus stealing, wheel scrolling, and context-menu conflicts while gameplay owns focus.
- Added local UI scale settings plus safer fullscreen shell spacing for desktop play and internal-only overlay scrolling.
- Made human context actions truthful by showing turn eligibility, blocked reasons, profession value, and candidate trait summaries before the player commits.
- Expanded servant, crafting, stronghold, and inheritance UI so visible actions explain readiness, usefulness, and next likely work instead of looking active without support.
- Added deterministic regression tests for blocked turns, exactly-once servant creation state, save persistence of turned servants, shortcut capture rules, cursor-lock targeting, and servant productivity flow.

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
