# Game Design

## Core loop (Milestone 0.5)

1. Generate a deterministic starting vampire from world seed + character roll.
2. Explore the world at night and collect physical items (resource nodes persist as depleted until a new night).
3. Lock hostile targets with predictable controls and fight; defeated enemies are recorded and not re-rewarded during the same night.
4. Feed on humans to restore Vitae, drain them for Vitae and Blood Essence, or turn selected candidates into vampire vassals.
5. Turned vampire vassals appear in Ruined Stronghold and are assigned work priorities.
6. Rooms placed in the 4×4 Stronghold grid appear as visual representations at their grid positions.
7. Advance to day (personal Vitae upkeep is paid and daylight traits apply); advance to the next night (resources respawn, enemies respawn, human population replenishes to target 5).
8. Expand the stronghold, craft gear, and progress the awakening quest.

## World refresh cycle

- **Night → Day**: player Vitae upkeep is paid once. No world respawn.
- **Day → Night**: day number increments; world cycle increments; collected resource node and defeated enemy depletion resets; human population replenishes.
- The memory fragment collectible does not respawn once discovered.

## Vitae model

- Vitae is a vampire's personal blood reserve and supernatural energy.
- Vampire abilities spend Vitae; feeding restores it.
- The player consumes 1 Vitae at each dawn as baseline sustenance.
- Vitae condition is derived rather than saved: Sated (>=50%), Thirsty (25-<50%), Starved (>0-<25%), Bloodless (0).
- Low Vitae reduces player attack damage and normal/orbital movement, but does not directly damage health.
- Ordinary Food is for humans, not vampires. Human Servant Food consumption arrives with the human economy.
- Vampire Vassal domain-scale blood supply is deferred until Blood Stock/Dominion gives it a real source and sink.
- Blood Resonance now makes Feed a renewable, nonlethal Vitae choice and Drain a larger one-time Vitae/Essence payout that kills the target. A fed human cannot be used again until the next night.

## Combat feeding

A Bloodless vampire must always have a skill-based route back into the supernatural combat loop. Predatory Bite lets the player execute a vulnerable hostile for Vitae without inventing a second vampire hunger resource. Normal enemies become feedable at low health or when staggered; elites demand a lower health threshold or a successful stagger and tighter timing. Failed attempts hurt and knock the player away.

This is deliberately a finisher: a successful combat feed kills the vulnerable target, so one enemy cannot become an infinite Vitae source. Future bosses can override this with phase-specific rules.

## Human population

- Active target: `TARGET_HUMAN_POPULATION = 5` (wandering humans in Village Edge).
- Drained and turned humans do not repopulate.
- Fed humans recover to wandering at the start of a new night.
- Generated IDs are deterministic: `human-d{day}-{index}`.

## Core loop (Milestone 0.4)

1. Generate a deterministic starting vampire from world seed + character roll.
2. Explore the world at night and collect physical items.
3. Lock hostile targets with predictable controls and fight with orbital movement, dodge timing, melee chains, and Blood Lance.
4. Feed on humans to restore Vitae and judge which humans are worth turning.
5. Turn selected humans into vampire servants through a shared bite pipeline.
6. Assign servant priorities so they build, craft, gather, or guard with visible results.
7. Expand the stronghold with item-based construction costs and room prerequisites.
8. Craft gear only when rooms, inputs, and servant support are actually available.
9. Equip weapon/armor/accessory items and consume Healing Draught when needed.
10. Progress quest and memory log through overlays, HUD context, and clearer objective text.

## Combat pillars

- **Readability first:** windups, active frames, recovery, target lock feedback, and enemy telegraphs are always visible.
- **Deterministic resolution:** cooldowns, projectile travel, bite commits, and target selection rules are testable without Phaser.
- **Pressure through positioning:** lock-on movement, dodge timing, and enemy preferred ranges matter more than contact damage.
- **Shared interaction flow:** keyboard and UI buttons funnel through the same human bite pipeline.
- **Truthful controls:** visible actions must either work, explain why they are blocked, or stay clearly unavailable.

## Resource model

- **Physical inventory items**: wood, stone, ore, herbs, food, crafted equipment/consumables.
- **Strategic resources**: Blood Essence, Security (plus placeholders for gold/knowledge/influence).

## UI design pillars

- Top bar for strategic state + resources + management entry points
- Bottom HUD for combat vitals, cooldowns, and locked-target status
- Context panel only when interactions are available
- Overlay-based management screens that pause/block world input
- Short guidance instead of long tutorials: objective text, context reasons, and concise control reminders

## Why turning matters

- Blood Resonance and profession help distinguish a valuable blood source from a valuable future servant or vassal candidate.
- A turned servant should immediately connect back into building, crafting, gathering, or guarding.
- Better servants and better gear should feed back into stronger combat performance and future turn choices.

## Current limitations

- Enemy roster is still limited to one bandit, one clergy hunter, and one elite knight encounter at a time.
- Combat presentation is intentionally compact and uses generated art rather than hand-authored sprite sheets.
- Large raids, fortifications, trap networks, and defensive path control remain future-milestone work.


## Human Thrall Work

Human Thralls are the daytime economic population. Their work is not a reskinned Vampire Vassal loop: mortal labor resolves after the day has elapsed, while Vampire Vassals operate at night.

Implemented mortal jobs:
- Building advances queued Stronghold room construction.
- Crafting advances recipe work and completes real inventory outputs when enough work accumulates.
- Gathering produces Wood or Herbs.
- Hunting produces Food and, for sufficiently effective hunters, Leather.

Efficiency is transparent and deterministic. Profession aptitude, existing job-skill values, relevant traits, Control, and Stress all contribute. Low Control and high Stress reduce output instead of creating a second loyalty system.

Guarding and Research are deliberately not simulated yet. They remain disabled until defense/research systems provide real sources, sinks, and consequences.

## Human Thralls and Vampire Vassals

Human Servants are prisoners under vampiric venom and domination. They are not free citizens of the domain. Their primary relationship to the player is **Control**, opposed by **Resistance**, not Loyalty. Control naturally weakens over time and can be reinforced by the vampire; deprivation accelerates loss of control and a completely broken bond allows escape.

Human Thralls retain their mortal identity: profession, skills/traits, family identity, Blood Resonance and human metadata. This is intentional groundwork for later genetics, family lines, donor selection and the strategic decision between keeping a valuable mortal or turning them into an autonomous Vampire Vassal.

Vampire Vassals remain fundamentally different. They are powerful, immortal political subordinates with Loyalty and Ambition rather than controlled mortal captives. Turning is therefore not a simple upgrade from Human Thrall to better worker. A trained Thrall may now be deliberately Elevated into a Vassal: learned profession skills and gear carry across, while Control/Resistance cease to apply and Vampire politics take over.
