# Changelog

## 0.6.3c - Nightly World Variation & Escaped-Human Lifecycle

- Enemy counts, types, positions and resource-node layouts now vary deterministically by world seed and night.
- Active free Humans rotate through a bounded regional pool and receive deterministic nightly positions.
- Escaped Human Thralls no longer respawn immediately as ordinary villagers; they enter a dormant off-map state with a deterministic possible return schedule.
- Dormant escaped records expire after a retention window and are hard-capped to prevent long-save population bloat.
- New Humans are generated only to maintain the bounded regional pool when captures, deaths, Turning or other removals create vacancies.
- Human world lifecycle is now explicit persistent state; save format advances to v8 and v1-v7 remain intentionally unsupported.
- Nightly lifecycle logic is a pure simulation function called by the current phase boundary, ready to move behind the future WorldClock without being tied to the UI button.

## 0.6.3b3 - Visible Work & Actor Task Foundation

- Human Thralls now travel toward selected daytime work instead of remaining fixed Stronghold decorations.
- Vampire Vassals now travel toward selected night tasks and shelter during day.
- Added a pure actor motion state machine: Idle → Moving → Working → Returning.
- Visible destinations are derived from the same Human/Vassal task selectors used by simulation, avoiding a duplicate job system.
- Construction and crafting route actors to real room positions; gathering/hunting/guarding receive explicit world destinations as transitional anchors.
- No new resource rewards or production shortcuts were added; phase-batched production remains temporary pending the 0.6.3b4 simulation architecture audit.
- Save format remains v7.

## 0.6.3b2 - Domain World Presence

- Human Thralls now appear as synchronized character silhouettes inside the Stronghold.
- Vampire Vassals use a vampire character silhouette instead of the old red rectangle placeholder.
- Enthrallment, elevation and escape add/remove domain actors from the authoritative population arrays.
- World labels expose current Human/Vampire activity without creating a second job simulation.
- Added deterministic Stronghold anchors and regression coverage for presence transitions.
- Save format remains v7.

## 0.6.3b1 - Thrall Elevation

- Existing Human Thralls can be deliberately Elevated into Vampire Vassals for the normal turning Vitae cost.
- Elevation preserves learned profession skills, equipped items, identity, current stress, and relevant mortal metadata.
- Human Control/Resistance end at elevation; the result uses Vampire Vassal Loyalty/Ambition/Morale instead.
- Direct Turning and Thrall Elevation now share one Vampire Vassal factory.
- Vampire inheritance no longer incorrectly copies the sire's learned profession skills.
- Escape regression coverage now proves a returned wandering human is eligible for Feed, Drain, Enthrall, and Turn once requirements are met.
- Save format remains v7.

## 0.6.3b - Human Work Foundation

- Human Thralls now perform real daytime labor instead of existing only as Control/Food upkeep entries.
- Building, Crafting, Gathering, and Hunting are real mortal jobs with real outputs.
- Work efficiency derives from profession aptitude, existing job skill values, relevant traits, Control, and Stress.
- Crafting now accumulates work progress across days for Human Thralls and respects profession requirements.
- Human work priorities are editable from Domain Population and persist through autosave.
- Guarding and Research remain intentionally unavailable to mortal workers until those systems have real gameplay outputs.
- No save schema change; save format remains v7.

## 0.6.3a1 - Human Thrall Playtest Fixes

- Enthralled humans now disappear from the roaming world immediately while their identity remains persisted for captivity and escape.
- Thrall escapes now produce an on-screen notification instead of only a buried phase-log entry.
- Turn and Enthrall buttons show their exact Vitae costs; blocked Turning reports the exact requirement.

## 0.6.3a - Human Thralls: Enthrallment, Control & Housing

- Added Enthrall as a fourth free-human choice alongside Feed, Drain and Turn.
- Human Servants are now explicit captive Thralls with Control and Resistance instead of Loyalty, Ambition or Morale.
- Added two base human housing spaces and +4 capacity per built Servant Quarters.
- Added daily Food upkeep and Resistance-driven Control decay; shortages increase Stress and accelerate Control loss.
- Added night-only Reassert Control management that spends Vitae to reinforce the vampiric bond.
- Thralls whose Control reaches zero escape and return to the free-human world.
- Human Thralls retain family identity, profession, traits, Blood Resonance and human metadata for later job/genetic/bloodline systems.
- Save format advances to v7; v1-v6 remain intentionally unsupported.

## 0.6.2e - Predatory Bite Circular Timing Rework

- Replaced the permissive two-button timing windows with two sequential circular skill checks.
- Each circle now rolls a seeded-random green success sector; the player must press `F` while the rotating marker is inside that sector.
- Pressing early, late, or spamming outside the green sector fails the bite immediately.
- Normal prey uses slower circles and wider green sectors; elites rotate faster and expose a smaller target sector.
- The centered Predatory Bite UI now shows both circles, the active random green arc, the rotating marker, completed-circle feedback, and the current 1/2 or 2/2 step.
- The existing pounce, Vitae reward, execution, failure damage, knockback, audio, and save-v6 behavior remain unchanged.

## 0.6.2c Hotfix - Combat Feeding Presentation & Clergy Damage

- Holy Bolt impacts now use the same authoritative damage/death/respawn pipeline as melee attacks, fixing the Clergy Hunter being unable to finish the player correctly.
- Predatory Bite now has a large centered QTE panel with an explicit `F` prompt, two-step counter, and visible shrinking timing bar.
- Added a stronger pounce trail/impact, blood-siphon particles, result flashes, camera feedback, and lightweight procedural audio cues.
- The visible timing bar is driven by the same deterministic QTE state used by gameplay; no second UI-only timer was introduced.

## 0.6.2c - Combat Feeding

- Added Predatory Bite as a contextual `F` combat finisher against a locked vulnerable hostile.
- Normal enemies become vulnerable at 35% health or while staggered; elites use a 20% threshold or stagger.
- Combat feeding uses two deterministic timing inputs after the pounce; elites have tighter windows.
- Success executes the vulnerable enemy and restores up to 2 Vitae, giving a zero-Vitae player a route back into supernatural abilities.
- Failed attempts damage and knock the player away, with higher failure damage against elites.
- The locked-target HUD advertises when Predatory Bite is ready, while the existing Bite ability remains contextual for nearby humans.
- Successful execution prevents infinite Vitae farming from a single enemy without introducing another persisted blood counter.
- Save format remains v6; no schema or migration changes are required.
- Boss-specific combat feeding remains deferred until regional/boss progression exists.

## 0.6.2b - Blood Choices

- Blood Resonance now determines Feed and Drain rewards instead of decorative metadata.
- Feed restores `1 + ceil(resonance / 2)` Vitae and leaves the human alive; Blood Hunter adds +1 Vitae to Feed only.
- Drain restores `2 + resonance` Vitae, kills the target, and yields 1 Blood Essence at resonance 1-3 or 2 at resonance 4-5.
- Already-fed humans cannot be fed, drained, or turned again until the next-night recovery step, closing the infinite-feeding exploit.
- Focused-human UI previews use the same authoritative reward calculation as execution, including max-Vitae clipping.
- Result messages report actual Vitae restored rather than nominal gain.
- Bottom HUD cards no longer stretch into a large empty block when the locked-target panel is taller.
- Removed obsolete flat Feed/Drain reward constants; no compatibility aliases remain.
- Save format remains v6; no schema change or migration is introduced.
- Combat Feeding remains a separate 0.6.2c milestone.

## 0.6.2a - Unified Vampire Vitae

- Removed ordinary vampire hunger and the dawn starvation-damage system.
- Vitae is now the player's single personal blood reserve and supernatural ability resource.
- Added derived Sated / Thirsty / Starved / Bloodless states with attack and movement penalties.
- Added 1 Vitae player upkeep at dawn; low Vitae does not directly damage health.
- Removed the Hunger HUD/CSS and folded blood condition feedback into the Vitae bar.
- Renamed Feral Hunger to Feral Thirst with no legacy alias.
- Removed the fake Wood -> Food gathering side effect; Food remains reserved for future Human Servants.
- Respawn no longer manufactures free Vitae.
- Save format is v6; v1-v5 saves remain intentionally unsupported with no migration.
- Vampire Vassal Blood Stock/upkeep is deferred until Dominion, and Resonance Feed/Drain balancing remains 0.6.2b.

## 0.6.1d - Human Metadata and Blood Resonance

- Replaced free-human `bloodQuality` with authoritative `bloodResonance` (1–5) and labels Thin/Common/Rich/Potent/Exceptional.
- Removed decorative `recruitability`; added deterministic `resolve`, neutral `disposition`, and initial `fear` metadata for future recruitment systems.
- Added deterministic weighted Blood Resonance generation using 35/35/20/8/2 weights and the existing seeded RNG.
- Incremented the save format to v5. Saves from v1–v4 are intentionally rejected; no compatibility migration was added.
- Added strict v5 validation for free-human metadata and rejection of stale `bloodQuality` / `recruitability` fields.
- Updated the focused-human UI to show labeled Blood Resonance while keeping unused recruitment metadata hidden.
- Feed, Drain, Turn, hunger, Blood Essence, and inheritance balance are unchanged in this milestone.

## 0.6.1c - Milestone 0.6.1c: Remove obsolete legacy servant compatibility code

- Removed the obsolete `ServantType` and `Servant` compatibility model now that Save v4 uses `HumanServant` and `VampireVassal` directly.
- Removed `src/simulation/population/legacyPopulation.ts`; save versions 1–3 remain intentionally unsupported instead of being converted.
- Removed the deprecated `selectTaskForServant` and `servantCanWork` compatibility aliases.
- Removed legacy-only population conversion tests and updated the remaining crafting fixture to use the current `VampireVassal` model.
- Added an architecture rule requiring temporary compatibility layers to document their replacement and removal milestone.
- No gameplay, Save v4 schema, Turn behavior, world synchronization, crafting behavior, or vassal work behavior changed.

## 0.6.1b - Milestone 0.6.1b: Activate separate human servant and vampire vassal populations

### Save format v4

- `SAVE_FORMAT_VERSION` incremented from 3 to 4.
- `SaveGame.servants: Servant[]` removed. Replaced by two explicit population arrays:
  - `humanServants: HumanServant[]` — recruited human servants (new games start empty until recruitment is implemented).
  - `vampireVassals: VampireVassal[]` — vampire vassals created by the Turn action.
- New games initialize both arrays as empty.
- Saves at version 1, 2, or 3 are intentionally incompatible. Loading or importing an old save returns a clear error; no partial load, no resource grants, no silent empty population.
- Existing old save slots remain deletable.

### Validation

- `validateSaveGame` now requires `humanServants` and `vampireVassals` arrays and rejects any save that contains the legacy `servants` field.
- Population records are validated: each `humanServant` must have `kind: "human_servant"`, each `vampireVassal` must have `kind: "vampire_vassal"`.
- Duplicate IDs rejected: no duplicates within `humanServants`, no duplicates within `vampireVassals`, no ID shared across both collections.

### Turn action

- `applyHumanAction` with `mode: "turn"` now creates a `VampireVassal` and appends it to `vampireVassals`.
- Duplicate prevention: a vassal is only appended if its ID is not already present in `vampireVassals`.
- Log message updated: *"Turned {name} into a fledgling vampire vassal."*

### Work simulation

- `runWorkShift` and `selectTaskForVassal` now operate on `VampireVassal[]` temporarily until day/night job separation is implemented.
- Vampire vassals work at night only.
- Human servant day work remains deferred.

### World scene

- `WorldScene.createVassals()` / `syncVassalsWithState()` replaces the former servant equivalents.
- Vampire vassal tokens still appear as dark-red sprites with name and job labels.
- Sync is duplicate-safe (add/remove by vassal ID without duplication).

### Player-facing terminology

- "Turn to Servant" button renamed to **"Turn into Vassal"**.
- Population overlay title changed from "Servants" to **"Domain Population"**.
- Overlay now shows two separate sections: **Human Servants** (with an empty-state message only when none exist) and **Vampire Vassals**.

### Deferred

- Human recruitment is not implemented. New games start with an empty `humanServants` list until a future milestone adds recruitment.
- Day-phase human servant work is not implemented.
- No Blood Stock, Dominion, torpor, housing, food upkeep, raids, or sunlight mechanics.

## 0.6.1a - Milestone 0.6.1a: Add human servant and vampire vassal population types

### Population type foundation

- Added explicit `HumanServant` type with discriminator `kind: "human_servant"` in `src/types/models.ts`.
- Added explicit `VampireVassal` type with discriminator `kind: "vampire_vassal"` in `src/types/models.ts`.
- Marked the existing `Servant` type as `@deprecated` (legacy compatibility model). Existing production code is unchanged.
- Added pure conversion helpers in `src/simulation/population/legacyPopulation.ts`:
  - `convertLegacyHumanServant(servant)`: converts a human Servant to HumanServant.
  - `convertLegacyVampireVassal(servant)`: converts a vampire Servant to VampireVassal.
  - `splitLegacyServants(servants)`: splits a mixed legacy array into separate `humanServants` and `vampireVassals` arrays.
- Helpers clone nested mutable objects (priorities, equipped, attributes, traitIds) and never mutate the source.

## 0.5.0 - Milestone 0.5: Synchronize servants, rooms, world respawns, and hunger



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
