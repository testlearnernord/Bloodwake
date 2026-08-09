# Continuous Simulation Transition Plan

## Purpose

Bloodwake is moving from a phase-batched prototype toward a continuous, causal world simulation. This document is the authoritative transition register for that conversion.

The target rule is simple:

> The world simulates causes. The UI issues orders and summarizes results.

A resource total, crafting percentage, room progress value, raid timer, or character state must eventually be the result of something that happened in world time. We must not retain a permanent second path where actors appear to work while an unrelated batch resolver silently creates the result.

This does **not** mean every passive statistic needs a literal animation. Control decay, Vitae upkeep, healing rates, threat decay, and similar systemic changes may be clock-driven math. Material movement, production, construction, gathering, hauling, combat operations, and item creation must have a causal actor/location/task chain.

## Non-negotiable invariants

1. **One authority per system.** Presentation may project state but must never award a duplicate result.
2. **No permanent batch fallback.** Once a continuous replacement is stable, the old phase/shift resolver is deleted in the same migration block or its immediately following Legacy Purge.
3. **Material has a location.** Long-term, items/resources live in a container, on an actor, at a workstation/site, or in the world. A global total is a derived UI view, not the source of truth.
4. **Work requires an actor, target and elapsed time.** Construction/crafting/gathering/hunting cannot advance merely because a phase changed.
5. **Time is world-owned.** The player may pause/change simulation speed, but may not decide when dawn or night occurs. `Advance Phase` is prototype tooling, not final game authority.
6. **Orders are intent, tasks are execution.** The player requests outcomes/priorities. The simulation creates/reserves executable tasks.
7. **Determinism remains mandatory.** The same save state + same ordered inputs + same elapsed simulation ticks must resolve identically.
8. **Transitional code must carry a removal milestone.** No `legacyMaybeOld` folklore functions surviving because everyone became scared to touch them.

## Current authority audit

| System | Current authority / behavior | Why temporary | Target authority | Planned removal / conversion |
| --- | --- | --- | --- | --- |
| Day/night | `src/simulation/time/phaseAdvance.ts` toggles `TimeState.phase` when the player presses Advance | Player controls the sun; most simulation happens as one batch | Continuous `WorldClock` with derived solar phase, pause and speed controls | 0.6.5a |
| App phase control | `BloodwakeApp` calls `advanceWorldPhase()` from UI | UI directly triggers global simulation settlement | UI changes speed/pause only; clock emits dawn/night events | 0.6.5a |
| Human Thrall work | `runHumanWorkDay()` selects a task and immediately mutates room progress, crafting progress and inventory once per day | Actor movement is currently presentation while output is batch-granted | Persistent task runtime with reservations, movement, work ticks and completion | 0.6.5b, 0.6.5d, 0.6.5e |
| Vampire Vassal work | `runWorkShift()` immediately constructs, crafts, gathers, or grants Security on a phase transition | Abstract shift reward, including fake `security += 1` | Real night orders/tasks; guard/hunt/patrol/raid resolve through actual actors and encounters | 0.6.5b, 0.6.5f |
| Visible actor work | `domainActorTasks.ts` derives a presentation plan and `WorldScene` steps `idle -> moving -> working -> returning` | Motion is non-authoritative by design and not persisted | Simulation-owned task runtime; WorldScene renders that runtime | 0.6.5b |
| Global inventory | `SaveGame.inventory` is the authoritative locationless item pool | Wood/food/weapons effectively teleport between producers, recipes, building and equipment | Physical containers + carried inventory + world/worksite/workstation storage; topbar/inventory aggregate them | 0.6.5c |
| Resource pickup | `WorldScene` node interaction calls `onCollectItem`, which directly adds to global inventory | No carrying/hauling/storage step | Node has remaining material; actor carries payload; storage receives it | 0.6.5c, 0.6.5d |
| Night resource reset | `WorldCycleState.collectedResourceNodeIds` is cleared each new night and fixed node definitions reappear | Respawn is phase magic and map composition is fixed | Region/resource ecology or deterministic respawn schedules driven by world time | 0.6.3c prepares variation; authority replaced 0.6.5d |
| Enemy reset | `WorldCycleState.defeatedEnemyIds` is cleared each new night | Enemies respawn because a phase changed | Encounter/population schedules and regional state | 0.6.3c prepares variation; authority replaced 0.6.5d/0.8+ region work |
| Human replenishment | `replenishHumanPopulation()` runs on Day -> Night | Population is maintained by phase-bound top-up | Regional population lifecycle, off-map records, respawn/arrival scheduling and pruning | 0.6.3c, later clock trigger in 0.6.5a |
| Escaped Humans | Escape immediately restores NPC to `wandering`; population record stays in the active list | Does not support hiding/off-map return/pruning lifecycle | Active / dormant-off-map / pruned-or-genealogy lifecycle | 0.6.3c |
| Crafting queue | `CraftingOrder.progress` is advanced by daily/shift resolvers; `completeCraftingOrder()` consumes global inputs and materializes global outputs | No workstation reservation, delivery, actual working time or output location | Work order + reserved workstation + delivered inputs + work ticks + workstation output + haul task | 0.6.5b, 0.6.5c, 0.6.5e |
| Construction | `queueRoomConstruction()` consumes all global materials at placement; daily/shift work adds progress | Materials teleport to the site and are paid before delivery | Blueprint/site container; haul materials; reserve builder; work ticks complete structure | 0.6.5c, 0.6.5e |
| Construction legacy save field | `SaveGame.constructionTasks` had no live consumer; active construction already used `BuiltRoom.status/progress` | Duplicate authority was unnecessary | `BuiltRoom.status/progress` only | ✅ Removed in 0.6.3e |
| Thrall Food | `resolveHumanThrallDay()` removes Food from global inventory once per resolved day | Food teleports from a locationless pool into every Thrall | Accessible Food containers + meal/consumption schedule; shortage derived from actual access | 0.6.5c, 0.6.5f |
| Thrall Control | Daily batch decay in `resolveHumanThrallDay()` | Correct concept, wrong scheduler | Continuous or scheduled clock-driven decay; no visual fake required | 0.6.5f |
| Player dawn Vitae | Dawn event in `advanceWorldPhase()` subtracts Vitae | Concept is valid; scheduler is temporary | WorldClock dawn event performs upkeep | 0.6.5a |
| Combat loot | Player enemy defeat directly grants Blood Essence; other future loot would otherwise land globally | Bypasses drops/carrying; Vassal operations need recoverable loot | Material loot drops/carried payload. Truly supernatural immediate rewards may remain only when explicitly designed as such | 0.6.5c/0.6.5f |
| Room storage capacity | Room definitions expose storage capacity while inventory is global | Capacity/location cannot matter yet | Real room/container capacity and access | 0.6.5c |
| Vassal random events | `SERVANT_EVENTS` are checked during work shifts | Event cadence is coupled to shift calls | Clock/event scheduler driven by elapsed time and action outcomes | 0.6.5f |
| Threat / raids | Not yet implemented | Must not be built as `Advance Day -> threat + X -> raid` | Timed faction processes, travel/arrival times, real raid actors and Stronghold defense | Design for clock now; implementation 1.0 |

## Target architecture

### 1. WorldClock

The save eventually owns monotonically increasing simulation time. Day/night is derived from that time. The UI may expose Pause / 1x / 2x / 3x, but does not expose a normal gameplay `Advance Phase` action.

The clock emits deterministic scheduled boundaries/events such as dawn, dusk, daily upkeep, arrivals and delayed consequences. A debug time-skip may exist only as explicit developer tooling.

### 2. Orders and authoritative tasks

Orders express player intent, for example:

- Craft 5 Simple Swords
- Maintain at least 40 Wood in storage
- Build this Workshop
- Guard this gate
- Hunt in this region

The task system turns those orders into executable units with at minimum:

- actor ID / eligibility
- task type
- source location
- destination/work location
- reserved resources/container slots/workstation
- current phase (`queued`, `moving`, `working`, `hauling`, `returning`, `blocked`, `complete`, `failed`)
- accumulated work / duration

`currentJob` and `currentTask` may remain useful UI summaries, but the task runtime becomes authority.

### 3. Physical item and resource ownership

Long-term item state must identify *where it is*.

Examples:

- Storage Room container
- Blood Cellar container
- Workshop input/output buffer
- Construction site material buffer
- Human/Vampire carried inventory
- player inventory/equipment
- world drop/resource node

The UI can still show `Wood: 37`, but that number is an aggregate query across accessible containers rather than a mutable global pool.

### 4. Work execution

A successful production chain becomes causal:

`Order -> Task -> Reserve -> Move -> Acquire/Deliver -> Work over time -> Produce physical result -> Haul/store/equip`

If an actor is interrupted, wounded, killed, ordered elsewhere, blocked from the destination, or loses access to materials, progress follows the actual state instead of being granted at the next phase boundary.

### 5. World processes

Population arrivals, escaped Human reappearance, enemy patrols, resource recovery, faction threat, raids and regional events use the same world clock/event scheduler. They may be off-map simulations when appropriate, but must have explicit timing and state rather than being hidden bonuses attached to a button press.

## Transitional rules for upcoming milestones

Until the 0.6.5 conversion begins, existing phase-batched systems may remain functional so the game stays playable. New work must follow these constraints:

- Do not introduce a second new batch production engine.
- Do not make `advanceWorldPhase()` responsible for new domain concepts when a focused resolver can be called by a future clock event instead.
- Express durations/costs independently of “one click” wherever possible.
- Keep world/presentation movement non-authoritative until 0.6.5b rather than secretly granting rewards from Phaser.
- `0.6.3c Nightly World Variation` may use dusk/night-start as its current trigger, but generation logic must live outside the UI/phase button so the WorldClock can call it later.
- `0.6.3d Blood Stock & Blood Cellar Foundation` may establish the resource, capacity and rules, but automated Donor production should not become another permanent `+Blood Stock per day` path. Physical donor execution belongs to the continuous-task migration.
- `0.6.4 Dominion/Torpor/Politics/Orders` must separate political/state rules from scheduling. Night orders can initially resolve through adapters, but their model must support real durations and actors later.

## Planned 0.6.5 conversion sequence

### 0.6.5a World Clock & solar cycle

Daylight design target: vampires remain freely controllable. Sheltered Stronghold interiors are safe; exterior daylight applies continuous exposure rather than freezing actors. Exposure severity can later be modified by bloodline/genetic traits, learned powers, equipment and facilities, but ordinary vampires should never treat direct sun as harmless.

- Persist simulation time.
- Add Pause / speed controls.
- Derive day/night/dawn/dusk from time.
- Convert dawn Vitae and lifecycle triggers to clock events.
- Remove normal gameplay dependence on `Advance Phase`.

### 0.6.5b Authoritative task runtime & reservations

- Move task phase/progress authority out of `WorldScene` presentation.
- Persist or deterministically reconstruct active tasks.
- Add actor/workstation/resource reservation rules.
- Make actor movement consume authoritative task destinations.

### 0.6.5c Physical containers, carrying & hauling

- Introduce container/location ownership.
- Add actor carried payloads and hauling tasks.
- Convert Storage/Blood Cellar/workstation/site capacity into real constraints.
- Change global inventory UI into an aggregate view/compatibility adapter.

### 0.6.5d Gathering, hunting & world-resource conversion

- Resource nodes own remaining quantity/state.
- Gathering requires travel + work + carried yield + storage delivery.
- Hunting becomes a real operation/encounter result with recovered loot.
- Replace per-night node/enemy reset authority with timed/regional processes where applicable.

### 0.6.5e Crafting & construction conversion

- Crafting consumes delivered inputs at a real workstation over work time.
- Crafted outputs exist at the workstation before hauling/equipping.
- Construction sites receive materials physically and progress only while a valid builder works there.
- Remove direct batch progress/reward branches from Human and Vassal shift resolvers.

### 0.6.5f Upkeep, Blood Donors, rest & timed population consequences

0.6.3d provides only the persistent Blood Stock boundary, physical Blood Cellar capacity and irreversible donor assignment. It has no passive producer. During this milestone the temporary aggregate `bloodStock.amount` must be replaced by actual Blood Cellar container contents, and bound donors must produce only through elapsed-time facility tasks with recovery/health consequences.

- Food consumption uses accessible physical Food.
- Donor tasks produce Blood Stock through real actor/facility time and consequences.
- Control decay, recovery, Torpor and Vassal Blood upkeep use scheduled/continuous time.
- Vassal guard/hunt/patrol orders use real tasks/operations instead of abstract shift rewards.
- Convert servant political/random event cadence away from `runWorkShift()` calls.

### 0.6.5g Continuous Simulation Legacy Purge

Delete superseded code immediately after stabilization, including as applicable:

- normal gameplay `advanceWorldPhase()` / phase-toggle UI path
- `runHumanWorkDay()` reward/progress branches
- `runWorkShift()` batch reward/progress branches
- presentation-owned actor task phase once simulation task runtime is authoritative
- direct worker `addItem()` rewards
- global crafting input/output teleport paths
- immediate construction material consumption at queue time
- obsolete `WorldCycleState` depletion/reset fields replaced by persistent world entities/processes
- compatibility adapters for the old global inventory once all consumers use containers
- tests/documentation that assert removed batch behavior

A future continuous-simulation save version bump is expected. 0.6.3e already removed confirmed dead duplicate save authorities instead of waiting for 0.6.5g. Old prototype saves do not justify carrying duplicate simulation architecture indefinitely.

## Escaped Human lifecycle and save-size rule

`0.6.3c` should introduce a bounded lifecycle instead of preserving every generated person forever:

- **Active:** visible, enthralled, vassal-related, quest/story relevant, or otherwise currently simulated in detail.
- **Dormant/off-map:** escaped/relevant Humans retained for a limited window and eligible to reappear.
- **Prunable:** old, unconnected, non-special records may be deleted after the relevance window.
- **Genealogy stub later:** when family/genetics arrive, important ancestors can collapse to a minimal historical record rather than a full live character object.

Dormant populations should have regional soft caps and deterministic pruning so a centuries-long save does not become the personnel archive of the entire Holy Roman Empire.

## Acceptance tests for converted systems

A system is not considered converted merely because an animation exists. Relevant tests should prove causality, for example:

- no Wood enters storage before a gatherer reaches, works, carries and deposits it
- crafting cannot progress without a reserved valid workstation and delivered inputs
- a worker leaving the workstation stops progress
- construction cannot progress without required site materials and an active builder
- destroyed/inaccessible storage changes what jobs can consume
- Vassal hunt loot does not appear in the Stronghold before the Vassal/operation returns it
- pausing the world stops simulation time and timed work
- changing simulation speed changes elapsed wall-clock rate but not deterministic game-time results
- dawn occurs because clock time reaches dawn, not because the player clicked a lifecycle button

## Scope discipline

The conversion should be incremental. Bloodwake does not need full Dwarf Fortress pathfinding, per-item physics, or a microscopic life simulation to obey these principles. Simple deterministic anchors, compact carried stacks, off-map operations, and coarse work ticks are acceptable when they preserve causal authority.

The test for every abstraction is: **can the player understand what caused the result, where the relevant actor/resource was, and how interruption would change it?** If the answer is yes, the abstraction is serving the game instead of faking it.
