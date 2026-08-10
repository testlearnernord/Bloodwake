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

## Blood Donors

Blood Donor is an irreversible captive lifecycle role, not a normal job priority. A Human Thrall may be permanently bound to a built Blood Cellar after an explicit confirmation. They leave ordinary labor forever and remain bound until death. Their identity, learned skills, traits, health and Blood Resonance remain meaningful because committing a valuable worker, future vampire candidate or genetically interesting human to blood production must be a strategic sacrifice.

0.6.3d establishes donor slots and Blood Stock storage only. It deliberately does not grant passive blood per day. Extraction, recovery, health decline and death become real facility tasks under continuous simulation.

Regional population is also persistent enough for player actions to matter: removing a Human creates a real vacancy. New people may migrate into the region later, but there is no immediate one-for-one replacement.

## Human Thralls and Vampire Vassals

Human Servants are prisoners under vampiric venom and domination. They are not free citizens of the domain. Their primary relationship to the player is **Control**, opposed by **Resistance**, not Loyalty. Control naturally weakens over time and can be reinforced by the vampire; deprivation accelerates loss of control and a completely broken bond allows escape.

Human Thralls retain their mortal identity: profession, skills/traits, family identity, Blood Resonance and human metadata. This is intentional groundwork for later genetics, family lines, donor selection and the strategic decision between keeping a valuable mortal or turning them into an autonomous Vampire Vassal. Controlled Humans and Vampire Vassals must also exist visibly in the Stronghold as projections of those persistent population records; later visible-work behavior will animate the same job/task state rather than inventing a parallel simulation.

Vampire Vassals remain fundamentally different. They are powerful, immortal political subordinates with Loyalty and Ambition rather than controlled mortal captives. Turning is therefore not a simple upgrade from Human Thrall to better worker. A trained Thrall may now be deliberately Elevated into a Vassal: learned profession skills and gear carry across, while Control/Resistance cease to apply and Vampire politics take over.

## Shared Vampire Combat Architecture

The player and Vampire Vassals must ultimately use the same combat primitives rather than separate damage systems. A combatant owns health/Vitae, equipment, target lock, action runtime and the same Light Attack, Heavy Attack, Dodge, Blood Lance and Predatory Bite rules. Player input is one controller; Vassal utility AI is another controller over the same actions.

Vassal jobs such as Guarding, Companion, Scouting, Hunting and Raiding determine mission context and engagement policy, not a different combat engine. Combat AI should lock a concrete target, orbit/reposition, read windups, exploit recovery windows, manage Vitae, simulate skill-based Predatory Bite timing, and choose retreat when local odds are poor. Combat skill, traits, stress, health, loyalty and mission role should affect reaction quality and risk tolerance so Vassals are capable but fallible. This is scheduled after operational orders as 0.6.4d1.


## Vampire Vassal Operational Orders

Vassal operations are a separate command layer from routine Stronghold work priorities. A Vassal may have no field order, Guard the Stronghold, act as Companion, Scout, Hunt, or Raid. Issuing a field order consumes the same derived political Obedience used by the politics system; mission danger changes compliance and an autonomous Vassal can refuse without creating a second loyalty meter. Torpor clears field orders.

Operational orders describe intent and engagement policy, not instant outcomes. Guard/Companion/Scout/Hunt/Raid must not mint resources from a phase click. Companion can visibly follow the player and the other orders can stage the Vassal at explicit world destinations now, but combat, prey, loot, injury and return travel become causal through 0.6.4d1 shared combat and 0.6.5 authoritative tasks.

## Vampire Vassal Politics

Vampire Vassals are autonomous political actors rather than controlled Thralls. Their current stance is derived from persistent character state instead of being saved as a second opinion meter. Loyalty and Morale support Obedience; Ambition and Stress undermine it. The derived states are Devoted, Loyal, Wary, Resentful and Defiant, with Defiance Risk exposed as the inverse of Obedience.

Night-start political events are deterministic from world seed, day and Vassal identity. Dominion Strain settles first, so overextended authority can push an already ambitious or stressed Vassal toward resentment or rivalry. Torpid Vassals remain outside active political settlement. Operational orders in 0.6.4d should consume this same political profile for compliance/refusal rather than inventing a separate obedience system.

The old generic work-shift servant event table has been removed. Crafting, gathering or guarding no longer mutate Loyalty merely because a work task completed; political consequences belong to the political resolver.

## Shared Vassal Combat AI (0.6.4d1)

Vampire Vassals on Guard, Companion, Scout, Hunt, or Raid orders can enter real world combat. They use the same `startAction` / `stepAction` runtime and the same Light, Heavy, Dodge, Blood Lance, and Bite action definitions as the player rather than a parallel fake damage ticker. Their operational order controls engagement radius and risk tolerance; Scout retreats early, Raid accepts substantially more danger, and Companion prioritizes threats near the Vampire Lord.

A Vassal keeps a combat target lock until the target dies or leaves an expanded break radius and uses the same locked-movement orbit primitive as the player. Personal Health and Vitae are persistent character state. Heavy Attack and Blood Lance consume the Vassal's own Vitae. Predatory Bite can replenish that Vitae from physically weakened enemies; AI bite resolution is deterministic and can fail, causing real injury. At zero combat Health a Vassal is driven into Torpor instead of being deleted from the bloodline.

Combat runtime, current target lock, dodge velocity, and action cooldown presentation remain transient scene state. No new save-version field is introduced by this milestone.
