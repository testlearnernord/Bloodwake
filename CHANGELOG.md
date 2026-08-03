# Changelog

## 0.5.0 - Milestone 0.5: Synchronize servants, rooms, world respawns, and hunger

### World cycle and persistence

- Added `WorldCycleState` to `SaveGame`: tracks `cycle`, `collectedResourceNodeIds`, and `defeatedEnemyIds`.
- Incremented `SAVE_FORMAT_VERSION` to 3.
- Added v2 → v3 migration: initializes `worldCycle` safely; sanitizes and deduplicates identifier arrays; limits array size; rejects invalid identifiers.
- Every normal resource node now has a stable instance ID (`wood-node`, `herb-node`, `ore-node`, `stone-node`, `food-node`).
- Every enemy instance has a stable ID (`bandit-1`, `clergy-1`, `knight-1`).
- Collected resource nodes and defeated enemies are recorded in `worldCycle` and persist across save/load within the same night.
- On the transition from day to night, `collectedResourceNodeIds` and `defeatedEnemyIds` are cleared and resources/enemies respawn exactly once.

### Centralized phase advance

- Introduced `advanceWorldPhase(state)` in `src/simulation/time/phaseAdvance.ts`.
- Coordinates: day/night toggle, day increment, hunger increase (night→day), starvation consequence, servant work shift, human replenishment (day→night), world cycle refresh (day→night).
- Returns `{ state, events, worldCycleChanged }` for clean notification flow.
- `App.ts` now delegates to this function instead of scattering lifecycle logic in event handlers.

### Hunger model

- Added balancing constants: `MAX_HUNGER = 10`, `FEED_HUNGER_REDUCTION = 3`, `DRAIN_HUNGER_REDUCTION = 4`, `STARVATION_HEALTH_DAMAGE = 2`.
- Hunger is clamped to `[0, MAX_HUNGER]`.
- Feeding a human reduces hunger by `FEED_HUNGER_REDUCTION`.
- Draining a human reduces hunger by `DRAIN_HUNGER_REDUCTION` (always ≥ feed reduction).
- Hunger reductions cannot produce negative values.
- At maximum hunger, each dawn deals `STARVATION_HEALTH_DAMAGE` (min health floor 1) and logs a warning event.
- HUD now shows hunger as `current/MAX` with `!` (high) and `⚠ STARVING` (max) indicators plus a descriptive tooltip.

### Human population replenishment

- Added `replenishHumanPopulation()` in `src/simulation/world/humans.ts`.
- At each new night, drained and turned humans are removed, fed humans recover to `wandering`, and new humans are generated to restore the active population to `TARGET_HUMAN_POPULATION = 5`.
- New human IDs are deterministic (`human-d{day}-{index}`) and unique across cycles.
- WorldScene adds new human sprites without requiring a scene reload.

### Servant world representation

- Turned vampire servants now appear as dark-red token sprites in Ruined Stronghold with a name label and current job label.
- `syncServantsWithState()` adds newly turned servants and removes dismissed ones without duplicating.

### Room world representation

- All `BuiltRoom` instances are mapped to the Stronghold visual area using the 4×4 grid origin.
- Built rooms appear solid; under-construction rooms appear semi-transparent with a progress indicator (`n/3`).
- `syncRoomsWithState()` updates progress labels when construction advances.

### Bridge and world sync

- `GameBridge.onCollectItem` now receives `nodeId` (stable ID), `itemId`, and `amount`.
- `GameBridge.onEnemyDefeated` now receives `instanceId` and `enemyType` separately.
- `GameBridge.notifyWorldCycleChanged` added for bridge-to-scene signaling.
- `WorldScene` detects world cycle changes in `update()` and calls `syncWorldCycleWithState()` to rebuild entities.

### Tests

- Added `src/tests/world-sync.test.ts` with 52 new deterministic tests covering: phase lifecycle, hunger model, human replenishment, resource persistence, enemy lifecycle, servant state, room state, and save migration.
- All 132 tests pass.

### Known limitations

- Servant movement AI, job navigation, hauling, and pathfinding are not implemented.
- Room interiors, collision, walls, doors, and traps are not implemented.
- True starvation death or frenzy behavior is deferred.
- Human servants are not implemented.
- Advanced injuries, skill XP, and workbench crafting are not implemented.
- Browser-based manual playtest results: functionality confirmed via automated tests; browser interaction not performed in sandbox environment.



- Fixed critical bug: enemy windup deadline reset every frame. When an enemy was in `windup` state and the deadline had not yet elapsed, `stepEnemyCombat` fell through to the generic range-entry block and re-assigned `phaseEndsAt: now + attack.windupMs` on every tick, preventing the windup from ever naturally completing during uninterrupted gameplay.
- Fixed enemies failing to attack during normal focused gameplay without requiring a menu open, focus change, or tab switch.
- Fixed projectile attacks (Clergy Hunter Holy Bolt) depending on overlay or focus interaction to fire.
- Added explicit early-return guards for all active timed states (`windup`, `active_attack`, `recovery`) before the generic attack-selection branch. Each timed state now preserves its original `phaseEndsAt` and advances exactly once.
- Preserved `trackingDuringWindup` behavior: attacks with tracking enabled continue updating the enemy's facing toward the player during windup while `phaseEndsAt` remains unchanged. Attacks with `directionLockMs > 0` keep `directionLock` and `facing` stable throughout windup.
- Improved pause-safe enemy state progression: frozen simulation time (overlay open) no longer repeatedly restarts or extends any timed state; combat resumes predictably without attack bursts when the overlay closes.
- Added 11 deterministic regression tests covering: windup deadline stability across intermediate frames, windup progression at exact deadline, melee damage emitted exactly once, projectile fired exactly once, recovery→approach transition, tracking windup (facing updates, deadline unchanged), locked windup (directionLock stable, deadline unchanged), frozen-time no-progress invariant, frame-rate independence (16 ms steps vs. single large step produce identical final state), dead-enemy no-attack, and second attack cycle after cooldown.
- No new major gameplay systems added.

## 0.4.2 - Milestone 0.4.2 Dodge Hotfix

- Fixed permanent-busy softlock: dodge previously used the same string for `windupState` and `activeState` (`'dodge'`), causing `stepAction` to re-enter the windup→active transition after the active phase expired and never reach idle. Dodge now uses distinct `'dodge_windup'` and `'dodge_active'` states.
- Fixed dodge velocity being overwritten every frame: `updateMovement` previously recomputed and applied normal/locked-movement velocity every tick, silently zeroing out the one-time velocity set at dodge start. The resolved direction is now stored at action start and reapplied throughout the active window; normal movement, lock-orbit movement, and attack multipliers cannot interfere.
- Fixed invulnerability window: `startAction` previously granted invulnerability for the full `activeMs` (220 ms) instead of the intended `DODGE_INVULNERABLE_MS` (150 ms). The action definition now carries `invulnerableMs` and `startAction` uses that value.
- Fixed time-domain mismatch: `onDodgeUsed(Date.now() + DODGE_COOLDOWN_MS)` mixed wall-clock time with Phaser scene time. The bridge method and its caller have been removed; dodge readiness is now authoritative from the Phaser-time `cooldowns` map emitted in every `CombatUiSnapshot`.
- Fixed close icon invisible in SVG fill rendering: the previous path (`M5 5l14 14M19 5L5 19`) consisted of two open line segments with no enclosed area, rendering as an empty square. Replaced with a properly closed filled-X path.
- Added focused deterministic regression tests covering dodge phase ordering, phase re-entry prevention, invulnerability window bounds, `isActionStateActive` during windup, Phaser-time cooldown recording, repeated-input blocking, and close-icon filled-path requirement.

## 0.4.1 - Milestone 0.4.1 Layout Hotfix

- Repaired oversized overlay headers: the previous overlay renderer returned `<header>` and `<div class="overlay-body">` as separate direct children of `#overlay-root`; the CSS rule `.overlay-root > *` applied full panel dimensions (≈86dvh height) to every direct child, causing the header alone to fill nearly the entire viewport. Fixed by introducing a `renderOverlayPanel` helper that wraps header and body inside a single `<div class="overlay-panel">`, and replacing `.overlay-root > *` with a targeted `.overlay-panel` rule.
- Repaired clipped overlay bodies: inventory, crafting, servant, stronghold, and other content is no longer pushed below the viewport. The overlay panel uses `grid-template-rows: auto minmax(0, 1fr)` with `overflow: hidden`; only the body scrolls.
- Repaired bottom HUD clipping: the game shell previously used fixed pixel heights (`--topbar-h`, `--hud-h`) for the top and bottom grid rows. When HUD content (ability slots, target panel, vitals) exceeded the fixed row height the shell's `overflow: hidden` silently clipped it. Changed `.game-app` to `grid-template-rows: auto minmax(0, 1fr) auto` so rows size to their content.
- Improved desktop viewport scaling: overlay dimensions are now viewport-relative (`clamp`, `dvh`, `min()`), UI scales 90%–125% remain usable, and changing scale while an overlay is open immediately produces a valid layout.
- Added compact-height media queries (`max-height: 800px` and `max-height: 700px`) to reduce HUD padding, slot height, and non-critical secondary text at low viewport heights without hiding critical state.
- Expanded regression tests: panel structure, aria attributes, close button presence, header-before-body ordering, panel wrapper identity, UI scale option validation, and CSS layout invariants.
- No new gameplay systems added.

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
