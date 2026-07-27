# Game Design

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

- Blood quality and profession hint at whether a human is a better fuel source or a better servant candidate.
- A turned servant should immediately connect back into building, crafting, gathering, or guarding.
- Better servants and better gear should feed back into stronger combat performance and future turn choices.

## Current limitations

- Enemy roster is still limited to one bandit, one clergy hunter, and one elite knight encounter at a time.
- Combat presentation is intentionally compact and uses generated art rather than hand-authored sprite sheets.
- Large raids, fortifications, trap networks, and defensive path control remain future-milestone work.
