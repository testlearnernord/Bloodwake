# Milestone 0.6.1 Specification
## Domain Population Reforge

**Repository:** `testlearnernord/Bloodwake`  
**Target branch:** `copilot/milestone-0.6.1-domain-population-reforge`  
**Pull request title:** `Milestone 0.6.1: Reforge human servants, vampire vassals, blood choices, and day management`

## Role and current state

Act as a senior TypeScript/Phaser engineer, game systems designer, economy designer, UX designer, save-migration engineer, QA engineer, and technical writer.

Work only from the latest `main` after merged PR #8 and PR #9. The current production save format is v3. Preserve working combat, dodge, targeting, bite sequencing, world-cycle respawns, room rendering, saves, GitHub Pages deployment, and the current UI shell unless this specification explicitly replaces behavior.

## Product vision

Bloodwake must become a systemic vampire action RPG with domain management.

### Day
- The player rests safely in the stronghold.
- Human servants work.
- The player manages people, housing, food, rooms, construction, crafting, equipment, shortages, and preparation.
- Daytime must be active management, not a frozen world state.

### Night
- The player hunts, fights, feeds, drains, recruits, turns, gathers rare resources, and seeks valuable humans.
- Active vampire vassals receive night orders.
- Human servants rest.
- Night outcomes return blood, people, materials, knowledge, and strategic opportunities to the domain.

### Long-term loop
1. Discover people, threats, and opportunities at night.
2. Choose Feed, Drain, Recruit, or Turn.
3. Use human servants to operate the daytime economy.
4. Use vampire vassals for nighttime power.
5. Build rooms that create real capacity and production.
6. Process resources and equip characters.
7. Grow strong enough for harder hunts and missions.
8. Gain rarer people, relics, knowledge, materials, and bloodline traits.
9. Domain growth later creates suspicion, loyalty pressure, and raids.

## Strict scope

This PR implements only Milestone 0.6.1:

- separate HumanServants from VampireVassals
- population, housing, Dominion, and torpor
- human recruitment
- meaningful Feed, Drain, Recruit, and Turn choices
- Blood Resonance
- removal of decorative Recruitability
- active Day Management
- minimal Food and Blood Stock upkeep
- simple vampire night orders
- save v4 migration
- honest system audit and roadmap

Do not implement the final economy, full bloodline rewrite, movement, logistics, raids, sunlight, or a night timer here.

## GitHub safety

A previous agent lost completed local work after a failed final push.

Required sequence:
1. Create the branch from latest `main`.
2. Push the remote branch immediately.
3. Commit and push save-v4 models and migration.
4. Commit and push population types, capacities, and recruitment.
5. Commit and push Feed, Drain, Turn, and Blood Resonance.
6. Commit and push Day Management, night orders, UI, and world sync.
7. Commit and push tests and documentation.
8. Verify the remote branch is ahead of `main` before opening the PR.

After every push, verify the remote SHA and changed files. If any push fails, stop, preserve the working tree, report the full error, and do not claim completion.

## Before implementation

Read:
- `README.md`
- `ARCHITECTURE.md`
- `GAME_DESIGN.md`
- `ROADMAP.md`
- `BALANCING.md`
- `SAVE_FORMAT.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `.github/copilot-instructions.md`

Inspect at minimum:
- `src/types/models.ts`
- `src/app/App.ts`
- `src/app/state.ts`
- `src/config/balancing.ts`
- `src/config/game.ts`
- `src/data/items.ts`
- `src/data/recipes.ts`
- `src/data/rooms.ts`
- `src/data/traits.ts`
- `src/data/professions.ts`
- `src/simulation/world/humans.ts`
- `src/simulation/combat/bite.ts`
- `src/simulation/bloodlines/*`
- `src/simulation/servants/*`
- `src/simulation/time/*`
- `src/simulation/building/*`
- `src/simulation/crafting/*`
- `src/simulation/inventory/*`
- `src/game/bridge.ts`
- `src/game/scenes/WorldScene.ts`
- `src/ui/**/*`
- persistence, migration, validation, import, and export modules
- all tests through PR #9

Before coding, produce a concise plan covering architectural weaknesses, authoritative state, migration, module boundaries, tests, and deferred work.

## Technical constraints

Preserve:
- static browser-only GitHub Pages runtime
- no backend or external runtime APIs
- no paid services, telemetry, analytics, CDN, external fonts, or remote assets
- strict TypeScript, Phaser 3, Vite, IndexedDB, Vitest, ESLint, Prettier
- save slots and JSON import/export
- working combat, dodge, targeting, enemy attacks, world refresh, security, and escaping

Do not add React, Vue, Angular, Svelte, a large state framework, ECS, pathfinding, or another heavyweight dependency. Keep deterministic simulation logic outside Phaser where practical.

## System audit

Create `docs/SYSTEM_AUDIT.md`.

Audit:
- resources and strategic resources
- items and recipes
- rooms
- professions, attributes, skills, and traits
- human NPC values
- servant jobs
- Blood Essence, hunger, feeding, draining, and turning
- inheritance
- time and world respawn
- crafting and equipment
- room capacity, storage, and production fields
- loyalty, morale, stress, ambition, and combat

For every element document:
- current source
- current sinks
- whether the effect is really implemented
- whether it is visible
- Keep / Rework / Remove / Hide Until Implemented
- intended core-loop connection
- target milestone

Rules:
- no visible resource without a real source and sink
- no room without a real function
- no item without a recipient or use
- no trait with decorative text only
- no visible value without mechanical effect
- no UI claim unsupported by code
- no decorative model field kept merely because it sounds sophisticated

Unused systems must be implemented, hidden, removed, or honestly deferred.

## Save format v4

Increase `SAVE_FORMAT_VERSION` to 4.

Replace the old authoritative generic `servants` array with:
- `humanServants`
- `vampireVassals`

Suggested HumanServant fields:
- identity and profession
- attributes and learned skills
- personality and physical trait IDs
- health, morale, loyalty, stress, fear, disposition
- current day job and assigned room
- housing status, Food need, productivity
- recruitment method and equipment

Suggested VampireVassal fields:
- identity and former profession
- attributes and retained skills
- personality, physical, and bloodline trait IDs
- health, Vitae, hunger, morale, loyalty, ambition, stress, combat
- `activeState: active | torpor`
- night order, Dominion Cost, Blood upkeep, defiance risk, equipment

Migrate v3 safely:
- old human servants -> HumanServants
- old vampire servants -> VampireVassals
- preserve IDs, names, professions, attributes, traits, equipment, morale, loyalty, ambition, stress, health, rooms, inventory, crafting queue, quests, collectibles, world cycle, settings, event logs, and inheritance history

Initialize and validate:
- housing and Dominion state
- Blood Stock and shortages
- day jobs and night orders
- active/torpor state
- Blood Resonance, Resolve, Disposition, Fear
- feeding recovery
- recruitment state
- clamp numbers and reject NaN/Infinity
- validate IDs and cap arrays
- prevent duplicate characters across all population collections
- do not duplicate free resources
- never silently delete migrated characters

Update `SAVE_FORMAT.md`.

## Population model

### Human servants

Human servants are the daytime economic foundation.

They:
- work only during day resolution
- consume Food
- require housing
- retain professions and learned skills
- may construct, craft, gather, hunt, research, or guard
- may later be elevated into VampireVassals
- remain mortal and comparatively controllable

Initial housing:

```text
base human housing = 2
each built Servant Quarters = +4 housing
```

Human population may temporarily exceed capacity, but overcrowding must cause visible productivity, morale, and stress penalties. Severe overcrowding blocks further recruitment. Never delete excess servants and do not use an arbitrary final global population cap.

### Vampire vassals

VampireVassals:
- operate primarily at night
- consume Blood Stock while active
- retain learned human skills
- gain bloodline traits
- possess ambition and may refuse orders
- may enter torpor
- later become mission leaders or companions
- are powerful and costly

There is no arbitrary final dynasty cap. Limit simultaneous active control through Dominion Capacity.

## Dominion Capacity

Implement:

```text
dominionCapacity =
1
+ floor((player.attributes.bloodControl + player.attributes.presence) / 4)
+ built Vassal Crypt capacity
+ explicitly implemented trait, relic, or research bonuses
```

Add `Vassal Crypt`:
- +2 Dominion Capacity
- torpor accommodation
- meaningful cost and prerequisite
- no decorative attribute bonus
- use existing room placement

Each normal active vassal has Dominion Cost 1.

```text
dominionStrain =
max(0, total active Dominion Cost - Dominion Capacity)
```

Each Strain point causes transparent:
- loyalty penalty
- night-order effectiveness penalty
- higher defiance risk

Do not add random betrayal merely because many vassals exist. Defiance must derive from loyalty, ambition, hunger, stress, Dominion Strain, relative power, traits, and treatment.

Display deterministic risk:
- Stable
- Uneasy
- Defiant
- Dangerous

A sufficiently risky vassal may refuse a night order. Full rebellion or hostile takeover is deferred.

## Torpor

Each vassal is exactly one of:
- active
- torpor

Active vassals:
- receive one night order
- consume Blood Stock
- count against Dominion
- appear at night
- suffer Strain

Torpor vassals:
- receive no order
- consume no Blood Stock initially
- do not count against active Dominion
- remain in roster
- do not appear as active world figures

Allow controlled state switching. Never duplicate world tokens.

## Blood Stock and Blood Essence

Keep Blood Essence for supernatural use:
- turning
- rituals
- supernatural rooms
- future bloodline research

Add `Blood Stock` for:
- active vassal upkeep
- future prisoners and blood-cellar systems

Initial Blood Stock sources:
- Drain
- successful `Hunt for Blood` order

Initial sink:
- 1 Blood Stock per active vassal per resolved night

On shortage:
- consume available stock
- identify unfed vassals deterministically
- increase hunger
- reduce loyalty and order effectiveness
- report clearly
- do not invent blood or instantly kill vassals

Topbar and tooltips must distinguish Blood Stock from Blood Essence.

## Blood Resonance

Replace `bloodQuality` with `bloodResonance`, range 1–5.

Deterministic weighted generation:
- 1: 35%
- 2: 35%
- 3: 20%
- 4: 8%
- 5: 2%

Use seeded RNG, never `Math.random`.

Labels:
- 1 Thin
- 2 Common
- 3 Rich
- 4 Potent
- 5 Exceptional

Blood Resonance must affect:
- Feed Vitae
- Drain Vitae
- Drain Blood Stock
- Drain Blood Essence
- turning stability
- resulting vassal max Vitae potential
- mutation risk or quality

Use shared pure helpers for UI and simulation.

Initial formulas:

```text
Feed Vitae = 1 + ceil(resonance / 2)
Drain Vitae = 2 + resonance
Drain Blood Stock = 1 + floor(resonance / 2)
Drain Blood Essence = 1 for resonance 1–3, otherwise 2
Feed hunger reduction = 3
Drain hunger reduction = 6
```

Clamp Vitae to max. Document formulas in `BALANCING.md`.

## Remove Recruitability

Remove authoritative `recruitability`.

Add:
- `resolve`: 1–5 stable resistance
- `disposition`: -100 to +100 attitude
- `fear`: 0–100 fear

Recruitment derives from:
- player Presence
- target Resolve
- Disposition
- Fear
- faction
- housing
- method
- relevant traits and explicit costs

No unexplained hidden lottery. Show a result category and breakdown:
- Very Likely
- Likely
- Uncertain
- Unlikely
- Blocked

## Human recruitment

Add Recruit separately from Feed, Drain, and Turn.

Recruiting removes one free human and creates exactly one HumanServant. Housing is required.

### Offer Protection
Uses Presence, Disposition, Resolve, and faction context.

Produces:
- higher loyalty and morale
- lower Fear
- no supernatural cost

### Enthrall
Uses Presence, Blood Control, and Resolve.

Costs Vitae or Blood Essence.

Produces:
- lower morale
- less stable loyalty
- higher Fear and stress
- better ability to overcome hostile Disposition

Optional only if complete: Intimidate.

Prefer deterministic threshold resolution. Any flavor randomness must be seeded, visible, bounded, and secondary.

Block duplicate recruitment, invalid targets, and recruitment without housing.

## Feed, Drain, Recruit, and Turn

### Feed
- nonlethal
- restores Resonance-scaled Vitae
- reduces hunger
- preserves future candidate value
- applies weakened/recovering state
- prevents repeated feeding until a defined recovery day
- predictably changes Disposition and Fear
- creates no Blood Stock or Blood Essence
- commits exactly once

### Drain
- lethal
- restores more Vitae
- reduces hunger more strongly
- creates Blood Stock and Blood Essence
- permanently removes the human
- destroys their worker and vassal potential
- commits exactly once

Drain should be the strongest immediate action with the greatest opportunity cost.

### Recruit
- creates one HumanServant
- requires housing
- preserves profession, learned skills, physical traits, and personality
- initializes loyalty, morale, Fear, and stress from the method
- does not create a vampire

### Turn
- creates one VampireVassal
- costs at least 3 Vitae and 1 Blood Essence
- checks Dominion and torpor
- preserves learned skills and identity
- applies bloodline inheritance/mutation
- removes the source character exactly once

Direct Turn of a free human:
- lower starting loyalty
- higher stress and defiance risk

Elevation of a loyal HumanServant:
- better loyalty
- lower stress
- improved stability
- full skill preservation
- removes one HumanServant and creates one VampireVassal

When active Dominion is unavailable, warn and allow torpor where appropriate. Rename `Turn to Servant` to `Turn into Vassal`.

## Action value preview

The human panel must show:
- identity, profession, practical value, important skills
- personality and physical traits
- Resonance and label
- Resolve, Disposition, Fear
- housing and Dominion status
- exact Feed and Drain results
- recruitment methods and calculations
- Turn cost, stability, likely loyalty, and torpor requirement

Disabled actions need accurate reasons. UI previews and committed outcomes must use the same balance helpers.

## Human servant day work

HumanServants work only during Day resolution. VampireVassals never perform ordinary daytime jobs.

Initial jobs may include:
- Build
- Craft
- Gather Wood
- Hunt for Food
- Gather Herbs
- Guard
- Research only when a real research output exists

Each HumanServant receives at most one day assignment.

Output depends on:
- relevant skill
- profession
- personality and physical traits
- morale and health
- Food shortage and overcrowding
- assigned room
- workplace availability

Remove the current behavior where gathering Wood also creates Food.

Profession alignment:
- Peasant: flexible low-level labor
- Woodcutter: Wood and construction
- Hunter: Food, occasional Leather, guarding
- Blacksmith: metal processing and equipment
- Herbalist: Herbs and medicine
- Guard: Security and defense preparation
- Monk/Scribe: ritual or Knowledge only when that output has a real use

Do not create meaningless Gold, Knowledge, or Influence stockpiles. Hide or defer any strategic resource without a real sink.

## Food upkeep

Each HumanServant consumes 1 Food per resolved day.

Resolve consumption exactly once.

When Food is sufficient:
- consume exact demand
- no penalty

When Food is insufficient:
- consume available Food
- calculate shortage
- reduce productivity and morale
- increase stress
- create clear log/report entries
- do not instantly kill servants

Display current Food, daily demand, and projected surplus or shortage.

## Day Management mode

Day must become an active management mode.

On Night -> Day:
- pause combat and normal movement
- automatically open Day Management
- show population, housing, Food, jobs, rooms, construction, crafting, projected outputs, and warnings

The player can:
- assign HumanServant jobs and rooms/tasks
- change priorities
- queue construction and crafting
- inspect Food, housing, morale, loyalty, stress, and productivity
- confirm resolution

Primary action: `Resolve Day and Begin Night`

It must exactly once:
1. validate assignments
2. consume Food
3. resolve HumanServant work
4. advance construction
5. advance crafting
6. apply housing and shortage effects
7. apply morale, loyalty, and stress changes
8. produce a truthful Day Report
9. transition to night
10. run the existing new-night world refresh once
11. prepare vassal night orders
12. autosave

Remove or development-gate unrestricted `Advance Phase`. Normal players must not toggle phases anywhere at will.

## Vampire vassal night orders

At night, each active VampireVassal may receive at most one order.

Required orders:

### Hunt for Blood
- produces Blood Stock
- depends on Hunting, combat, hunger, loyalty, and Dominion Strain
- may raise stress
- bounded output

### Guard Stronghold
- produces Security or another already implemented defensive value
- depends on Guarding, combat, loyalty, and Strain

### Recover
- lowers stress
- may restore health
- produces no resources

### Enter Torpor
- switches to torpor
- no productive output
- no Blood upkeep

Optional only if real outputs exist: Scout or Research Rituals.

Resolve Blood Stock upkeep once per night. No movement, pathfinding, companion AI, or simulated off-map combat in this PR.

## Skills and trait categories

Prepare the data model for Milestone 0.6.3.

### Learned skills
- Construction
- Crafting
- Smithing
- Herbalism
- Medicine
- Research
- Hunting
- Melee
- Ranged
- Stewardship

Professions create starting skills. Skills remain with a person through turning and are not inherited genetically from the sire.

### Personality traits
Examples: patient, cruel, paranoid, cowardly, industrious, charming, resolute.

### Physical traits
Examples: strong, agile, frail, sickly.

### Bloodline traits
Examples: blood_hunter, blood_mage, pure_lineage, night_commander, sun_cursed, feral_hunger, memories_of_the_blood.

`blacksmith_training` must not remain genetically inherited knowledge. `forestwise` should become a learned specialization or skill-related property.

For this PR:
- prepare categories and migration
- preserve working effects where possible
- remove misleading UI/documentation
- defer the complete inheritance rewrite to 0.6.3

## Turning stability

Create one deterministic stability helper.

Inputs may include:
- Blood Resonance
- Resolve
- player Blood Control
- bloodline traits
- whether the target is a loyal HumanServant
- Blood Essence invested
- Blood Cellar support
- Dominion Strain

Display:
- Unstable
- Risky
- Stable
- Potent

Stability may affect starting loyalty, stress, max Vitae, and mutation quality/risk. Never use hidden unseeded randomness. Any mutation RNG must be seeded and its factors reflected in preview text.

## Rooms

Every visible room must have an implemented function.

### Coffin Chamber
- respawn
- daytime rest
- base Dominion

### Servant Quarters
- +4 Human Housing
- remove decorative generic attribute bonuses

### Vassal Crypt
- +2 Dominion Capacity
- torpor accommodation
- meaningful costs

### Workshop
- real crafting access and worker slots

### Storage Room
If capacity is not enforced, do not claim it is. Hide or honestly defer storage limits to 0.6.2.

### Blood Cellar
Must provide a real Blood Stock, Blood Essence, or turning function, such as capacity or stability. Do not grant unexplained permanent Blood Control merely for existing.

## Resource and economy corrections

Temporarily keep:
- Wood
- Stone
- Iron Ore
- Leather
- Herbs
- Food
- Wood Planks
- Iron Ingots

Manual pickups remain an early emergency source. Human servants should become the primary ordinary-resource source. Night gameplay should gradually focus on blood, valuable people, relics, knowledge, rare materials, and dangerous targets.

Every resource needs a source, sink, reason, and progression link. Do not add currencies merely to create complexity.

## World representation

### HumanServants
During day:
- passive deterministic positions in the stronghold
- concise labels only nearby/selected
- no movement, collision, combat, or pathfinding

At night:
- hidden or visibly resting using the simplest truthful implementation
- no night work

### VampireVassals
At night:
- active vassals appear
- torpor vassals do not appear as active figures
- stable deterministic positions
- concise labels nearby/selected
- no movement, companion AI, or combat

During day:
- hidden or shown resting
- no human day work

Repeated sync must never duplicate actors.

## Management UI

Separate:
- Human Servants
- Vampire Vassals

Human UI shows:
- profession and skills
- day job and assigned room
- housing and Food need
- health, morale, loyalty, stress, productivity
- recruitment method and equipment

Vassal UI shows:
- former profession and retained skills
- bloodline traits
- active/torpor
- night order
- hunger and Blood upkeep
- Dominion Cost, Capacity, and Strain
- loyalty, ambition, stress
- defiance category and exact reasons
- equipment

Never use raw internal IDs as primary labels. Explain numbers with tooltips.

## Balancing principles

Use centralized constants and pure helpers.

Goals:
- Feed is sustainable but weaker.
- Drain is immediately strong but destroys long-term human value.
- Recruit creates daytime economic capacity.
- Turn creates long-term supernatural power.
- high-Resonance humans create difficult choices
- humans are easier to support but mortal
- active vassals require Blood and Dominion
- population growth requires housing, Food, and useful jobs
- no action dominates every context

Add balance tests or tables for:
- low-Resonance peasant
- high-Resonance blacksmith
- loyal recruited servant
- hostile high-Resolve human
- ambitious high-Resonance vassal

Document trade-offs in `BALANCING.md`.

## Required automated tests

Preserve all tests through PR #9.

Add deterministic coverage for:

### Migration
1. v3 -> v4.
2. Old human servants become HumanServants.
3. Old vampire servants become VampireVassals.
4. IDs remain unique.
5. Rooms, inventory, world cycle, quests, and collectibles remain intact.
6. No free resources are duplicated.
7. Migration is idempotent.

### Housing
8. Base capacity is 2.
9. Each built Servant Quarters adds 4.
10. Unfinished rooms add none.
11. Overcrowding is correct.
12. Severe overcrowding blocks recruitment.
13. Existing servants are never silently deleted.

### Dominion and torpor
14. Dominion formula is correct.
15. Built Vassal Crypts add capacity.
16. Unfinished crypts add none.
17. Active vassals count.
18. Torpor vassals do not.
19. Strain is never negative.
20. Strain changes defiance risk deterministically.
21. Active/torpor switching cannot duplicate characters or tokens.

### Blood upkeep
22. Active vassals consume Blood Stock once per night.
23. Torpor vassals consume none.
24. Shortage applies consequences once.
25. Save/load does not duplicate upkeep.

### Food upkeep
26. HumanServants consume Food once per day.
27. Shortage is exact.
28. Shortage affects productivity, morale, and stress once.
29. Save/load cannot duplicate day consumption.

### Blood Resonance
30. Generation is deterministic and within 1–5.
31. Weighted distribution is tested appropriately.
32. Feed scales correctly.
33. Drain scales correctly.
34. Drain produces Blood Stock and Essence.
35. High Resonance is stronger but bounded.
36. UI previews and simulation use the same helpers.

### Recruitment
37. Housing is required.
38. Offer Protection uses Presence, Disposition, Resolve, and faction.
39. Enthrall uses supernatural factors and exact costs.
40. Offer Protection produces better initial morale/loyalty.
41. Enthrall produces more Fear/stress.
42. Recruitment cannot duplicate.
43. Drained or turned humans cannot be recruited.
44. The free human is removed exactly once.

### Feed
45. Nonlethal.
46. Exact Vitae and hunger change.
47. No Blood Stock or Essence.
48. Recovery blocks repeated exploitation.
49. Disposition and Fear change as documented.
50. Commit occurs exactly once.

### Drain
51. Lethal.
52. More immediate resources than Feed.
53. Exact Vitae, hunger, Blood Stock, and Essence.
54. Target is permanently unavailable.
55. Commit occurs exactly once.

### Turn and elevation
56. Direct Turn costs Vitae once.
57. Direct Turn costs Blood Essence once.
58. Creates one VampireVassal and removes one free human.
59. Repeated commit cannot duplicate.
60. Elevation removes one HumanServant and creates one VampireVassal.
61. Learned skills are preserved.
62. Elevation starts with better loyalty and lower stress than Direct Turn.
63. Capacity overflow causes explicit torpor or documented Strain behavior.

### Day Management
64. Only HumanServants work during day.
65. VampireVassals never perform day jobs.
66. One job maximum per HumanServant.
67. Outputs are deterministic.
68. Wood gathering no longer creates Food.
69. Day resolution occurs once.
70. New-night refresh occurs once.

### Night orders
71. Only active vassals receive orders.
72. Torpor vassals receive none.
73. One order maximum per active vassal.
74. Hunt for Blood creates bounded Blood Stock.
75. Guard creates only a real output.
76. Defiant vassals may refuse according to deterministic rules.
77. Reload cannot duplicate order resolution.

### Data integrity
78. No visible resource lacks a real source/sink unless clearly marked future.
79. No active room lacks a function.
80. No recipe references missing inputs/outputs.
81. No character exists in multiple population collections.
82. No raw internal ID is a primary visible label.
83. Deprecated Recruitability is no longer authoritative.
84. No decorative room bonus remains falsely active.

## Manual browser playtest

Use Playwright MCP and actually test:

1. New game.
2. Inspect multiple Resonance values and action previews.
3. Feed and verify recovery blocking.
4. Drain and verify all resource changes.
5. Recruit via Offer Protection.
6. Recruit or attempt Enthrall.
7. Attempt recruitment without housing.
8. Build Servant Quarters and verify capacity.
9. Enter Day Management.
10. Assign jobs and resolve a day.
11. Verify Food consumption and outputs.
12. Confirm Wood no longer creates Food.
13. Direct Turn a free human.
14. Elevate a HumanServant.
15. Compare loyalty and stress.
16. Build/inspect Vassal Crypt.
17. Exceed Dominion and verify torpor/Strain.
18. Assign Hunt for Blood and resolve it.
19. Create Blood Stock shortage and verify consequences.
20. Save/load through major states.
21. Confirm no duplicate people, rooms, resources, or rewards.
22. Confirm combat, Bandit, Clergy projectile, Elite attack, dodge, targeting, and world refresh still work.

Capture screenshots:
- human context panel
- Resonance comparison
- Feed and Drain previews
- recruitment breakdown
- Day Management
- both rosters
- housing shortage
- Dominion and Strain
- torpor
- elevation
- Blood Stock shortage

Do not claim browser testing unless performed. Report failures honestly.

## Documentation and roadmap

Update:
- `README.md`
- `ARCHITECTURE.md`
- `GAME_DESIGN.md`
- `ROADMAP.md`
- `BALANCING.md`
- `SAVE_FORMAT.md`
- `CHANGELOG.md`
- `docs/SYSTEM_AUDIT.md`

Roadmap:

### Milestone 0.5 — completed
- world sync
- world-cycle respawns
- human replenishment
- room and servant representation
- hunger consequences

### Milestone 0.6.1
- HumanServants and VampireVassals
- recruitment
- housing
- Dominion
- Blood Stock
- Day Management
- night orders

### Milestone 0.6.2
- storage limits
- workplaces and tools
- workbenches
- material processing
- crafting bills
- equipment production
- useful room capacities/adjacency

### Milestone 0.6.3
- learned skills
- personality and physical traits
- bloodline traits
- turning preview
- deeper inheritance
- training and experience

### Milestone 0.6.4
- persistent night clock
- dawn warnings
- sunlight
- Coffin Chamber phase loop
- nightly objectives and reports
- risk-versus-return pressure

### Milestone 0.7
- visible movement and room work
- positioning
- logistics and hauling
- companion behavior

### Milestone 0.8
- suspicion and factions
- raids
- traps and fortifications
- walls, chokepoints, defensive planning

## Explicitly deferred

Do not implement:
- pathfinding, movement, work animations
- hauling or logistics networks
- companions or vassal combat
- full rebellion/betrayal boss fights
- raids, walls, doors, traps
- full storage simulation unless migration safety requires it
- full RimWorld-style bills
- complete inheritance rewrite
- skill XP/training
- night countdown or sunlight
- procedural maps, new enemy classes, weather
- multiplayer, backend, or external APIs

## Required commands

Run:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run smoke:pages
```

All must pass. Do not suppress failures.

## Acceptance criteria

The PR is complete only when:

- remote branch exists and is ahead of `main`
- v3 migrates safely to v4
- HumanServants and VampireVassals are separate authoritative models
- old data migrates without loss or duplication
- HumanServants work only by Day resolution
- active vassals receive only night orders
- housing, Servant Quarters, Dominion, Vassal Crypt, Strain, and torpor function
- Food and Blood Stock upkeep function exactly once
- Blood Stock and Blood Essence are clearly distinct
- Blood Resonance has real effects
- Recruitability is removed as an authoritative value
- Resolve, Disposition, and Fear drive recruitment
- Feed, Drain, Recruit, Direct Turn, and Elevation are meaningfully different
- valuable humans create real trade-offs
- Day Management is active gameplay
- unrestricted phase toggling is removed or development-gated
- Wood gathering no longer generates Food
- no character, reward, upkeep, or resolution duplicates
- existing combat and world refresh remain functional
- `SYSTEM_AUDIT.md` is honest
- all tests pass
- browser testing is reported truthfully
- CI is green
- no deferred major system was smuggled into the PR

## Final agent instruction

After reading this entire file:

1. Inspect latest `main`.
2. Produce the concise implementation plan.
3. Create and immediately push `copilot/milestone-0.6.1-domain-population-reforge`.
4. Implement incrementally using the required push checkpoints.
5. Open the PR with the required title.
6. In the PR description, report architecture changes, migration, balancing, tests, manual results, known limitations, and deferred work.
